-- Remove the overly permissive policy that exposes technician data publicly
DROP POLICY IF EXISTS "Allow select tecnicos by telegram id" ON public.tecnicos;

-- The service role used by Edge Functions bypasses RLS entirely,
-- so bot operations will continue to work without this permissive policy.
-- Authenticated users will use the existing empresa-scoped policies.