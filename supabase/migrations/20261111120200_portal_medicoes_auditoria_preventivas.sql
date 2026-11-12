-- =====================================================================
-- 1) Portal público de solicitações (via token do link de convidado)
-- 2) Medições de condição persistidas
-- 3) Trilha de auditoria da OS
-- 4) Automação das preventivas (atraso, rolagem de agenda, conclusão)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PORTAL DE SOLICITAÇÕES
-- O visitante não tem acesso a nenhuma tabela: tudo passa por funções
-- SECURITY DEFINER que validam o token.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_portal_link_valido(p_token text)
RETURNS public.links_acesso_convidado
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.*
  FROM public.links_acesso_convidado l
  WHERE l.token = p_token
    AND length(coalesce(p_token, '')) >= 16
    AND l.ativo
    AND (l.expires_at IS NULL OR l.expires_at > now())
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.fn_portal_link_valido(text) FROM PUBLIC, anon, authenticated;

-- Dados mínimos para montar o formulário: nome da empresa e lista de ativos
CREATE OR REPLACE FUNCTION public.fn_portal_info(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.links_acesso_convidado;
BEGIN
  v_link := public.fn_portal_link_valido(p_token);
  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object('valido', false);
  END IF;

  RETURN jsonb_build_object(
    'valido', true,
    'empresa_nome', (SELECT e.nome_empresa FROM public.empresas e WHERE e.id = v_link.empresa_id),
    'equipamentos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('nome', x.nome, 'tag', x.tag, 'setor', x.setor) ORDER BY x.nome)
      FROM (
        SELECT m.nome, m.tag, s.nome AS setor
        FROM public.maquinas m
        LEFT JOIN public.setores s ON s.id = m.setor_id
        WHERE m.empresa_id = v_link.empresa_id
          AND coalesce(m.situacao, 'ativo') <> 'inativo'
        ORDER BY m.nome
        LIMIT 500
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_portal_criar_solicitacao(
  p_token text,
  p_equipamento_nome text,
  p_descricao text,
  p_solicitante_nome text,
  p_equipamento_tag text DEFAULT NULL,
  p_localizacao text DEFAULT NULL,
  p_prioridade text DEFAULT 'Média',
  p_solicitante_contato text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.links_acesso_convidado;
  v_id uuid;
  v_equip text := btrim(coalesce(p_equipamento_nome, ''));
  v_desc text := btrim(coalesce(p_descricao, ''));
  v_nome text := btrim(coalesce(p_solicitante_nome, ''));
BEGIN
  v_link := public.fn_portal_link_valido(p_token);
  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'Link inválido ou expirado' USING ERRCODE = '28000';
  END IF;

  IF length(v_equip) NOT BETWEEN 2 AND 150 THEN
    RAISE EXCEPTION 'Informe o equipamento (2 a 150 caracteres)' USING ERRCODE = '22023';
  END IF;
  IF length(v_desc) NOT BETWEEN 5 AND 2000 THEN
    RAISE EXCEPTION 'Descreva o problema (5 a 2000 caracteres)' USING ERRCODE = '22023';
  END IF;
  IF length(v_nome) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Informe seu nome (2 a 120 caracteres)' USING ERRCODE = '22023';
  END IF;
  IF p_prioridade NOT IN ('Baixa', 'Média', 'Alta', 'Urgente') THEN
    RAISE EXCEPTION 'Prioridade inválida' USING ERRCODE = '22023';
  END IF;

  -- Limite simples contra abuso: 20 solicitações por link por hora
  IF (SELECT count(*) FROM public.solicitacoes_manutencao
       WHERE link_id = v_link.id AND created_at > now() - interval '1 hour') >= 20 THEN
    RAISE EXCEPTION 'Muitas solicitações em pouco tempo. Tente novamente mais tarde.' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.solicitacoes_manutencao (
    empresa_id, equipamento_nome, equipamento_tag, localizacao, descricao,
    prioridade, solicitante_nome, solicitante_contato, link_id
  ) VALUES (
    v_link.empresa_id, v_equip, nullif(left(btrim(p_equipamento_tag), 60), ''),
    nullif(left(btrim(p_localizacao), 150), ''), v_desc,
    p_prioridade, v_nome, nullif(left(btrim(p_solicitante_contato), 120), ''), v_link.id
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'protocolo', upper(left(v_id::text, 8)));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_portal_info(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_portal_criar_solicitacao(text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_portal_info(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_portal_criar_solicitacao(text, text, text, text, text, text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) MEDIÇÕES DE CONDIÇÃO
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medicoes_ativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  equipamento_nome text NOT NULL,
  equipamento_tag text,
  variavel text NOT NULL,
  valor numeric NOT NULL,
  min_esperado numeric NOT NULL,
  max_esperado numeric NOT NULL,
  critico boolean GENERATED ALWAYS AS (valor < min_esperado OR valor > max_esperado) STORED,
  alerta_tratado boolean NOT NULL DEFAULT false,
  os_gerada_id bigint REFERENCES public.ordens_de_servico(id) ON DELETE SET NULL,
  registrado_por uuid DEFAULT auth.uid(),
  data_medicao timestamptz NOT NULL DEFAULT now(),
  CHECK (min_esperado <= max_esperado)
);
CREATE INDEX IF NOT EXISTS idx_medicoes_empresa_data ON public.medicoes_ativos (empresa_id, data_medicao DESC);

ALTER TABLE public.medicoes_ativos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kraflo_medicoes_select" ON public.medicoes_ativos;
CREATE POLICY "kraflo_medicoes_select" ON public.medicoes_ativos
FOR SELECT TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_admin_kraflo(auth.uid()));

DROP POLICY IF EXISTS "kraflo_medicoes_insert" ON public.medicoes_ativos;
CREATE POLICY "kraflo_medicoes_insert" ON public.medicoes_ativos
FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "kraflo_medicoes_update" ON public.medicoes_ativos;
CREATE POLICY "kraflo_medicoes_update" ON public.medicoes_ativos
FOR UPDATE TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()))
WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

-- ---------------------------------------------------------------------
-- 3) TRILHA DE AUDITORIA DA OS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.os_historico (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ordem_id bigint NOT NULL REFERENCES public.ordens_de_servico(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  evento text NOT NULL CHECK (evento IN ('criada', 'status', 'atribuicao', 'prioridade')),
  valor_anterior text,
  valor_novo text,
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_os_historico_ordem ON public.os_historico (ordem_id, created_at);

ALTER TABLE public.os_historico ENABLE ROW LEVEL SECURITY;

-- Somente leitura para o cliente; a escrita acontece só pelo trigger.
DROP POLICY IF EXISTS "kraflo_os_historico_select" ON public.os_historico;
CREATE POLICY "kraflo_os_historico_select" ON public.os_historico
FOR SELECT TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_admin_kraflo(auth.uid()));

CREATE OR REPLACE FUNCTION public.fn_registrar_historico_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = v_uid;
  END IF;
  v_nome := coalesce(v_nome, CASE WHEN v_uid IS NULL THEN 'Sistema / Bot' ELSE 'Usuário' END);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.os_historico (ordem_id, empresa_id, evento, valor_novo, usuario_id, usuario_nome)
    VALUES (NEW.id, NEW.empresa_id, 'criada', NEW.status_os::text, v_uid, v_nome);
    RETURN NEW;
  END IF;

  IF NEW.status_os IS DISTINCT FROM OLD.status_os THEN
    INSERT INTO public.os_historico (ordem_id, empresa_id, evento, valor_anterior, valor_novo, usuario_id, usuario_nome)
    VALUES (NEW.id, NEW.empresa_id, 'status', OLD.status_os::text, NEW.status_os::text, v_uid, v_nome);
  END IF;

  IF NEW.tecnico_id IS DISTINCT FROM OLD.tecnico_id THEN
    INSERT INTO public.os_historico (ordem_id, empresa_id, evento, valor_anterior, valor_novo, usuario_id, usuario_nome)
    VALUES (
      NEW.id, NEW.empresa_id, 'atribuicao',
      (SELECT nome_completo FROM public.tecnicos WHERE id_telegram = OLD.tecnico_id),
      (SELECT nome_completo FROM public.tecnicos WHERE id_telegram = NEW.tecnico_id),
      v_uid, v_nome
    );
  END IF;

  IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
    INSERT INTO public.os_historico (ordem_id, empresa_id, evento, valor_anterior, valor_novo, usuario_id, usuario_nome)
    VALUES (NEW.id, NEW.empresa_id, 'prioridade', OLD.prioridade, NEW.prioridade, v_uid, v_nome);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registrar_historico_os ON public.ordens_de_servico;
CREATE TRIGGER trg_registrar_historico_os
AFTER INSERT OR UPDATE ON public.ordens_de_servico
FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_historico_os();

-- ---------------------------------------------------------------------
-- 4) PREVENTIVAS
-- ---------------------------------------------------------------------

-- 4a) Fechar a OS conclui a execução preventiva que a originou
CREATE OR REPLACE FUNCTION public.fn_concluir_execucao_preventiva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.execucao_origem_id IS NOT NULL
     AND NEW.status_os IN ('Fechada', 'Liberado para produção')
     AND OLD.status_os NOT IN ('Fechada', 'Liberado para produção') THEN
    UPDATE public.execucoes_preventivas
       SET status = 'concluida',
           executado_em = coalesce(NEW.data_fechamento, now()),
           os_gerada_id = NEW.id
     WHERE id = NEW.execucao_origem_id
       AND status <> 'cancelada';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_concluir_execucao_preventiva ON public.ordens_de_servico;
CREATE TRIGGER trg_concluir_execucao_preventiva
AFTER UPDATE OF status_os ON public.ordens_de_servico
FOR EACH ROW EXECUTE FUNCTION public.fn_concluir_execucao_preventiva();

-- 4b) Rotina diária: marca atrasadas e mantém 90 dias de agenda à frente.
--     Só estende tarefas que já têm agenda (quem optou por não agendar segue manual).
CREATE OR REPLACE FUNCTION public.fn_processar_preventivas(p_horizonte_dias int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atrasadas int;
  v_geradas int := 0;
  r record;
  v_data date;
BEGIN
  UPDATE public.execucoes_preventivas
     SET status = 'atrasada'
   WHERE status = 'agendada' AND agendado_para < current_date;
  GET DIAGNOSTICS v_atrasadas = ROW_COUNT;

  FOR r IN
    SELECT t.id AS tarefa_id, p.empresa_id, t.intervalo_dias, max(e.agendado_para)::date AS ultima
    FROM public.tarefas_preventivas t
    JOIN public.planos_manutencao p ON p.id = t.plano_id AND p.ativo
    JOIN public.execucoes_preventivas e ON e.tarefa_id = t.id
    WHERE t.ativo AND t.intervalo_dias > 0
    GROUP BY t.id, p.empresa_id, t.intervalo_dias
  LOOP
    v_data := r.ultima + r.intervalo_dias;
    -- Plano parado há muito tempo: recomeça a partir de hoje, sem criar passivo de atrasadas
    IF v_data < current_date THEN
      v_data := current_date + r.intervalo_dias;
    END IF;
    WHILE v_data <= current_date + p_horizonte_dias LOOP
      INSERT INTO public.execucoes_preventivas (tarefa_id, empresa_id, agendado_para, status)
      VALUES (r.tarefa_id, r.empresa_id, v_data, 'agendada');
      v_geradas := v_geradas + 1;
      v_data := v_data + r.intervalo_dias;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('atrasadas', v_atrasadas, 'geradas', v_geradas);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_processar_preventivas(int) FROM PUBLIC, anon, authenticated;

-- Agenda diária (03:15 UTC) quando o pg_cron estiver disponível
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('processar-preventivas')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processar-preventivas');
    PERFORM cron.schedule('processar-preventivas', '15 3 * * *', 'SELECT public.fn_processar_preventivas()');
  END IF;
END $$;

-- 4c) Indicador de cumprimento do plano preventivo (PM compliance) por empresa
CREATE OR REPLACE VIEW public.v_preventivas_cumprimento
WITH (security_invoker = true) AS
SELECT
  empresa_id,
  count(*) FILTER (WHERE agendado_para <= current_date AND status <> 'cancelada')::int AS previstas,
  count(*) FILTER (WHERE status = 'concluida')::int AS concluidas,
  count(*) FILTER (WHERE status = 'atrasada' OR (status = 'agendada' AND agendado_para < current_date))::int AS atrasadas
FROM public.execucoes_preventivas
WHERE agendado_para >= current_date - 90
GROUP BY empresa_id;

GRANT SELECT ON public.v_preventivas_cumprimento TO authenticated;
