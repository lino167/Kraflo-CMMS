-- ==============================================
-- PROMPT 1-2: Auditoria + Índices para Relatórios
-- ==============================================

-- Índices para queries analíticas frequentes
CREATE INDEX IF NOT EXISTS idx_os_empresa_abertura ON public.ordens_de_servico(empresa_id, data_abertura);
CREATE INDEX IF NOT EXISTS idx_os_empresa_status ON public.ordens_de_servico(empresa_id, status_os);
CREATE INDEX IF NOT EXISTS idx_os_empresa_tipo ON public.ordens_de_servico(empresa_id, tipo_manutencao);
CREATE INDEX IF NOT EXISTS idx_os_empresa_fechamento ON public.ordens_de_servico(empresa_id, data_fechamento);
CREATE INDEX IF NOT EXISTS idx_os_empresa_tag ON public.ordens_de_servico(empresa_id, equipamento_tag);
CREATE INDEX IF NOT EXISTS idx_os_empresa_equipamento ON public.ordens_de_servico(empresa_id, equipamento_nome);

-- ==============================================
-- PROMPT 3: View v_os_analytics
-- ==============================================
CREATE OR REPLACE VIEW public.v_os_analytics AS
SELECT
  os.id AS os_id,
  os.empresa_id,
  os.equipamento_nome,
  os.equipamento_tag,
  os.localizacao AS setor,
  os.tipo_manutencao AS tipo_servico,
  os.status_os,
  os.prioridade,
  os.data_abertura AS opened_at,
  os.data_fechamento AS closed_at,
  CASE 
    WHEN os.data_fechamento IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (os.data_fechamento - os.data_abertura)) / 3600.0
    ELSE NULL
  END AS repair_hours,
  os.descricao_problema,
  os.diagnostico_solucao,
  os.index_status,
  os.tecnico_id,
  os.origem,
  os.created_at
FROM public.ordens_de_servico os;

-- ==============================================
-- PROMPT 4: View de agregação mensal
-- ==============================================
CREATE OR REPLACE VIEW public.v_report_monthly AS
SELECT
  empresa_id,
  EXTRACT(YEAR FROM data_abertura)::int AS year,
  EXTRACT(MONTH FROM data_abertura)::int AS month,
  tipo_manutencao AS tipo_servico,
  COUNT(*) AS total_os,
  COUNT(*) FILTER (WHERE status_os = 'Fechada') AS os_fechadas,
  COUNT(*) FILTER (WHERE status_os != 'Fechada') AS os_abertas,
  COALESCE(
    AVG(EXTRACT(EPOCH FROM (data_fechamento - data_abertura)) / 3600.0) 
    FILTER (WHERE data_fechamento IS NOT NULL),
    0
  ) AS mttr_hours,
  CASE 
    WHEN COUNT(*) > 0 
    THEN (COUNT(*) FILTER (WHERE status_os = 'Fechada')::numeric / COUNT(*)::numeric) * 100
    ELSE 0
  END AS resolution_rate
FROM public.ordens_de_servico
GROUP BY empresa_id, EXTRACT(YEAR FROM data_abertura), EXTRACT(MONTH FROM data_abertura), tipo_manutencao;

-- ==============================================
-- PROMPT 5: View de agregação trimestral
-- ==============================================
CREATE OR REPLACE VIEW public.v_report_quarterly AS
SELECT
  empresa_id,
  EXTRACT(YEAR FROM data_abertura)::int AS year,
  EXTRACT(QUARTER FROM data_abertura)::int AS quarter,
  tipo_manutencao AS tipo_servico,
  COUNT(*) AS total_os,
  COUNT(*) FILTER (WHERE status_os = 'Fechada') AS os_fechadas,
  COUNT(*) FILTER (WHERE status_os != 'Fechada') AS os_abertas,
  COALESCE(
    AVG(EXTRACT(EPOCH FROM (data_fechamento - data_abertura)) / 3600.0) 
    FILTER (WHERE data_fechamento IS NOT NULL),
    0
  ) AS mttr_hours,
  CASE 
    WHEN COUNT(*) > 0 
    THEN (COUNT(*) FILTER (WHERE status_os = 'Fechada')::numeric / COUNT(*)::numeric) * 100
    ELSE 0
  END AS resolution_rate
