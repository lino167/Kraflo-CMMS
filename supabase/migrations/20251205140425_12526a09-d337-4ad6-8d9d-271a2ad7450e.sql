-- FIX CRITICAL SECURITY BUG: Remove permissive policy that allows all authenticated users to see all data
DROP POLICY IF EXISTS "Deny anonymous access to ordens_de_servico" ON public.ordens_de_servico;

-- Add a RESTRICTIVE policy to ensure only authenticated users can access (as a baseline)
CREATE POLICY "Require authentication for ordens_de_servico"
ON public.ordens_de_servico
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);

-- The existing PERMISSIVE policies (Admin Kraflo and Admin Empresa) will now properly control access
-- Users without empresa_id will NOT see any data (as intended)