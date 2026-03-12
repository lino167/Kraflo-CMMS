-- ================================================================
-- CORREÇÃO DE SEGURANÇA: Remover SECURITY DEFINER das views
-- ================================================================

-- Recriar v_os_analytics SEM security_invoker (padrão é INVOKER)
DROP VIEW IF EXISTS public.v_os_analytics CASCADE;
CREATE VIEW public.v_os_analytics AS
SELECT
  os.id AS os_id,
  os.empresa_id,
  os.status_os,
  os.data_abertura AS opened_at,
  os.data_fechamento AS closed_at,
  CASE 
    WHEN os.data_fechamento IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (os.data_fechamento - os.data_abertura)) / 3600.0
    ELSE NULL
  END AS repair_hours,
  os.index_status,
  os.tecnico_id,
  os.created_at,
  os.equipamento_nome,
  os.equipamento_tag,
  os.localizacao AS setor,
  os.tipo_manutencao AS tipo_servico,
  os.prioridade,
  os.descricao_problema,
  os.diagnostico_solucao,
  os.origem
FROM public.ordens_de_servico os;

-- Recriar v_report_monthly SEM security_invoker
DROP VIEW IF EXISTS public.v_report_monthly CASCADE;
CREATE VIEW public.v_report_monthly AS
SELECT
  os.empresa_id,
  EXTRACT(YEAR FROM os.data_abertura)::int AS year,
  EXTRACT(MONTH FROM os.data_abertura)::int AS month,
  COUNT(*) AS total_os,
  COUNT(*) FILTER (WHERE os.status_os = 'Fechada') AS os_fechadas,
  COUNT(*) FILTER (WHERE os.status_os IN ('Aberta', 'Em manutenção')) AS os_abertas,
  COALESCE(
    AVG(EXTRACT(EPOCH FROM (os.data_fechamento - os.data_abertura)) / 3600.0) 
    FILTER (WHERE os.data_fechamento IS NOT NULL),
    0
  ) AS mttr_hours,
  CASE 
    WHEN COUNT(*) > 0 
    THEN (COUNT(*) FILTER (WHERE os.status_os = 'Fechada')::numeric / COUNT(*)::numeric) * 100
    ELSE 0
  END AS resolution_rate,
  os.tipo_manutencao AS tipo_servico
FROM public.ordens_de_servico os
GROUP BY os.empresa_id, EXTRACT(YEAR FROM os.data_abertura), EXTRACT(MONTH FROM os.data_abertura), os.tipo_manutencao;

-- Recriar v_report_quarterly SEM security_invoker
DROP VIEW IF EXISTS public.v_report_quarterly CASCADE;
CREATE VIEW public.v_report_quarterly AS
SELECT
  os.empresa_id,
  EXTRACT(YEAR FROM os.data_abertura)::int AS year,
  EXTRACT(QUARTER FROM os.data_abertura)::int AS quarter,
  COUNT(*) AS total_os,
  COUNT(*) FILTER (WHERE os.status_os = 'Fechada') AS os_fechadas,
  COUNT(*) FILTER (WHERE os.status_os IN ('Aberta', 'Em manutenção')) AS os_abertas,
  COALESCE(
    AVG(EXTRACT(EPOCH FROM (os.data_fechamento - os.data_abertura)) / 3600.0) 
    FILTER (WHERE os.data_fechamento IS NOT NULL),
    0
  ) AS mttr_hours,
  CASE 
    WHEN COUNT(*) > 0 
    THEN (COUNT(*) FILTER (WHERE os.status_os = 'Fechada')::numeric / COUNT(*)::numeric) * 100
    ELSE 0
  END AS resolution_rate,
  os.tipo_manutencao AS tipo_servico
FROM public.ordens_de_servico os
GROUP BY os.empresa_id, EXTRACT(YEAR FROM os.data_abertura), EXTRACT(QUARTER FROM os.data_abertura), os.tipo_manutencao;

-- Recriar v_report_yearly SEM security_invoker
DROP VIEW IF EXISTS public.v_report_yearly CASCADE;
CREATE VIEW public.v_report_yearly AS
SELECT
  os.empresa_id,
  EXTRACT(YEAR FROM os.data_abertura)::int AS year,
  COUNT(*) AS total_os,
  COUNT(*) FILTER (WHERE os.status_os = 'Fechada') AS os_fechadas,
  COUNT(*) FILTER (WHERE os.status_os IN ('Aberta', 'Em manutenção')) AS os_abertas,
  COALESCE(
    AVG(EXTRACT(EPOCH FROM (os.data_fechamento - os.data_abertura)) / 3600.0) 
    FILTER (WHERE os.data_fechamento IS NOT NULL),
    0
  ) AS mttr_hours,
  CASE 
    WHEN COUNT(*) > 0 
    THEN (COUNT(*) FILTER (WHERE os.status_os = 'Fechada')::numeric / COUNT(*)::numeric) * 100
    ELSE 0
  END AS resolution_rate,
  os.tipo_manutencao AS tipo_servico
