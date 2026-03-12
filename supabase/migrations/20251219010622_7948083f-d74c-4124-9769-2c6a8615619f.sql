-- ==========================================
-- CLEANUP: Remove redundant policies and add business rules
-- ==========================================

-- ========== 1) user_roles: Remove redundant "ALL" policy ==========
-- Since authenticated has no GRANT for writes, this policy is useless
-- and could confuse future audits. Keep only SELECT policies.
DROP POLICY IF EXISTS "Admin Kraflo can manage roles" ON public.user_roles;

-- ========== 2) pecas_utilizadas: Add business rule - only for open/in-progress OS ==========
-- Drop the existing policy and recreate with stricter rules
DROP POLICY IF EXISTS "Users can insert pecas for their company OS" ON public.pecas_utilizadas;

-- Recreate with business logic: OS must be open (not closed)
CREATE POLICY "Users can insert pecas for their company open OS"
ON public.pecas_utilizadas
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ordens_de_servico os
    WHERE os.id = ordem_id
      AND os.empresa_id = get_user_empresa_id(auth.uid())
      AND os.status_os NOT IN ('Fechada', 'Cancelada')
  )
);