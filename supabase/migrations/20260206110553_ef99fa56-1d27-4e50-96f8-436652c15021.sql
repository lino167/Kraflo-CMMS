
-- Recriar todas as views com security_invoker = on para corrigir o alerta SECURITY DEFINER

-- 1. v_os_analytics
CREATE OR REPLACE VIEW public.v_os_analytics
WITH (security_invoker = on) AS
SELECT 
  id AS os_id,
  empresa_id,
  status_os,
  data_abertura AS opened_at,
  data_fechamento AS closed_at,
  CASE
    WHEN data_fechamento IS NOT NULL THEN EXTRACT(epoch FROM data_fechamento - data_abertura) / 3600.0
    ELSE NULL::numeric
  END AS repair_hours,
  index_status,
  tecnico_id,
  created_at,
  equipamento_nome,
  equipamento_tag,
  localizacao AS setor,
  tipo_manutencao AS tipo_servico,
  prioridade,
  descricao_problema,
  diagnostico_solucao,
  origem
FROM ordens_de_servico os;

-- 2. v_report_monthly
CREATE OR REPLACE VIEW public.v_report_monthly
WITH (security_invoker = on) AS
SELECT 
  empresa_id,
  EXTRACT(year FROM data_abertura)::integer AS year,
  EXTRACT(month FROM data_abertura)::integer AS month,
  count(*) AS total_os,
  count(*) FILTER (WHERE status_os = 'Fechada'::os_status) AS os_fechadas,
  count(*) FILTER (WHERE status_os = ANY (ARRAY['Aberta'::os_status, 'Em manutenção'::os_status])) AS os_abertas,
  COALESCE(avg(EXTRACT(epoch FROM data_fechamento - data_abertura) / 3600.0) FILTER (WHERE data_fechamento IS NOT NULL), 0::numeric) AS mttr_hours,
  CASE
    WHEN count(*) > 0 THEN count(*) FILTER (WHERE status_os = 'Fechada'::os_status)::numeric / count(*)::numeric * 100::numeric
    ELSE 0::numeric
  END AS resolution_rate,
  tipo_manutencao AS tipo_servico
FROM ordens_de_servico os
GROUP BY empresa_id, EXTRACT(year FROM data_abertura), EXTRACT(month FROM data_abertura), tipo_manutencao;

-- 3. v_report_quarterly
CREATE OR REPLACE VIEW public.v_report_quarterly
WITH (security_invoker = on) AS
SELECT 
  empresa_id,
  EXTRACT(year FROM data_abertura)::integer AS year,
  EXTRACT(quarter FROM data_abertura)::integer AS quarter,
  count(*) AS total_os,
  count(*) FILTER (WHERE status_os = 'Fechada'::os_status) AS os_fechadas,
  count(*) FILTER (WHERE status_os = ANY (ARRAY['Aberta'::os_status, 'Em manutenção'::os_status])) AS os_abertas,
  COALESCE(avg(EXTRACT(epoch FROM data_fechamento - data_abertura) / 3600.0) FILTER (WHERE data_fechamento IS NOT NULL), 0::numeric) AS mttr_hours,
  CASE
    WHEN count(*) > 0 THEN count(*) FILTER (WHERE status_os = 'Fechada'::os_status)::numeric / count(*)::numeric * 100::numeric
    ELSE 0::numeric
  END AS resolution_rate,
  tipo_manutencao AS tipo_servico
FROM ordens_de_servico os
GROUP BY empresa_id, EXTRACT(year FROM data_abertura), EXTRACT(quarter FROM data_abertura), tipo_manutencao;

-- 4. v_report_yearly
CREATE OR REPLACE VIEW public.v_report_yearly
WITH (security_invoker = on) AS
SELECT 
  empresa_id,
  EXTRACT(year FROM data_abertura)::integer AS year,
  count(*) AS total_os,
  count(*) FILTER (WHERE status_os = 'Fechada'::os_status) AS os_fechadas,
  count(*) FILTER (WHERE status_os = ANY (ARRAY['Aberta'::os_status, 'Em manutenção'::os_status])) AS os_abertas,
  COALESCE(avg(EXTRACT(epoch FROM data_fechamento - data_abertura) / 3600.0) FILTER (WHERE data_fechamento IS NOT NULL), 0::numeric) AS mttr_hours,
  CASE
    WHEN count(*) > 0 THEN count(*) FILTER (WHERE status_os = 'Fechada'::os_status)::numeric / count(*)::numeric * 100::numeric
    ELSE 0::numeric
  END AS resolution_rate,
  tipo_manutencao AS tipo_servico
