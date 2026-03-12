-- ==========================================
-- SECURITY HARDENING: Final grant corrections
-- ==========================================

-- ========== 1) user_roles: REMOVE INSERT/DELETE from authenticated ==========
-- Only SELECT is allowed for authenticated; all mutations via Edge Function
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
-- Confirm SELECT-only for authenticated
GRANT SELECT ON public.user_roles TO authenticated;

-- ========== 2) profiles: REMOVE UPDATE (not used by client) ==========
REVOKE UPDATE ON public.profiles FROM authenticated;
-- Keep SELECT only
GRANT SELECT ON public.profiles TO authenticated;

-- ========== 3) pecas_utilizadas: Add INSERT policy with strict WITH CHECK ==========
-- First, grant INSERT to authenticated
GRANT INSERT ON public.pecas_utilizadas TO authenticated;

-- Create a secure INSERT policy for pecas_utilizadas
-- Only allows inserting parts for OS belonging to user's company
CREATE POLICY "Users can insert pecas for their company OS"
ON public.pecas_utilizadas
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ordens_de_servico os
    WHERE os.id = ordem_id
      AND os.empresa_id = get_user_empresa_id(auth.uid())
  )
);

-- ========== 4) Ensure service_role maintains full access ==========
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.pecas_utilizadas TO service_role;