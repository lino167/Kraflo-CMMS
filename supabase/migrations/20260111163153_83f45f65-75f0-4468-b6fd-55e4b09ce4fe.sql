-- =====================================================
-- FASE 1: INTELIGÊNCIA DE DADOS - SISTEMA PREDITIVO
-- =====================================================

-- 1. VIEW: Timeline por TAG com detecção de reincidência
CREATE OR REPLACE VIEW public.v_tag_timeline AS
WITH ranked_os AS (
  SELECT 
    os.id,
    os.empresa_id,
    os.equipamento_tag,
    os.equipamento_nome,
    os.localizacao,
    os.data_abertura,
    os.data_fechamento,
    os.descricao_problema,
    os.diagnostico_solucao,
    os.notas_finais,
    os.tecnico_id,
    os.tipo_manutencao,
    os.status_os,
    os.prioridade,
    t.nome_completo AS tecnico_nome,
    LAG(os.data_fechamento) OVER (
      PARTITION BY os.empresa_id, os.equipamento_tag 
      ORDER BY os.data_abertura
    ) AS fechamento_anterior,
    LAG(os.diagnostico_solucao) OVER (
      PARTITION BY os.empresa_id, os.equipamento_tag 
      ORDER BY os.data_abertura
    ) AS solucao_anterior,
    LAG(os.tecnico_id) OVER (
      PARTITION BY os.empresa_id, os.equipamento_tag 
      ORDER BY os.data_abertura
    ) AS tecnico_anterior_id,
    LAG(t.nome_completo) OVER (
      PARTITION BY os.empresa_id, os.equipamento_tag 
      ORDER BY os.data_abertura
    ) AS tecnico_anterior_nome,
    ROW_NUMBER() OVER (
      PARTITION BY os.empresa_id, os.equipamento_tag 
      ORDER BY os.data_abertura DESC
    ) AS ordem_recente
  FROM public.ordens_de_servico os
  LEFT JOIN public.tecnicos t ON t.id_telegram = os.tecnico_id
  WHERE os.equipamento_tag IS NOT NULL
)
SELECT 
  r.*,
  CASE 
    WHEN r.fechamento_anterior IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (r.data_abertura - r.fechamento_anterior)) / 86400.0
    ELSE NULL
  END AS dias_desde_ultima_solucao,
  CASE 
    WHEN r.fechamento_anterior IS NOT NULL 
      AND EXTRACT(EPOCH FROM (r.data_abertura - r.fechamento_anterior)) / 86400.0 < 7 
    THEN 'reincidencia_critica'
    WHEN r.fechamento_anterior IS NOT NULL 
      AND EXTRACT(EPOCH FROM (r.data_abertura - r.fechamento_anterior)) / 86400.0 < 30 
    THEN 'reincidencia_alerta'
    ELSE 'ok'
  END AS status_reincidencia
FROM ranked_os r;