FROM ordens_de_servico os
GROUP BY empresa_id, EXTRACT(year FROM data_abertura), tipo_manutencao;

-- 5. v_equipment_health
CREATE OR REPLACE VIEW public.v_equipment_health
WITH (security_invoker = on) AS
WITH equipment_stats AS (
  SELECT 
    os.empresa_id,
    os.equipamento_nome,
    os.equipamento_tag,
    os.localizacao AS setor,
    count(*) AS total_falhas,
    count(*) FILTER (WHERE os.status_os = 'Fechada'::os_status) AS falhas_resolvidas,
    COALESCE(avg(EXTRACT(epoch FROM os.data_fechamento - os.data_abertura) / 3600.0) FILTER (WHERE os.data_fechamento IS NOT NULL), 0::numeric) AS mttr_hours,
    max(os.data_abertura) AS ultima_falha,
    min(os.data_abertura) AS primeira_falha,
    count(*) FILTER (WHERE os.data_abertura >= (now() - '30 days'::interval)) AS falhas_30d,
    array_agg(DISTINCT os.tipo_manutencao) FILTER (WHERE os.tipo_manutencao IS NOT NULL) AS tipos_servico
  FROM ordens_de_servico os
  GROUP BY os.empresa_id, os.equipamento_nome, os.equipamento_tag, os.localizacao
)
SELECT 
  empresa_id,
  equipamento_nome,
  equipamento_tag,
  setor,
  total_falhas,
  falhas_resolvidas,
  mttr_hours,
  CASE
    WHEN total_falhas > 1 THEN EXTRACT(epoch FROM ultima_falha - primeira_falha) / 86400.0 / (total_falhas - 1)::numeric
    ELSE 999::numeric
  END AS mtbf_days,
  CASE
    WHEN total_falhas > 0 THEN falhas_30d::numeric / total_falhas::numeric * 100::numeric
    ELSE 0::numeric
  END AS reincidencia_30d,
  ultima_falha,
  falhas_30d,
  CASE
    WHEN total_falhas > 1 THEN total_falhas::numeric * (1::numeric + falhas_30d::numeric / total_falhas::numeric) * (1::numeric + mttr_hours / 24::numeric) / NULLIF(EXTRACT(epoch FROM ultima_falha - primeira_falha) / 86400.0 / (total_falhas - 1)::numeric, 0::numeric)
    ELSE (total_falhas * 10)::numeric
  END AS score_criticidade,
  tipos_servico
FROM equipment_stats es;

-- 6. v_tag_timeline
CREATE OR REPLACE VIEW public.v_tag_timeline
WITH (security_invoker = on) AS
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
    lag(os.data_fechamento) OVER (PARTITION BY os.empresa_id, os.equipamento_tag ORDER BY os.data_abertura) AS fechamento_anterior,
    lag(os.diagnostico_solucao) OVER (PARTITION BY os.empresa_id, os.equipamento_tag ORDER BY os.data_abertura) AS solucao_anterior,
    lag(os.tecnico_id) OVER (PARTITION BY os.empresa_id, os.equipamento_tag ORDER BY os.data_abertura) AS tecnico_anterior_id,
    lag(t.nome_completo) OVER (PARTITION BY os.empresa_id, os.equipamento_tag ORDER BY os.data_abertura) AS tecnico_anterior_nome,
    row_number() OVER (PARTITION BY os.empresa_id, os.equipamento_tag ORDER BY os.data_abertura DESC) AS ordem_recente
  FROM ordens_de_servico os
  LEFT JOIN tecnicos t ON t.id_telegram = os.tecnico_id
  WHERE os.equipamento_tag IS NOT NULL
)
SELECT 
  id,
  empresa_id,
  equipamento_tag,
  equipamento_nome,
  localizacao,
  data_abertura,
  data_fechamento,
  descricao_problema,
  diagnostico_solucao,
  notas_finais,
  tecnico_id,
  tipo_manutencao,
  status_os,
  prioridade,
  tecnico_nome,
  fechamento_anterior,
  solucao_anterior,
  tecnico_anterior_id,
  tecnico_anterior_nome,
  ordem_recente,
  CASE
    WHEN fechamento_anterior IS NOT NULL THEN EXTRACT(epoch FROM data_abertura - fechamento_anterior) / 86400.0
    ELSE NULL::numeric
  END AS dias_desde_ultima_solucao,
  CASE
    WHEN fechamento_anterior IS NOT NULL AND (EXTRACT(epoch FROM data_abertura - fechamento_anterior) / 86400.0) < 7::numeric THEN 'reincidencia_critica'::text
    WHEN fechamento_anterior IS NOT NULL AND (EXTRACT(epoch FROM data_abertura - fechamento_anterior) / 86400.0) < 30::numeric THEN 'reincidencia_alerta'::text
    ELSE 'ok'::text
  END AS status_reincidencia
