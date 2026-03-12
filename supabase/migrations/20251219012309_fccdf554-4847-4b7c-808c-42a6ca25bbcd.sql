-- ==========================================
-- COMPLETE STATUS_OS STATE MACHINE IMPLEMENTATION (CORRECT ORDER)
-- ==========================================

-- ========== 0) Drop ENUM criado na tentativa anterior ==========
DROP TYPE IF EXISTS public.os_status;

-- ========== 1) Drop policies que dependem de status_os ==========
DROP POLICY IF EXISTS "Users can insert pecas for their company open OS" ON public.pecas_utilizadas;
DROP POLICY IF EXISTS "Admin Empresa can update their OS" ON public.ordens_de_servico;

-- ========== 2) Criar ENUM ==========
CREATE TYPE public.os_status AS ENUM (
  'Aberta',
  'Em manutenção', 
  'Não liberado',
  'Fechada',
  'Liberado para produção'
);

-- ========== 3) Alterar coluna para ENUM ==========
ALTER TABLE public.ordens_de_servico 
  ALTER COLUMN status_os DROP DEFAULT;

ALTER TABLE public.ordens_de_servico 
  ALTER COLUMN status_os TYPE public.os_status 
  USING status_os::public.os_status;

ALTER TABLE public.ordens_de_servico 
  ALTER COLUMN status_os SET DEFAULT 'Aberta'::public.os_status;

-- ========== 4) Recriar policy de pecas_utilizadas ==========
CREATE POLICY "Users can insert pecas for their company open OS"
ON public.pecas_utilizadas
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ordens_de_servico os
    WHERE os.id = ordem_id
      AND os.empresa_id = get_user_empresa_id(auth.uid())
      AND os.status_os IN ('Aberta', 'Em manutenção')
  )
);

COMMENT ON POLICY "Users can insert pecas for their company open OS" ON public.pecas_utilizadas IS
'Regra de negócio: peças só podem ser adicionadas em OS ativas.
Estados permitidos: Aberta, Em manutenção
Estados bloqueados (finais): Não liberado, Fechada, Liberado para produção';

-- ========== 5) Recriar policy de UPDATE em ordens_de_servico ==========
CREATE POLICY "Admin Empresa can update their OS"
ON public.ordens_de_servico
FOR UPDATE
TO authenticated
USING (
  empresa_id = get_user_empresa_id(auth.uid())
  AND (
    is_admin_kraflo(auth.uid())
    OR has_role(auth.uid(), 'admin_empresa')
    OR status_os IN ('Aberta', 'Em manutenção')
  )
);

COMMENT ON POLICY "Admin Empresa can update their OS" ON public.ordens_de_servico IS
'Regra de negócio:
- admin_kraflo e admin_empresa podem editar OS em qualquer estado
- Técnicos só podem editar OS em estados ativos (Aberta, Em manutenção)
- Estados finais (Não liberado, Fechada, Liberado para produção) bloqueiam edição por técnico';

-- ========== 6) Documentar state machine ==========
COMMENT ON TYPE public.os_status IS
'State Machine de Ordem de Serviço:
Estados ATIVOS (permitem edição/peças): Aberta, Em manutenção
Estados FINAIS (bloqueiam): Não liberado, Fechada, Liberado para produção';