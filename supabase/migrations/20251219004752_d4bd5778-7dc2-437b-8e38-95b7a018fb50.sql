-- ==========================================
-- HARDENING: public.empresas (Least Privilege)
-- ==========================================

-- 0) RLS ON
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- 1) REVOKE ALL from anon (zero access)
REVOKE ALL ON public.empresas FROM anon;

-- 2) REVOKE ALL from authenticated, then GRANT only SELECT
REVOKE ALL ON public.empresas FROM authenticated;
GRANT SELECT ON public.empresas TO authenticated;

-- 3) service_role keeps full access for Edge Functions
GRANT ALL ON public.empresas TO service_role;

-- 4) Drop old policies (idempotent)
DROP POLICY IF EXISTS "Admin Kraflo can view all empresas" ON public.empresas;
DROP POLICY IF EXISTS "Admin Empresa can view their empresa" ON public.empresas;
DROP POLICY IF EXISTS "Admin Kraflo can manage empresas" ON public.empresas;
DROP POLICY IF EXISTS "empresas_select_admin_kraflo" ON public.empresas;
DROP POLICY IF EXISTS "empresas_select_admin_empresa" ON public.empresas;
DROP POLICY IF EXISTS "empresas_insert_admin_kraflo" ON public.empresas;
DROP POLICY IF EXISTS "empresas_update_admin_kraflo" ON public.empresas;
DROP POLICY IF EXISTS "empresas_delete_admin_kraflo" ON public.empresas;
DROP POLICY IF EXISTS "empresas_select" ON public.empresas;

-- 5) SELECT policy: admin_kraflo can see all
CREATE POLICY "empresas_select_admin_kraflo"
ON public.empresas
FOR SELECT
TO authenticated
USING (public.is_admin_kraflo(auth.uid()));

-- 6) SELECT policy: admin_empresa can see only their empresa
CREATE POLICY "empresas_select_admin_empresa"
ON public.empresas
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin_empresa')
  AND public.get_user_empresa_id(auth.uid()) IS NOT NULL
  AND id = public.get_user_empresa_id(auth.uid())
);

-- NOTE: No INSERT/UPDATE/DELETE policies needed since authenticated 
-- doesn't have GRANT for those operations. CRUD happens via service_role only.