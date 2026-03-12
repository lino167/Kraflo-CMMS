-- =============================================
-- PROMPT 4: Schema de Manutenção Preventiva
-- =============================================

-- ENUM para periodicidade
CREATE TYPE public.periodicidade_manutencao AS ENUM (
  'diaria',
  'semanal',
  'quinzenal',
  'mensal',
  'bimestral',
  'trimestral',
  'semestral',
  'anual'
);

-- ENUM para status de execução
CREATE TYPE public.execucao_status AS ENUM (
  'agendada',
  'em_andamento',
  'concluida',
  'cancelada',
  'atrasada'
);

-- 1) Tabela de Planos de Manutenção
CREATE TABLE public.planos_manutencao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  equipamento_nome text, -- pode ser null se for por tag/modelo
  equipamento_tag text,
  fabricante text,
  modelo text,
  titulo text NOT NULL,
  objetivo text,
  periodicidade public.periodicidade_manutencao NOT NULL DEFAULT 'mensal',
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_planos_empresa ON public.planos_manutencao (empresa_id);
CREATE INDEX idx_planos_equipamento ON public.planos_manutencao (equipamento_nome);
CREATE INDEX idx_planos_ativo ON public.planos_manutencao (ativo) WHERE ativo = true;

-- RLS
ALTER TABLE public.planos_manutencao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Empresa can view their plans"
ON public.planos_manutencao FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Admin can manage plans"
ON public.planos_manutencao FOR ALL
USING (
  empresa_id = get_user_empresa_id(auth.uid()) 
  AND (has_role(auth.uid(), 'admin_empresa') OR is_admin_kraflo(auth.uid()))
);

-- Trigger updated_at
CREATE TRIGGER update_planos_manutencao_updated_at
BEFORE UPDATE ON public.planos_manutencao
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 2) Tabela de Tarefas Preventivas
CREATE TABLE public.tarefas_preventivas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES public.planos_manutencao(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  checklist jsonb DEFAULT '[]'::jsonb, -- [{item: string, obrigatorio: boolean}]
  tempo_estimado_minutos int DEFAULT 30,
  intervalo_dias int NOT NULL DEFAULT 30,
  tags text[] DEFAULT '{}'::text[],
  ativo boolean NOT NULL DEFAULT true,
  ordem int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_tarefas_plano ON public.tarefas_preventivas (plano_id);
CREATE INDEX idx_tarefas_ativo ON public.tarefas_preventivas (ativo) WHERE ativo = true;
CREATE INDEX idx_tarefas_tags ON public.tarefas_preventivas USING GIN (tags);

-- RLS
ALTER TABLE public.tarefas_preventivas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks from their company plans"
ON public.tarefas_preventivas FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.planos_manutencao p
    WHERE p.id = tarefas_preventivas.plano_id
    AND p.empresa_id = get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "Admin can manage tasks"
ON public.tarefas_preventivas FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.planos_manutencao p
    WHERE p.id = tarefas_preventivas.plano_id
    AND p.empresa_id = get_user_empresa_id(auth.uid())
    AND (has_role(auth.uid(), 'admin_empresa') OR is_admin_kraflo(auth.uid()))
  )
);

-- Trigger updated_at
CREATE TRIGGER update_tarefas_preventivas_updated_at
BEFORE UPDATE ON public.tarefas_preventivas
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 3) Tabela de Execuções Preventivas
CREATE TABLE public.execucoes_preventivas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.tarefas_preventivas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  agendado_para date NOT NULL,
  executado_em timestamptz,
  status public.execucao_status NOT NULL DEFAULT 'agendada',
  tecnico_id bigint REFERENCES public.tecnicos(id_telegram),
  notas text,
  checklist_resultado jsonb, -- [{item, concluido, observacao}]
  os_gerada_id bigint REFERENCES public.ordens_de_servico(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_execucoes_tarefa ON public.execucoes_preventivas (tarefa_id);
CREATE INDEX idx_execucoes_empresa ON public.execucoes_preventivas (empresa_id);
CREATE INDEX idx_execucoes_agendado ON public.execucoes_preventivas (agendado_para);
CREATE INDEX idx_execucoes_status ON public.execucoes_preventivas (status);
CREATE INDEX idx_execucoes_tecnico ON public.execucoes_preventivas (tecnico_id);

-- RLS
ALTER TABLE public.execucoes_preventivas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view executions from their company"
ON public.execucoes_preventivas FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Admin can manage executions"
ON public.execucoes_preventivas FOR ALL
USING (
  empresa_id = get_user_empresa_id(auth.uid())
  AND (has_role(auth.uid(), 'admin_empresa') OR is_admin_kraflo(auth.uid()))
);

-- Trigger updated_at
CREATE TRIGGER update_execucoes_preventivas_updated_at
BEFORE UPDATE ON public.execucoes_preventivas
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 4) Adicionar campo para rastrear origem da OS (relatório/plano)
ALTER TABLE public.ordens_de_servico
ADD COLUMN IF NOT EXISTS origem text DEFAULT 'manual', -- 'manual', 'preventiva', 'relatorio'
ADD COLUMN IF NOT EXISTS plano_origem_id uuid REFERENCES public.planos_manutencao(id),
ADD COLUMN IF NOT EXISTS execucao_origem_id uuid REFERENCES public.execucoes_preventivas(id);

-- Índice para filtrar por origem
CREATE INDEX IF NOT EXISTS idx_os_origem ON public.ordens_de_servico (origem);

-- 5) Tabela de configuração de benchmarks por empresa
CREATE TABLE public.config_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE UNIQUE,
  mttr_alvo_horas numeric(10,2) DEFAULT 4.0,
  mtbf_alvo_dias numeric(10,2) DEFAULT 30.0,
  taxa_resolucao_alvo numeric(5,2) DEFAULT 95.0,
  peso_falhas numeric(3,2) DEFAULT 1.0,
  peso_reincidencia numeric(3,2) DEFAULT 1.5,
  peso_mttr numeric(3,2) DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.config_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view their config"
ON public.config_benchmarks FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Admin can manage config"
ON public.config_benchmarks FOR ALL
USING (
  empresa_id = get_user_empresa_id(auth.uid())
  AND (has_role(auth.uid(), 'admin_empresa') OR is_admin_kraflo(auth.uid()))
);

-- Trigger updated_at
CREATE TRIGGER update_config_benchmarks_updated_at
BEFORE UPDATE ON public.config_benchmarks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Comentários
COMMENT ON TABLE public.planos_manutencao IS 'Planos de manutenção preventiva por equipamento/tag/modelo';
COMMENT ON TABLE public.tarefas_preventivas IS 'Tarefas/checklists dentro de um plano preventivo';
COMMENT ON TABLE public.execucoes_preventivas IS 'Execuções agendadas de tarefas preventivas';
COMMENT ON TABLE public.config_benchmarks IS 'Configuração de benchmarks e pesos de criticidade por empresa';