-- 2. VIEW: Performance do Técnico
CREATE OR REPLACE VIEW public.v_technician_performance AS
WITH tecnico_os AS (
  SELECT 
    os.tecnico_id,
    os.empresa_id,
    os.id AS os_id,
    os.data_abertura,
    os.data_fechamento,
    os.tipo_manutencao,
    os.status_os,
    os.equipamento_tag,
    EXTRACT(EPOCH FROM (os.data_fechamento - os.data_abertura)) / 3600.0 AS horas_reparo,
    -- Verifica se houve reincidência em 7 dias
    EXISTS (
      SELECT 1 FROM public.ordens_de_servico os2
      WHERE os2.equipamento_tag = os.equipamento_tag
        AND os2.empresa_id = os.empresa_id
        AND os2.id != os.id
        AND os2.data_abertura > os.data_fechamento
        AND os2.data_abertura <= os.data_fechamento + INTERVAL '7 days'
    ) AS teve_reincidencia_7d
  FROM public.ordens_de_servico os
  WHERE os.status_os IN ('Fechada', 'Liberado para produção')
    AND os.data_fechamento IS NOT NULL
),
os_por_tipo AS (
  SELECT 
    tecnico_id,
    empresa_id,
    COALESCE(tipo_manutencao, 'Não especificado') AS tipo,
    COUNT(*) AS quantidade
  FROM tecnico_os
  GROUP BY tecnico_id, empresa_id, tipo_manutencao
),
tipos_agregados AS (
  SELECT 
    tecnico_id,
    empresa_id,
    jsonb_object_agg(tipo, quantidade) AS os_por_tipo
  FROM os_por_tipo
  GROUP BY tecnico_id, empresa_id
),
-- OS "Herói" - problemas complexos resolvidos (abertos > 48h)
os_heroi AS (
  SELECT 
    tecnico_id,
    empresa_id,
    jsonb_agg(
      jsonb_build_object(
        'os_id', os_id,
        'equipamento_tag', equipamento_tag,
        'horas_aberto', horas_reparo,
        'data_fechamento', data_fechamento
      ) ORDER BY horas_reparo DESC
    ) FILTER (WHERE horas_reparo > 48) AS os_complexas
  FROM tecnico_os
  GROUP BY tecnico_id, empresa_id
)
SELECT 
  t.id_telegram AS tecnico_id,
  t.nome_completo,
  t.empresa_id,
  t.funcao,
  t.setor,
  COALESCE(COUNT(tos.os_id), 0)::bigint AS total_os_fechadas,
  COALESCE(AVG(tos.horas_reparo), 0) AS mttr_medio_horas,
  -- Quality Score: % de OS sem reincidência em 7 dias
  CASE 
    WHEN COUNT(tos.os_id) > 0 
    THEN ROUND(
      (COUNT(tos.os_id) FILTER (WHERE NOT tos.teve_reincidencia_7d))::numeric 
      / COUNT(tos.os_id)::numeric * 100, 1
    )
    ELSE 100
  END AS quality_score,
  -- Contagem de retrabalhos
  COALESCE(COUNT(tos.os_id) FILTER (WHERE tos.teve_reincidencia_7d), 0)::bigint AS total_retrabalhos,
  -- OS por tipo
  COALESCE(ta.os_por_tipo, '{}'::jsonb) AS os_por_tipo,
  -- OS complexas (herói)
  COALESCE(oh.os_complexas, '[]'::jsonb) AS os_heroi,
  -- Período de análise
  MIN(tos.data_abertura) AS primeira_os,
  MAX(tos.data_fechamento) AS ultima_os
FROM public.tecnicos t
LEFT JOIN tecnico_os tos ON tos.tecnico_id = t.id_telegram AND tos.empresa_id = t.empresa_id
LEFT JOIN tipos_agregados ta ON ta.tecnico_id = t.id_telegram AND ta.empresa_id = t.empresa_id
LEFT JOIN os_heroi oh ON oh.tecnico_id = t.id_telegram AND oh.empresa_id = t.empresa_id
GROUP BY t.id_telegram, t.nome_completo, t.empresa_id, t.funcao, t.setor, ta.os_por_tipo, oh.os_complexas;