FROM public.ordens_de_servico
GROUP BY empresa_id, EXTRACT(YEAR FROM data_abertura), EXTRACT(QUARTER FROM data_abertura), tipo_manutencao;

-- ==============================================
-- PROMPT 6: View de agregação anual
-- ==============================================
CREATE OR REPLACE VIEW public.v_report_yearly AS
SELECT
  empresa_id,
  EXTRACT(YEAR FROM data_abertura)::int AS year,
  tipo_manutencao AS tipo_servico,
  COUNT(*) AS total_os,
  COUNT(*) FILTER (WHERE status_os = 'Fechada') AS os_fechadas,
  COUNT(*) FILTER (WHERE status_os != 'Fechada') AS os_abertas,
  COALESCE(
    AVG(EXTRACT(EPOCH FROM (data_fechamento - data_abertura)) / 3600.0) 
    FILTER (WHERE data_fechamento IS NOT NULL),
    0
  ) AS mttr_hours,
  CASE 
    WHEN COUNT(*) > 0 
    THEN (COUNT(*) FILTER (WHERE status_os = 'Fechada')::numeric / COUNT(*)::numeric) * 100
    ELSE 0
  END AS resolution_rate
FROM public.ordens_de_servico
GROUP BY empresa_id, EXTRACT(YEAR FROM data_abertura), tipo_manutencao;

-- ==============================================
-- PROMPT 7: View de saúde por equipamento (CORRIGIDA)
-- ==============================================
CREATE OR REPLACE VIEW public.v_equipment_health AS
WITH equipment_failures AS (
  SELECT
    os.empresa_id,
    os.equipamento_nome,
    os.equipamento_tag,
    os.localizacao AS setor,
    COUNT(*) AS total_falhas,
    COUNT(*) FILTER (WHERE os.status_os = 'Fechada') AS falhas_resolvidas,
    COALESCE(
      AVG(EXTRACT(EPOCH FROM (os.data_fechamento - os.data_abertura)) / 3600.0) 
      FILTER (WHERE os.data_fechamento IS NOT NULL),
      0
    ) AS mttr_hours,
    MAX(os.data_abertura) AS ultima_falha,
    MIN(os.data_abertura) AS primeira_falha,
    ARRAY_AGG(DISTINCT os.tipo_manutencao) FILTER (WHERE os.tipo_manutencao IS NOT NULL) AS tipos_servico,
    COUNT(*) FILTER (WHERE os.data_abertura >= NOW() - INTERVAL '30 days') AS falhas_30d
  FROM public.ordens_de_servico os
  WHERE os.tipo_manutencao IN ('Corretiva', 'corretiva', 'CORRETIVA') OR os.tipo_manutencao IS NULL
  GROUP BY os.empresa_id, os.equipamento_nome, os.equipamento_tag, os.localizacao
)
SELECT
  ef.empresa_id,
  ef.equipamento_nome,
  ef.equipamento_tag,
  ef.setor,
  ef.total_falhas,
  ef.falhas_resolvidas,
  ef.mttr_hours,
  CASE 
    WHEN ef.total_falhas > 1 
    THEN EXTRACT(EPOCH FROM (ef.ultima_falha - ef.primeira_falha)) / 86400.0 / (ef.total_falhas - 1)
    WHEN ef.total_falhas = 1 
    THEN EXTRACT(EPOCH FROM (NOW() - ef.primeira_falha)) / 86400.0
    ELSE 999
  END AS mtbf_days,
  CASE 
    WHEN ef.total_falhas > 0 
    THEN (ef.falhas_30d::numeric / ef.total_falhas::numeric) * 100
    ELSE 0
  END AS reincidencia_30d,
  ef.tipos_servico,
  ef.ultima_falha,
  ef.falhas_30d,
  CASE 
    WHEN ef.total_falhas > 1 
    THEN (ef.total_falhas * (1 + (ef.falhas_30d::numeric / ef.total_falhas::numeric)) * (1 + ef.mttr_hours/24)) 
         / NULLIF(EXTRACT(EPOCH FROM (ef.ultima_falha - ef.primeira_falha)) / 86400.0 / (ef.total_falhas - 1), 0)
    ELSE ef.total_falhas * 10
  END AS score_criticidade
