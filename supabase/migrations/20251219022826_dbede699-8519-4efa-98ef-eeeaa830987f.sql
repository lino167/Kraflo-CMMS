-- Add explicit UPDATE policy for admin_kraflo to update any profile
CREATE POLICY "Admin Kraflo can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (is_admin_kraflo(auth.uid()));

-- Add INSERT policy for empresas allowing admin_kraflo to create new companies
CREATE POLICY "Admin Kraflo can insert empresas" 
ON public.empresas 
FOR INSERT 
WITH CHECK (is_admin_kraflo(auth.uid()));

-- Add UPDATE policy for empresas allowing admin_kraflo to update companies
CREATE POLICY "Admin Kraflo can update empresas" 
ON public.empresas 
FOR UPDATE 
USING (is_admin_kraflo(auth.uid()));