-- 3. FUNÇÃO: Detector de Reincidência (Déjà-vu)
CREATE OR REPLACE FUNCTION public.fn_check_reincidencia(
  p_empresa_id UUID,
  p_tag TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_dias_limite INT DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB;
  v_ultima_os RECORD;
  v_total_recentes INT;
  v_tecnico_nome TEXT;
BEGIN
  -- Busca a última OS fechada para esta TAG
  SELECT 
    os.id,
    os.descricao_problema,
    os.diagnostico_solucao,
    os.data_fechamento,
    os.data_abertura,
    os.tecnico_id,
    t.nome_completo AS tecnico_nome,
    EXTRACT(EPOCH FROM (NOW() - os.data_fechamento)) / 86400.0 AS dias_desde_fechamento
  INTO v_ultima_os
  FROM public.ordens_de_servico os
  LEFT JOIN public.tecnicos t ON t.id_telegram = os.tecnico_id
  WHERE os.empresa_id = p_empresa_id
    AND os.equipamento_tag = p_tag
    AND os.status_os IN ('Fechada', 'Liberado para produção')
    AND os.data_fechamento >= NOW() - (p_dias_limite || ' days')::INTERVAL
  ORDER BY os.data_fechamento DESC
  LIMIT 1;
  
  -- Se não encontrou OS recente, retorna resultado vazio
  IF v_ultima_os.id IS NULL THEN
    RETURN jsonb_build_object(
      'encontrou', false,
      'total_recentes', 0
    );
  END IF;
  
  -- Conta total de OS para esta TAG no período
  SELECT COUNT(*)
  INTO v_total_recentes
  FROM public.ordens_de_servico
  WHERE empresa_id = p_empresa_id
    AND equipamento_tag = p_tag
    AND data_abertura >= NOW() - (p_dias_limite || ' days')::INTERVAL;
  
  -- Monta resultado
  v_result := jsonb_build_object(
    'encontrou', true,
    'total_recentes', v_total_recentes,
    'dias_limite', p_dias_limite,
    'ultima_os', jsonb_build_object(
      'id', v_ultima_os.id,
      'descricao_problema', v_ultima_os.descricao_problema,
      'diagnostico_solucao', v_ultima_os.diagnostico_solucao,
      'data_fechamento', v_ultima_os.data_fechamento,
      'tecnico_id', v_ultima_os.tecnico_id,
      'tecnico_nome', v_ultima_os.tecnico_nome,
      'dias_desde_fechamento', ROUND(v_ultima_os.dias_desde_fechamento::numeric, 1)
    )
  );
  
  RETURN v_result;
END;
$$;

-- 4. FUNÇÃO: Buscar histórico completo por TAG
CREATE OR REPLACE FUNCTION public.fn_get_tag_history(
  p_empresa_id UUID,
  p_tag TEXT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  os_id BIGINT,
  data_abertura TIMESTAMPTZ,
  data_fechamento TIMESTAMPTZ,
  descricao_problema TEXT,
  diagnostico_solucao TEXT,
  notas_finais TEXT,
  tecnico_nome TEXT,
  tipo_manutencao TEXT,
  status_os TEXT,
  horas_reparo NUMERIC,
  dias_desde_ultima_solucao NUMERIC,
  status_reincidencia TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    id AS os_id,
    data_abertura,
    data_fechamento,
    descricao_problema,
    diagnostico_solucao,
    notas_finais,
    tecnico_nome,
    tipo_manutencao,
    status_os::text,
    EXTRACT(EPOCH FROM (data_fechamento - data_abertura)) / 3600.0 AS horas_reparo,
    dias_desde_ultima_solucao,
    status_reincidencia
  FROM public.v_tag_timeline
  WHERE empresa_id = p_empresa_id
    AND equipamento_tag = p_tag
  ORDER BY data_abertura DESC
  LIMIT p_limit;
$$;

-- 5. FUNÇÃO: Estatísticas resumidas por TAG
CREATE OR REPLACE FUNCTION public.fn_get_tag_stats(
  p_empresa_id UUID,
  p_tag TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'tag', p_tag,
    'equipamento_nome', MAX(equipamento_nome),
    'localizacao', MAX(localizacao),
    'total_os', COUNT(*),
    'os_abertas', COUNT(*) FILTER (WHERE status_os = 'Aberta'),
    'os_fechadas', COUNT(*) FILTER (WHERE status_os IN ('Fechada', 'Liberado para produção')),
    'mttr_medio_horas', ROUND(AVG(
      EXTRACT(EPOCH FROM (data_fechamento - data_abertura)) / 3600.0
    ) FILTER (WHERE data_fechamento IS NOT NULL)::numeric, 1),
    'total_reincidencias_criticas', COUNT(*) FILTER (WHERE status_reincidencia = 'reincidencia_critica'),
    'total_reincidencias_alerta', COUNT(*) FILTER (WHERE status_reincidencia = 'reincidencia_alerta'),
    'primeira_os', MIN(data_abertura),
    'ultima_os', MAX(data_abertura),
    'tipos_manutencao', (
      SELECT jsonb_object_agg(tipo, qtd)
      FROM (
        SELECT COALESCE(tipo_manutencao, 'Não especificado') AS tipo, COUNT(*) AS qtd
        FROM public.v_tag_timeline vt
        WHERE vt.empresa_id = p_empresa_id AND vt.equipamento_tag = p_tag
        GROUP BY tipo_manutencao
      ) sub
    ),
    'tecnicos_frequentes', (
      SELECT jsonb_agg(jsonb_build_object('nome', tecnico_nome, 'total', total))
      FROM (
        SELECT tecnico_nome, COUNT(*) AS total
        FROM public.v_tag_timeline vt
        WHERE vt.empresa_id = p_empresa_id 
          AND vt.equipamento_tag = p_tag
          AND tecnico_nome IS NOT NULL
        GROUP BY tecnico_nome
        ORDER BY total DESC
        LIMIT 5
      ) sub
    )
  )
  INTO v_result
  FROM public.v_tag_timeline
  WHERE empresa_id = p_empresa_id
    AND equipamento_tag = p_tag;
  
  RETURN COALESCE(v_result, jsonb_build_object('tag', p_tag, 'total_os', 0));
END;
$$;