FROM equipment_failures ef;

-- ==============================================
-- Funções auxiliares para tendências
-- ==============================================
CREATE OR REPLACE FUNCTION public.get_monthly_trend(
  p_empresa_id uuid,
  p_months int DEFAULT 12
)
RETURNS TABLE (
  year int,
  month int,
  total_os bigint,
  os_fechadas bigint,
  mttr_hours numeric,
  resolution_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    v.year,
    v.month,
    SUM(v.total_os)::bigint AS total_os,
    SUM(v.os_fechadas)::bigint AS os_fechadas,
    AVG(v.mttr_hours) AS mttr_hours,
    AVG(v.resolution_rate) AS resolution_rate
  FROM public.v_report_monthly v
  WHERE v.empresa_id = p_empresa_id
    AND (v.year * 100 + v.month) >= (
      EXTRACT(YEAR FROM NOW() - (p_months || ' months')::interval)::int * 100 
      + EXTRACT(MONTH FROM NOW() - (p_months || ' months')::interval)::int
    )
  GROUP BY v.year, v.month
  ORDER BY v.year DESC, v.month DESC
  LIMIT p_months;
$$;

CREATE OR REPLACE FUNCTION public.get_quarterly_trend(
  p_empresa_id uuid,
  p_quarters int DEFAULT 8
)
RETURNS TABLE (
  year int,
  quarter int,
  total_os bigint,
  os_fechadas bigint,
  mttr_hours numeric,
  resolution_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    v.year,
    v.quarter,
    SUM(v.total_os)::bigint AS total_os,
    SUM(v.os_fechadas)::bigint AS os_fechadas,
    AVG(v.mttr_hours) AS mttr_hours,
    AVG(v.resolution_rate) AS resolution_rate
  FROM public.v_report_quarterly v
  WHERE v.empresa_id = p_empresa_id
    AND (v.year * 10 + v.quarter) >= (
      EXTRACT(YEAR FROM NOW() - (p_quarters * 3 || ' months')::interval)::int * 10 
      + EXTRACT(QUARTER FROM NOW() - (p_quarters * 3 || ' months')::interval)::int
    )
  GROUP BY v.year, v.quarter
  ORDER BY v.year DESC, v.quarter DESC
  LIMIT p_quarters;
$$;

CREATE OR REPLACE FUNCTION public.get_yearly_trend(
  p_empresa_id uuid,
  p_years int DEFAULT 3
)
RETURNS TABLE (
  year int,
  total_os bigint,
  os_fechadas bigint,
  mttr_hours numeric,
  resolution_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    v.year,
    SUM(v.total_os)::bigint AS total_os,
    SUM(v.os_fechadas)::bigint AS os_fechadas,
    AVG(v.mttr_hours) AS mttr_hours,
    AVG(v.resolution_rate) AS resolution_rate
  FROM public.v_report_yearly v
  WHERE v.empresa_id = p_empresa_id
    AND v.year >= EXTRACT(YEAR FROM NOW())::int - p_years
  GROUP BY v.year
  ORDER BY v.year DESC
  LIMIT p_years;
$$;

CREATE OR REPLACE FUNCTION public.get_critical_equipment(
  p_empresa_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  equipamento_nome text,
  equipamento_tag text,
  setor text,
  total_falhas bigint,
  mttr_hours numeric,
  mtbf_days numeric,
  reincidencia_30d numeric,
  score_criticidade numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_os AS (
    SELECT os.*
    FROM public.ordens_de_servico os
    WHERE os.empresa_id = p_empresa_id
      AND (p_start_date IS NULL OR os.data_abertura >= p_start_date)
      AND (p_end_date IS NULL OR os.data_abertura <= p_end_date)
  ),
  equipment_stats AS (
    SELECT
      fos.equipamento_nome,
      fos.equipamento_tag,
      fos.localizacao AS setor,
      COUNT(*) AS total_falhas,
      COALESCE(
        AVG(EXTRACT(EPOCH FROM (fos.data_fechamento - fos.data_abertura)) / 3600.0) 
        FILTER (WHERE fos.data_fechamento IS NOT NULL),
        0
      ) AS mttr_hours,
      MAX(fos.data_abertura) AS ultima_falha,
      MIN(fos.data_abertura) AS primeira_falha,
      COUNT(*) FILTER (WHERE fos.data_abertura >= NOW() - INTERVAL '30 days') AS falhas_30d
    FROM filtered_os fos
    GROUP BY fos.equipamento_nome, fos.equipamento_tag, fos.localizacao
  )
  SELECT
    es.equipamento_nome,
    es.equipamento_tag,
    es.setor,
    es.total_falhas,
    es.mttr_hours,
    CASE 
      WHEN es.total_falhas > 1 
      THEN EXTRACT(EPOCH FROM (es.ultima_falha - es.primeira_falha)) / 86400.0 / (es.total_falhas - 1)
      ELSE 999
    END AS mtbf_days,
    CASE 
      WHEN es.total_falhas > 0 
      THEN (es.falhas_30d::numeric / es.total_falhas::numeric) * 100
      ELSE 0
    END AS reincidencia_30d,
    CASE 
      WHEN es.total_falhas > 1 
      THEN (es.total_falhas * (1 + (es.falhas_30d::numeric / es.total_falhas::numeric)) * (1 + es.mttr_hours/24)) 
           / NULLIF(EXTRACT(EPOCH FROM (es.ultima_falha - es.primeira_falha)) / 86400.0 / (es.total_falhas - 1), 0)
      ELSE es.total_falhas * 10
    END AS score_criticidade
  FROM equipment_stats es
  ORDER BY score_criticidade DESC NULLS LAST
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.get_tag_analysis(
  p_empresa_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  tag text,
  total_os bigint,
  mttr_avg numeric,
  equipamentos text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    os.equipamento_tag AS tag,
    COUNT(*) AS total_os,
    COALESCE(
      AVG(EXTRACT(EPOCH FROM (os.data_fechamento - os.data_abertura)) / 3600.0) 
      FILTER (WHERE os.data_fechamento IS NOT NULL),
      0
    ) AS mttr_avg,
    ARRAY_AGG(DISTINCT os.equipamento_nome) AS equipamentos
  FROM public.ordens_de_servico os
  WHERE os.empresa_id = p_empresa_id
    AND os.equipamento_tag IS NOT NULL
    AND (p_start_date IS NULL OR os.data_abertura >= p_start_date)
    AND (p_end_date IS NULL OR os.data_abertura <= p_end_date)
  GROUP BY os.equipamento_tag
  ORDER BY COUNT(*) DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_service_type_breakdown(
  p_empresa_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  tipo_servico text,
  total_os bigint,
  os_fechadas bigint,
  mttr_avg numeric,
  percentual numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH totals AS (
    SELECT COUNT(*) AS total
    FROM public.ordens_de_servico os
    WHERE os.empresa_id = p_empresa_id
      AND (p_start_date IS NULL OR os.data_abertura >= p_start_date)
      AND (p_end_date IS NULL OR os.data_abertura <= p_end_date)
  )
  SELECT
    COALESCE(os.tipo_manutencao, 'Não especificado') AS tipo_servico,
    COUNT(*) AS total_os,
    COUNT(*) FILTER (WHERE os.status_os = 'Fechada') AS os_fechadas,
    COALESCE(
      AVG(EXTRACT(EPOCH FROM (os.data_fechamento - os.data_abertura)) / 3600.0) 
      FILTER (WHERE os.data_fechamento IS NOT NULL),
      0
    ) AS mttr_avg,
    CASE 
      WHEN (SELECT total FROM totals) > 0 
      THEN (COUNT(*)::numeric / (SELECT total FROM totals)::numeric) * 100
      ELSE 0
    END AS percentual
  FROM public.ordens_de_servico os
  WHERE os.empresa_id = p_empresa_id
    AND (p_start_date IS NULL OR os.data_abertura >= p_start_date)
    AND (p_end_date IS NULL OR os.data_abertura <= p_end_date)
  GROUP BY os.tipo_manutencao
  ORDER BY COUNT(*) DESC;
$$;