FROM ranked_os r;

-- 7. v_technician_performance
CREATE OR REPLACE VIEW public.v_technician_performance
WITH (security_invoker = on) AS
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
    EXTRACT(epoch FROM os.data_fechamento - os.data_abertura) / 3600.0 AS horas_reparo,
    EXISTS (
      SELECT 1
      FROM ordens_de_servico os2
      WHERE os2.equipamento_tag = os.equipamento_tag 
        AND os2.empresa_id = os.empresa_id 
        AND os2.id <> os.id 
        AND os2.data_abertura > os.data_fechamento 
        AND os2.data_abertura <= (os.data_fechamento + '7 days'::interval)
    ) AS teve_reincidencia_7d
  FROM ordens_de_servico os
  WHERE os.status_os = ANY (ARRAY['Fechada'::os_status, 'Liberado para produção'::os_status])
    AND os.data_fechamento IS NOT NULL
), os_por_tipo AS (
  SELECT 
    tecnico_os.tecnico_id,
    tecnico_os.empresa_id,
    COALESCE(tecnico_os.tipo_manutencao, 'Não especificado'::text) AS tipo,
    count(*) AS quantidade
  FROM tecnico_os
  GROUP BY tecnico_os.tecnico_id, tecnico_os.empresa_id, tecnico_os.tipo_manutencao
), tipos_agregados AS (
  SELECT 
    os_por_tipo.tecnico_id,
    os_por_tipo.empresa_id,
    jsonb_object_agg(os_por_tipo.tipo, os_por_tipo.quantidade) AS os_por_tipo
  FROM os_por_tipo
  GROUP BY os_por_tipo.tecnico_id, os_por_tipo.empresa_id
), os_heroi AS (
  SELECT 
    tecnico_os.tecnico_id,
    tecnico_os.empresa_id,
    jsonb_agg(
      jsonb_build_object(
        'os_id', tecnico_os.os_id, 
        'equipamento_tag', tecnico_os.equipamento_tag, 
        'horas_aberto', tecnico_os.horas_reparo, 
        'data_fechamento', tecnico_os.data_fechamento
      ) ORDER BY tecnico_os.horas_reparo DESC
    ) FILTER (WHERE tecnico_os.horas_reparo > 48::numeric) AS os_complexas
  FROM tecnico_os
  GROUP BY tecnico_os.tecnico_id, tecnico_os.empresa_id
)
SELECT 
  t.id_telegram AS tecnico_id,
  t.nome_completo,
  t.empresa_id,
  t.funcao,
  t.setor,
  COALESCE(count(tos.os_id), 0::bigint) AS total_os_fechadas,
  COALESCE(avg(tos.horas_reparo), 0::numeric) AS mttr_medio_horas,
  CASE
    WHEN count(tos.os_id) > 0 THEN round(count(tos.os_id) FILTER (WHERE NOT tos.teve_reincidencia_7d)::numeric / count(tos.os_id)::numeric * 100::numeric, 1)
    ELSE 100::numeric
  END AS quality_score,
  COALESCE(count(tos.os_id) FILTER (WHERE tos.teve_reincidencia_7d), 0::bigint) AS total_retrabalhos,
  COALESCE(ta.os_por_tipo, '{}'::jsonb) AS os_por_tipo,
  COALESCE(oh.os_complexas, '[]'::jsonb) AS os_heroi,
  min(tos.data_abertura) AS primeira_os,
  max(tos.data_fechamento) AS ultima_os
FROM tecnicos t
LEFT JOIN tecnico_os tos ON tos.tecnico_id = t.id_telegram AND tos.empresa_id = t.empresa_id
LEFT JOIN tipos_agregados ta ON ta.tecnico_id = t.id_telegram AND ta.empresa_id = t.empresa_id
LEFT JOIN os_heroi oh ON oh.tecnico_id = t.id_telegram AND oh.empresa_id = t.empresa_id
GROUP BY t.id_telegram, t.nome_completo, t.empresa_id, t.funcao, t.setor, ta.os_por_tipo, oh.os_complexas;
