-- =====================================================================
-- COMO DESFAZER as migrations aplicadas em 16/11/2026 no banco de produção
-- (a 4 só vale se ela tiver sido aplicada):
--   1) 20261111120400_seguranca_funcoes_e_policies
--   2) 20261116120000_fechar_os_idempotencia_por_operacao
--   3) 20261116130000_separacao_admin_tecnico
--   4) 20261116140000_tecnico_exclui_as_proprias_os
--
-- Fica FORA de supabase/migrations de propósito: não deve rodar sozinho.
-- Use só se algo quebrar. Rode na ordem inversa (4, 3, 2, 1), um bloco por vez.
-- O estado anterior foi capturado de pg_policies e pg_proc antes de aplicar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- DESFAZER 4) técnico exclui as próprias OS (20261116140000) — só se tiver sido aplicada
-- Volta a exclusão só para a administração. A coluna criado_por pode ficar (é inofensiva).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "kraflo_os_delete_admin_ou_criador" ON public.ordens_de_servico;
CREATE POLICY "kraflo_os_admin_delete" ON public.ordens_de_servico
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.is_company_admin(auth.uid()));
DROP TRIGGER IF EXISTS trg_os_criado_por ON public.ordens_de_servico;
DROP FUNCTION IF EXISTS public.fn_os_criado_por();

-- ---------------------------------------------------------------------
-- DESFAZER 3) separação admin x técnico: volta a escrita ampla da empresa
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "kraflo_os_empresa_insert" ON public.ordens_de_servico;
DROP POLICY IF EXISTS "kraflo_os_empresa_update" ON public.ordens_de_servico;
DROP POLICY IF EXISTS "kraflo_os_admin_delete" ON public.ordens_de_servico;
CREATE POLICY "Users can manage their OS" ON public.ordens_de_servico
  FOR ALL TO public
  USING (empresa_id = get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "kraflo_planos_admin_write" ON public.planos_manutencao;
CREATE POLICY "Users can manage plans" ON public.planos_manutencao
  FOR ALL TO public
  USING (empresa_id = get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "kraflo_tarefas_admin_write" ON public.tarefas_preventivas;
CREATE POLICY "Users can manage tasks" ON public.tarefas_preventivas
  FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM planos_manutencao p WHERE p.id = tarefas_preventivas.plano_id AND p.empresa_id = get_user_empresa_id(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM planos_manutencao p WHERE p.id = tarefas_preventivas.plano_id AND p.empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "kraflo_execucoes_empresa_update" ON public.execucoes_preventivas;
DROP POLICY IF EXISTS "kraflo_execucoes_admin_insert" ON public.execucoes_preventivas;
DROP POLICY IF EXISTS "kraflo_execucoes_admin_delete" ON public.execucoes_preventivas;
CREATE POLICY "Users can manage executions" ON public.execucoes_preventivas
  FOR ALL TO public
  USING (empresa_id = get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "kraflo_categorias_parada_admin_write" ON public.categorias_parada;
DROP POLICY IF EXISTS "kraflo_categorias_problema_admin_write" ON public.categorias_problema;
DROP POLICY IF EXISTS "kraflo_subcategorias_admin_write" ON public.subcategorias;
CREATE POLICY "Usuários podem inserir categorias de parada da sua empresa" ON public.categorias_parada
  FOR INSERT TO public WITH CHECK (empresa_id IN (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Usuários podem atualizar categorias de parada da sua empresa" ON public.categorias_parada
  FOR UPDATE TO public USING (empresa_id IN (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = (SELECT auth.uid())));
CREATE POLICY "Usuários podem inserir categorias de problema da sua empresa" ON public.categorias_problema
  FOR INSERT TO public WITH CHECK (empresa_id IN (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Usuários podem atualizar categorias de problema da sua empresa" ON public.categorias_problema
  FOR UPDATE TO public USING (empresa_id IN (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = (SELECT auth.uid())));
CREATE POLICY "Usuários podem inserir subcategorias da sua empresa" ON public.subcategorias
  FOR INSERT TO public WITH CHECK (empresa_id IN (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Usuários podem atualizar subcategorias da sua empresa" ON public.subcategorias
  FOR UPDATE TO public USING (empresa_id IN (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = (SELECT auth.uid())));

-- ---------------------------------------------------------------------
-- DESFAZER 2) idempotência do fechamento: volta a função de 10 argumentos.
-- Depois rode de novo o conteúdo de 20261111120500_campo_fechar_os_atomico.sql.
-- A coluna fechamento_op_id pode ficar (é inofensiva).
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_campo_fechar_os(bigint, uuid, text, text, text, uuid, uuid, timestamptz, jsonb, text, uuid);
-- >>> agora execute o arquivo supabase/migrations/20261111120500_campo_fechar_os_atomico.sql <<<

-- ---------------------------------------------------------------------
-- DESFAZER 1) endurecimento de segurança: volta as políticas antigas e as funções ao estado anterior
-- ---------------------------------------------------------------------
CREATE POLICY "Admins can manage their company's machines" ON public.maquinas
  FOR ALL TO public USING (empresa_id IN (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Admins can manage their company's sectors" ON public.setores
  FOR ALL TO public USING (empresa_id IN (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Empresa insert guest_links" ON public.links_acesso_convidado
  FOR INSERT TO public WITH CHECK (empresa_id = (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Empresa update guest_links" ON public.links_acesso_convidado
  FOR UPDATE TO public USING (empresa_id = (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Empresa delete guest_links" ON public.links_acesso_convidado
  FOR DELETE TO public USING (empresa_id = (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Empresa insert checklists" ON public.templates_checklist
  FOR INSERT TO public WITH CHECK (empresa_id = (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Empresa delete checklists" ON public.templates_checklist
  FOR DELETE TO public USING (empresa_id = (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Empresa update orcamentos" ON public.orcamentos_manutencao
  FOR UPDATE TO public USING (empresa_id = (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Empresa insert orcamentos" ON public.orcamentos_manutencao
  FOR INSERT TO public WITH CHECK (empresa_id = (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()));

-- Funções: estado anterior era SECURITY DEFINER com execução liberada a todos (PUBLIC, anon, authenticated, service_role).
-- get_parts_history_by_company já era SECURITY INVOKER; handle_new_user já tinha execução só para postgres e service_role.
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'fn_check_reincidencia', 'fn_get_tag_history', 'fn_get_tag_stats',
        'get_critical_equipment', 'get_monthly_trend', 'get_quarterly_trend',
        'get_yearly_trend', 'get_service_type_breakdown', 'get_tag_analysis',
        'classificar_os_retroativo', 'search_manual_chunks', 'search_os_similares',
        'enqueue_os_for_indexing', 'trigger_enqueue_os_index', 'enqueue_os_index',
        'fn_registrar_historico_os', 'fn_concluir_execucao_preventiva',
        'fn_aplicar_movimentacao_estoque', 'fn_baixar_estoque_peca_utilizada'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC, anon, authenticated, service_role', f.sig);
  END LOOP;
END $$;
