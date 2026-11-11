-- =====================================================================
-- Tabelas já usadas pelo frontend que não tinham migration no repositório
-- (setores, maquinas, solicitações, orçamentos, checklists, links).
--
-- Tudo é idempotente: se a tabela já existir no projeto remoto ela é
-- preservada e apenas as colunas/policies que faltam são adicionadas.
-- =====================================================================

-- ---------- setores ----------
CREATE TABLE IF NOT EXISTS public.setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_setores_empresa ON public.setores (empresa_id);

-- ---------- maquinas (ativos) ----------
CREATE TABLE IF NOT EXISTS public.maquinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  setor_id uuid REFERENCES public.setores(id) ON DELETE SET NULL,
  tag text,
  nome text NOT NULL,
  fabricante text,
  modelo text,
  numero_serie text,
  data_aquisicao date,
  situacao text DEFAULT 'ativo',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Criticidade ABC: A = para a produção, B = reduz capacidade, C = sem impacto direto
ALTER TABLE public.maquinas
  ADD COLUMN IF NOT EXISTS criticidade text NOT NULL DEFAULT 'B';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maquinas_criticidade_check') THEN
    ALTER TABLE public.maquinas
      ADD CONSTRAINT maquinas_criticidade_check CHECK (criticidade IN ('A', 'B', 'C'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_maquinas_empresa ON public.maquinas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_maquinas_tag ON public.maquinas (empresa_id, tag);

-- ---------- links de acesso convidado (portal de solicitações) ----------
CREATE TABLE IF NOT EXISTS public.links_acesso_convidado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  token text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  descricao text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.links_acesso_convidado
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_links_convidado_token ON public.links_acesso_convidado (token);
CREATE INDEX IF NOT EXISTS idx_links_convidado_empresa ON public.links_acesso_convidado (empresa_id);

-- ---------- solicitações de manutenção ----------
CREATE TABLE IF NOT EXISTS public.solicitacoes_manutencao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  equipamento_nome text NOT NULL,
  localizacao text,
  descricao text NOT NULL,
  prioridade text NOT NULL DEFAULT 'Média',
  solicitante_nome text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.solicitacoes_manutencao
  ADD COLUMN IF NOT EXISTS equipamento_tag text,
  ADD COLUMN IF NOT EXISTS solicitante_contato text,
  ADD COLUMN IF NOT EXISTS link_id uuid REFERENCES public.links_acesso_convidado(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS os_gerada_id bigint REFERENCES public.ordens_de_servico(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_solicitacoes_empresa_status
  ON public.solicitacoes_manutencao (empresa_id, status, created_at DESC);

-- ---------- orçamentos de manutenção ----------
CREATE TABLE IF NOT EXISTS public.orcamentos_manutencao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  os_id bigint REFERENCES public.ordens_de_servico(id) ON DELETE SET NULL,
  fornecedor text NOT NULL,
  servico text NOT NULL,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  equipamento_nome text,
  equipamento_tag text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orcamentos_manutencao
  ADD COLUMN IF NOT EXISTS decidido_por uuid,
  ADD COLUMN IF NOT EXISTS decidido_em timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_orcamentos_empresa ON public.orcamentos_manutencao (empresa_id, status);

-- ---------- templates de checklist ----------
CREATE TABLE IF NOT EXISTS public.templates_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  categoria text NOT NULL,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_templates_checklist_empresa ON public.templates_checklist (empresa_id, categoria);

-- =====================================================================
-- RLS — leitura: membros da empresa; escrita: admins (ou membros, onde
-- o fluxo operacional exige). Policies são permissivas e somam às que
-- já existirem no projeto remoto.
-- =====================================================================
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links_acesso_convidado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_manutencao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos_manutencao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates_checklist ENABLE ROW LEVEL SECURITY;

-- Helper: usuário é admin (da empresa ou Kraflo)
CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin_empresa') OR public.has_role(_user_id, 'admin_kraflo')
$$;

DO $$
DECLARE
  t text;
BEGIN
  -- Leitura por membros da empresa (e admin Kraflo) em todas as tabelas
  FOREACH t IN ARRAY ARRAY['setores', 'maquinas', 'links_acesso_convidado',
                           'solicitacoes_manutencao', 'orcamentos_manutencao', 'templates_checklist']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "kraflo_%1$s_select" ON public.%1$I', t);
    EXECUTE format($p$
      CREATE POLICY "kraflo_%1$s_select" ON public.%1$I FOR SELECT TO authenticated
      USING (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_admin_kraflo(auth.uid()))
    $p$, t);
  END LOOP;

  -- Escrita restrita a admins: cadastro de ativos, links e templates
  FOREACH t IN ARRAY ARRAY['setores', 'maquinas', 'links_acesso_convidado', 'templates_checklist']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "kraflo_%1$s_admin_write" ON public.%1$I', t);
    EXECUTE format($p$
      CREATE POLICY "kraflo_%1$s_admin_write" ON public.%1$I FOR ALL TO authenticated
      USING (public.is_admin_kraflo(auth.uid())
             OR (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin_empresa')))
      WITH CHECK (public.is_admin_kraflo(auth.uid())
             OR (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin_empresa')))
    $p$, t);
  END LOOP;
END $$;

-- Solicitações: qualquer membro da empresa abre e faz a triagem
DROP POLICY IF EXISTS "kraflo_solicitacoes_insert" ON public.solicitacoes_manutencao;
CREATE POLICY "kraflo_solicitacoes_insert" ON public.solicitacoes_manutencao
FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "kraflo_solicitacoes_update" ON public.solicitacoes_manutencao;
CREATE POLICY "kraflo_solicitacoes_update" ON public.solicitacoes_manutencao
FOR UPDATE TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()))
WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Orçamentos: qualquer membro cadastra (sempre como pendente); só admin decide
DROP POLICY IF EXISTS "kraflo_orcamentos_insert" ON public.orcamentos_manutencao;
CREATE POLICY "kraflo_orcamentos_insert" ON public.orcamentos_manutencao
FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()) AND status = 'pendente');

DROP POLICY IF EXISTS "kraflo_orcamentos_admin_update" ON public.orcamentos_manutencao;
CREATE POLICY "kraflo_orcamentos_admin_update" ON public.orcamentos_manutencao
FOR UPDATE TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.is_company_admin(auth.uid()))
WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.is_company_admin(auth.uid()));

DROP POLICY IF EXISTS "kraflo_orcamentos_admin_delete" ON public.orcamentos_manutencao;
CREATE POLICY "kraflo_orcamentos_admin_delete" ON public.orcamentos_manutencao
FOR DELETE TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.is_company_admin(auth.uid()));
