-- Fix 1: Remove overly permissive INSERT policy on tecnicos
-- Service role bypasses RLS anyway, so this policy is unnecessary and dangerous
DROP POLICY IF EXISTS "Allow insert tecnicos via service role" ON public.tecnicos;

-- Fix 2: Remove overly permissive policy on bot_user_states
-- Service role bypasses RLS anyway, so this policy is unnecessary
DROP POLICY IF EXISTS "Service role full access" ON public.bot_user_states;

-- Create a proper restrictive policy that denies all access to regular users
-- (Service role still bypasses RLS, which is the intended behavior for bot operations)
CREATE POLICY "Deny all access to bot_user_states"
ON public.bot_user_states
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (false);

-- Fix 3: Ensure profiles table has proper protection
-- Drop and recreate the anonymous denial policy to ensure it's properly configured
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;

-- Create a proper RESTRICTIVE policy that blocks anonymous access
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Ensure authenticated users can only access profiles through the other policies
-- Add a base permissive policy for authenticated users to view their own profile
-- (This works with the existing restrictive policies)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Recreate update policy as permissive
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Admin policies should be permissive
DROP POLICY IF EXISTS "Admin Kraflo can view all profiles" ON public.profiles;
CREATE POLICY "Admin Kraflo can view all profiles"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (is_admin_kraflo(auth.uid()));

DROP POLICY IF EXISTS "Admin Kraflo can manage all profiles" ON public.profiles;
CREATE POLICY "Admin Kraflo can manage all profiles"
ON public.profiles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (is_admin_kraflo(auth.uid()));