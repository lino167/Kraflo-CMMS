-- ==========================================
-- FIX: Adjust pecas_utilizadas policy with actual status_os values
-- ==========================================

-- Valores reais de status_os: 'Em manutenção', 'Fechada', 'Liberado para produção', 'Não liberado'
-- Default no schema: 'Aberta'
-- Estados finais (bloquear INSERT de peças): 'Fechada', 'Liberado para produção'

DROP POLICY IF EXISTS "Users can insert pecas for their company open OS" ON public.pecas_utilizadas;

CREATE POLICY "Users can insert pecas for their company open OS"
ON public.pecas_utilizadas
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ordens_de_servico os
    WHERE os.id = ordem_id
      AND os.empresa_id = get_user_empresa_id(auth.uid())
      AND os.status_os NOT IN ('Fechada', 'Liberado para produção')
  )
);

-- ==========================================
-- DOCUMENTATION: Add comment explaining authorization model
-- ==========================================
COMMENT ON TABLE public.user_roles IS 
'Modelo A de autorização:
- admin_kraflo: role GLOBAL, acesso total ao sistema
- admin_empresa: role EMPRESA-SCOPED, escopo vem de profiles.empresa_id do usuário
- user_roles NÃO carrega empresa_id (escopo é derivado do profile)
- Toda mutação de roles via Edge Function admin-roles (service_role) com auditoria em logs';