FROM public.ordens_de_servico os
GROUP BY os.empresa_id, EXTRACT(YEAR FROM os.data_abertura), os.tipo_manutencao;

-- Recriar v_equipment_health SEM security_invoker
DROP VIEW IF EXISTS public.v_equipment_health CASCADE;
CREATE VIEW public.v_equipment_health AS
WITH equipment_stats AS (
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
    COUNT(*) FILTER (WHERE os.data_abertura >= NOW() - INTERVAL '30 days') AS falhas_30d,
    ARRAY_AGG(DISTINCT os.tipo_manutencao) FILTER (WHERE os.tipo_manutencao IS NOT NULL) AS tipos_servico
  FROM public.ordens_de_servico os
  GROUP BY os.empresa_id, os.equipamento_nome, os.equipamento_tag, os.localizacao
)
SELECT
  es.empresa_id,
  es.equipamento_nome,
  es.equipamento_tag,
  es.setor,
  es.total_falhas,
  es.falhas_resolvidas,
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
  es.ultima_falha,
  es.falhas_30d,
  CASE 
    WHEN es.total_falhas > 1 
    THEN (es.total_falhas * (1 + (es.falhas_30d::numeric / es.total_falhas::numeric)) * (1 + es.mttr_hours/24)) 
         / NULLIF(EXTRACT(EPOCH FROM (es.ultima_falha - es.primeira_falha)) / 86400.0 / (es.total_falhas - 1), 0)
    ELSE es.total_falhas * 10
  END AS score_criticidade,
  es.tipos_servico
FROM equipment_stats es;

-- ================================================================
-- CORREÇÃO DE SEGURANÇA: Políticas RLS para user_roles
-- ================================================================

-- Permitir apenas admin_kraflo gerenciar roles
DROP POLICY IF EXISTS "Admin Kraflo can manage roles" ON public.user_roles;
CREATE POLICY "Admin Kraflo can manage roles"
ON public.user_roles
FOR ALL
USING (is_admin_kraflo(auth.uid()))
WITH CHECK (is_admin_kraflo(auth.uid()));

-- ================================================================
-- CORREÇÃO DE SEGURANÇA: Políticas RLS para ia_mensagens (INSERT)
-- ================================================================

-- Permitir INSERT apenas para conversas da própria empresa
DROP POLICY IF EXISTS "Users can insert messages to their company conversations" ON public.ia_mensagens;
CREATE POLICY "Users can insert messages to their company conversations"
ON public.ia_mensagens
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ia_conversas c
    WHERE c.id = ia_mensagens.conversa_id
    AND c.empresa_id = get_user_empresa_id(auth.uid())
  )
);

-- ================================================================
-- CORREÇÃO DE SEGURANÇA: Políticas RLS para pecas_utilizadas (UPDATE/DELETE)
-- ================================================================

-- Permitir UPDATE apenas para admins da empresa
DROP POLICY IF EXISTS "Admin can update pecas from their company OS" ON public.pecas_utilizadas;
CREATE POLICY "Admin can update pecas from their company OS"
ON public.pecas_utilizadas
FOR UPDATE
USING (
  (is_admin_kraflo(auth.uid()) OR has_role(auth.uid(), 'admin_empresa'))
  AND EXISTS (
    SELECT 1 FROM public.ordens_de_servico os
    WHERE os.id = pecas_utilizadas.ordem_id
    AND os.empresa_id = get_user_empresa_id(auth.uid())
  )
);

-- Permitir DELETE apenas para admins
DROP POLICY IF EXISTS "Admin can delete pecas from their company OS" ON public.pecas_utilizadas;
CREATE POLICY "Admin can delete pecas from their company OS"
ON public.pecas_utilizadas
FOR DELETE
USING (
  (is_admin_kraflo(auth.uid()) OR has_role(auth.uid(), 'admin_empresa'))
  AND EXISTS (
    SELECT 1 FROM public.ordens_de_servico os
    WHERE os.id = pecas_utilizadas.ordem_id
    AND os.empresa_id = get_user_empresa_id(auth.uid())
  )
);

-- ================================================================
-- CORREÇÃO DE SEGURANÇA: Melhorar política do profiles
-- ================================================================

-- Remover política com problema e recriar corretamente
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;

-- Política que bloqueia acesso anônimo tanto para leitura quanto escrita
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- ================================================================
-- CORREÇÃO DE SEGURANÇA: Políticas RLS para ia_conversas (INSERT)
-- ================================================================

-- Permitir INSERT apenas para própria empresa
DROP POLICY IF EXISTS "Users can create conversations for their company" ON public.ia_conversas;
CREATE POLICY "Users can create conversations for their company"
ON public.ia_conversas
FOR INSERT
WITH CHECK (
  empresa_id = get_user_empresa_id(auth.uid())
);