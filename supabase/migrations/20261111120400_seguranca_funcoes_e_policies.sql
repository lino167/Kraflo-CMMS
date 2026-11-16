-- =====================================================================
-- Endurecimento de segurança
-- 1) Funções com dados por empresa deixam de rodar com privilégio do dono
--    (SECURITY DEFINER) e passam a respeitar o RLS de quem chama.
-- 2) Visitante anônimo perde o direito de executar funções internas.
-- 3) Policies antigas que davam escrita a qualquer membro são removidas;
--    passam a valer as regras "kraflo_*" (cadastros e aprovações só para admin).
-- Edge Functions e o bot usam service_role e não são afetados.
-- =====================================================================

DO $$
DECLARE
  f record;
BEGIN
  -- 1) Consultas e rotinas parametrizadas por empresa: RLS de quem chama
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'fn_check_reincidencia', 'fn_get_tag_history', 'fn_get_tag_stats',
        'get_critical_equipment', 'get_monthly_trend', 'get_quarterly_trend',
        'get_yearly_trend', 'get_service_type_breakdown', 'get_tag_analysis',
        'classificar_os_retroativo', 'search_manual_chunks', 'search_os_similares',
        'get_parts_history_by_company'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', f.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;

  -- 2) Funções de trigger e de fila: ninguém chama pela API
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'handle_new_user', 'enqueue_os_for_indexing', 'trigger_enqueue_os_index', 'enqueue_os_index',
        'fn_registrar_historico_os', 'fn_concluir_execucao_preventiva',
        'fn_aplicar_movimentacao_estoque', 'fn_baixar_estoque_peca_utilizada'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- 3) Policies antigas, permissivas demais
DROP POLICY IF EXISTS "Admins can manage their company's machines" ON public.maquinas;
DROP POLICY IF EXISTS "Admins can manage their company's sectors" ON public.setores;
DROP POLICY IF EXISTS "Empresa insert guest_links" ON public.links_acesso_convidado;
DROP POLICY IF EXISTS "Empresa update guest_links" ON public.links_acesso_convidado;
DROP POLICY IF EXISTS "Empresa delete guest_links" ON public.links_acesso_convidado;
DROP POLICY IF EXISTS "Empresa insert checklists" ON public.templates_checklist;
DROP POLICY IF EXISTS "Empresa delete checklists" ON public.templates_checklist;
DROP POLICY IF EXISTS "Empresa update orcamentos" ON public.orcamentos_manutencao;
DROP POLICY IF EXISTS "Empresa insert orcamentos" ON public.orcamentos_manutencao;
