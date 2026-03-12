-- ==========================================
-- HARDENING: public.profiles (company isolation)
-- ==========================================

-- Drop existing conflicting SELECT policies (keeping admin ones)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new policy: usuário pode ver próprio profile OU profiles da mesma empresa
CREATE POLICY "profiles_select_same_company_or_self"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR empresa_id = public.get_user_empresa_id(auth.uid())
);

-- Note: Existing policies remain:
-- - "Admin Kraflo can manage all profiles" (ALL)
-- - "Admin Kraflo can view all profiles" (SELECT) 
-- - "Block anonymous access to profiles" (ALL with false - blocks anon)
-- - "Users can update their own profile" (UPDATE)