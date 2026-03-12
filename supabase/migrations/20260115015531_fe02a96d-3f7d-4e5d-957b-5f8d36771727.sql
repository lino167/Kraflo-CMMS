-- Drop the overly permissive policy
DROP POLICY IF EXISTS "profiles_select_same_company_or_self" ON public.profiles;

-- Create stricter policy: users can only view their own profile OR admins can view company profiles
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Users can always see their own profile
  auth.uid() = id
  OR
  -- Admin Empresa can view profiles from their company
  (has_role(auth.uid(), 'admin_empresa') AND empresa_id = get_user_empresa_id(auth.uid()))
  OR
  -- Admin Kraflo can view all profiles (already covered by other policy, but explicit here)
  is_admin_kraflo(auth.uid())
);