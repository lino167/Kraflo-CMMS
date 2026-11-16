-- =====================================================================
-- Separação de papéis no banco: administrador x técnico.
--
-- Esconder telas na interface não protege nada: quem decide é o RLS.
-- Em maio de 2026 a migration "permissoes_ilimitadas_tecnicos" deu escrita total
-- a qualquer usuário da empresa em OS, planos e execuções preventivas. Como as
-- políticas do Postgres se somam (basta uma permitir), isso deixava um técnico
-- apagar OS e criar ou excluir planos pela API, mesmo sem ver o botão.
--
-- O que muda para o TÉCNICO (o que ele faz no dia a dia continua igual):
--   OS ........................ abre e atualiza (fechar inclusive); NÃO exclui
--   execuções preventivas ..... lê e atualiza (iniciar/concluir); NÃO cria nem exclui
--   planos e tarefas .......... só lê
--   categorias e subcategorias  só lê
-- ADMIN da empresa e Admin Kraflo mantêm escrita total na empresa (Admin Kraflo, em todas).
--
-- Leitura não muda: continuam as políticas de SELECT por empresa.
-- Edge Functions e o bot usam service_role e não são afetados.
-- Rodar DEPOIS de 20261111120400_seguranca_funcoes_e_policies.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Ordens de serviço: técnico abre e atualiza; só administração exclui
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage their OS" ON public.ordens_de_servico;

DROP POLICY IF EXISTS "kraflo_os_empresa_insert" ON public.ordens_de_servico;
CREATE POLICY "kraflo_os_empresa_insert" ON public.ordens_de_servico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "kraflo_os_empresa_update" ON public.ordens_de_servico;
CREATE POLICY "kraflo_os_empresa_update" ON public.ordens_de_servico
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "kraflo_os_admin_delete" ON public.ordens_de_servico;
CREATE POLICY "kraflo_os_admin_delete" ON public.ordens_de_servico
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.is_company_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- 2) Planos e tarefas preventivas: escrita só da administração
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage plans" ON public.planos_manutencao;
DROP POLICY IF EXISTS "kraflo_planos_admin_write" ON public.planos_manutencao;
CREATE POLICY "kraflo_planos_admin_write" ON public.planos_manutencao
  FOR ALL TO authenticated
  USING (
    public.is_admin_kraflo(auth.uid())
    OR (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.is_company_admin(auth.uid()))
  )
  WITH CHECK (
    public.is_admin_kraflo(auth.uid())
    OR (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.is_company_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage tasks" ON public.tarefas_preventivas;
DROP POLICY IF EXISTS "kraflo_tarefas_admin_write" ON public.tarefas_preventivas;
CREATE POLICY "kraflo_tarefas_admin_write" ON public.tarefas_preventivas
  FOR ALL TO authenticated
  USING (
    public.is_admin_kraflo(auth.uid())
    OR (
      public.is_company_admin(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.planos_manutencao p
        WHERE p.id = tarefas_preventivas.plano_id
          AND p.empresa_id = public.get_user_empresa_id(auth.uid())
      )
    )
  )
  WITH CHECK (
    public.is_admin_kraflo(auth.uid())
    OR (
      public.is_company_admin(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.planos_manutencao p
        WHERE p.id = tarefas_preventivas.plano_id
          AND p.empresa_id = public.get_user_empresa_id(auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------
-- 3) Execuções preventivas: técnico lê e atualiza (iniciar/concluir);
--    só a administração cria (agendamento) e exclui
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage executions" ON public.execucoes_preventivas;

DROP POLICY IF EXISTS "kraflo_execucoes_empresa_update" ON public.execucoes_preventivas;
CREATE POLICY "kraflo_execucoes_empresa_update" ON public.execucoes_preventivas
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "kraflo_execucoes_admin_insert" ON public.execucoes_preventivas;
CREATE POLICY "kraflo_execucoes_admin_insert" ON public.execucoes_preventivas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_kraflo(auth.uid())
    OR (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.is_company_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "kraflo_execucoes_admin_delete" ON public.execucoes_preventivas;
CREATE POLICY "kraflo_execucoes_admin_delete" ON public.execucoes_preventivas
  FOR DELETE TO authenticated
  USING (
    public.is_admin_kraflo(auth.uid())
    OR (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.is_company_admin(auth.uid()))
  );

-- ---------------------------------------------------------------------
-- 4) Categorias (motivo de parada, causa raiz, subcategorias): escrita só da administração.
--    Nenhuma tela nem rotina grava categorias em nome do técnico.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuários podem inserir categorias de parada da sua empresa" ON public.categorias_parada;
DROP POLICY IF EXISTS "Usuários podem atualizar categorias de parada da sua empresa" ON public.categorias_parada;
DROP POLICY IF EXISTS "Usuários podem inserir categorias de problema da sua empresa" ON public.categorias_problema;
DROP POLICY IF EXISTS "Usuários podem atualizar categorias de problema da sua empresa" ON public.categorias_problema;
DROP POLICY IF EXISTS "Usuários podem inserir subcategorias da sua empresa" ON public.subcategorias;
DROP POLICY IF EXISTS "Usuários podem atualizar subcategorias da sua empresa" ON public.subcategorias;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categorias_parada', 'categorias_problema', 'subcategorias'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "kraflo_%1$s_admin_write" ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "kraflo_%1$s_admin_write" ON public.%1$I FOR ALL TO authenticated '
      'USING (public.is_admin_kraflo(auth.uid()) OR (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.is_company_admin(auth.uid()))) '
      'WITH CHECK (public.is_admin_kraflo(auth.uid()) OR (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.is_company_admin(auth.uid())))',
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Conferência (rodar à mão depois de aplicar): como técnico, estes comandos devem falhar,
-- e como administrador devem funcionar:
--   DELETE FROM public.ordens_de_servico WHERE id = <uma OS da empresa>;
--   INSERT INTO public.planos_manutencao (...) VALUES (...);
-- E como técnico estes continuam funcionando: abrir OS, fechar OS, iniciar preventiva.
-- ---------------------------------------------------------------------
