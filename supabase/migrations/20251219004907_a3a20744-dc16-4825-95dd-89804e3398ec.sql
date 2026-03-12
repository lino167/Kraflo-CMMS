-- Apply FORCE ROW LEVEL SECURITY for empresas
-- This ensures RLS applies even for table owners
ALTER TABLE public.empresas FORCE ROW LEVEL SECURITY;