-- =====================================================================
-- Estoque de peças de reposição
--   pecas_estoque          cadastro + saldo + custo médio
--   movimentacoes_estoque  razão imutável de entradas / saídas / ajustes
--   pecas_utilizadas       passa a poder apontar para um item do estoque
-- O saldo só muda via movimentação (trigger), nunca por UPDATE direto.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.pecas_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text,
  nome text NOT NULL,
  descricao text,
  unidade text NOT NULL DEFAULT 'un',
  quantidade numeric(12,3) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  estoque_minimo numeric(12,3) NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  custo_unitario numeric(12,2) NOT NULL DEFAULT 0 CHECK (custo_unitario >= 0),
  localizacao text,
  fornecedor text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pecas_estoque_empresa ON public.pecas_estoque (empresa_id, nome);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pecas_estoque_codigo
  ON public.pecas_estoque (empresa_id, lower(codigo)) WHERE codigo IS NOT NULL;

DROP TRIGGER IF EXISTS update_pecas_estoque_updated_at ON public.pecas_estoque;
CREATE TRIGGER update_pecas_estoque_updated_at
BEFORE UPDATE ON public.pecas_estoque
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.movimentacoes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  peca_id uuid NOT NULL REFERENCES public.pecas_estoque(id) ON DELETE CASCADE,
  -- entrada/saida: quantidade é o delta; ajuste: quantidade é o novo saldo contado
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
  quantidade numeric(12,3) NOT NULL CHECK (quantidade >= 0),
  custo_unitario numeric(12,2) CHECK (custo_unitario >= 0),
  saldo_apos numeric(12,3),
  ordem_id bigint REFERENCES public.ordens_de_servico(id) ON DELETE SET NULL,
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mov_estoque_peca ON public.movimentacoes_estoque (peca_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_estoque_ordem ON public.movimentacoes_estoque (ordem_id);

-- Aplica a movimentação ao saldo (com lock na peça) e mantém o custo médio ponderado
CREATE OR REPLACE FUNCTION public.fn_aplicar_movimentacao_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peca public.pecas_estoque%ROWTYPE;
  v_novo numeric(12,3);
  v_custo numeric(12,2);
BEGIN
  SELECT * INTO v_peca FROM public.pecas_estoque WHERE id = NEW.peca_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Peça não encontrada no estoque';
  END IF;

  NEW.empresa_id := v_peca.empresa_id;
  v_custo := v_peca.custo_unitario;

  IF NEW.tipo = 'entrada' THEN
    IF NEW.quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade de entrada deve ser maior que zero';
    END IF;
    v_novo := v_peca.quantidade + NEW.quantidade;
    IF NEW.custo_unitario IS NOT NULL THEN
      v_custo := round(((v_peca.quantidade * v_peca.custo_unitario) + (NEW.quantidade * NEW.custo_unitario)) / v_novo, 2);
    END IF;
  ELSIF NEW.tipo = 'saida' THEN
    IF NEW.quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade de saída deve ser maior que zero';
    END IF;
    IF NEW.quantidade > v_peca.quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%": saldo %, solicitado %',
        v_peca.nome, trim_scale(v_peca.quantidade), trim_scale(NEW.quantidade)
        USING ERRCODE = 'check_violation';
    END IF;
    v_novo := v_peca.quantidade - NEW.quantidade;
  ELSE
    v_novo := NEW.quantidade;
  END IF;

  -- Saídas e ajustes registram o custo vigente (base do custo por OS)
  IF NEW.custo_unitario IS NULL THEN
    NEW.custo_unitario := v_custo;
  END IF;
  NEW.saldo_apos := v_novo;

  UPDATE public.pecas_estoque
     SET quantidade = v_novo, custo_unitario = v_custo
   WHERE id = v_peca.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_movimentacao_estoque ON public.movimentacoes_estoque;
CREATE TRIGGER trg_aplicar_movimentacao_estoque
BEFORE INSERT ON public.movimentacoes_estoque
FOR EACH ROW EXECUTE FUNCTION public.fn_aplicar_movimentacao_estoque();

-- ---------- vínculo das peças usadas na OS com o estoque ----------
ALTER TABLE public.pecas_utilizadas
  ADD COLUMN IF NOT EXISTS peca_estoque_id uuid REFERENCES public.pecas_estoque(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custo_unitario numeric(12,2);

-- Peça usada na OS com vínculo ao estoque => baixa automática (mesma transação)
CREATE OR REPLACE FUNCTION public.fn_baixar_estoque_peca_utilizada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os_empresa uuid;
  v_peca public.pecas_estoque%ROWTYPE;
BEGIN
  IF NEW.peca_estoque_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT empresa_id INTO v_os_empresa FROM public.ordens_de_servico WHERE id = NEW.ordem_id;
  SELECT * INTO v_peca FROM public.pecas_estoque WHERE id = NEW.peca_estoque_id;

  IF v_peca.id IS NULL OR v_peca.empresa_id IS DISTINCT FROM v_os_empresa THEN
    RAISE EXCEPTION 'Peça de estoque não pertence à empresa da OS';
  END IF;

  NEW.custo_unitario := v_peca.custo_unitario;

  INSERT INTO public.movimentacoes_estoque (empresa_id, peca_id, tipo, quantidade, ordem_id, observacao)
  VALUES (v_peca.empresa_id, v_peca.id, 'saida', NEW.quantidade, NEW.ordem_id, 'Consumo na OS #' || NEW.ordem_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_baixar_estoque_peca_utilizada ON public.pecas_utilizadas;
CREATE TRIGGER trg_baixar_estoque_peca_utilizada
BEFORE INSERT ON public.pecas_utilizadas
FOR EACH ROW EXECUTE FUNCTION public.fn_baixar_estoque_peca_utilizada();

-- ---------- RLS ----------
ALTER TABLE public.pecas_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kraflo_pecas_estoque_select" ON public.pecas_estoque;
CREATE POLICY "kraflo_pecas_estoque_select" ON public.pecas_estoque
FOR SELECT TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_admin_kraflo(auth.uid()));

-- Cadastro por admins. O saldo (quantidade) é protegido por trigger abaixo.
DROP POLICY IF EXISTS "kraflo_pecas_estoque_admin_write" ON public.pecas_estoque;
CREATE POLICY "kraflo_pecas_estoque_admin_write" ON public.pecas_estoque
FOR ALL TO authenticated
USING (public.is_admin_kraflo(auth.uid())
       OR (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin_empresa')))
WITH CHECK (public.is_admin_kraflo(auth.uid())
       OR (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin_empresa')));

DROP POLICY IF EXISTS "kraflo_mov_estoque_select" ON public.movimentacoes_estoque;
CREATE POLICY "kraflo_mov_estoque_select" ON public.movimentacoes_estoque
FOR SELECT TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_admin_kraflo(auth.uid()));

-- Qualquer membro registra saída (consumo); entrada e ajuste são de admin.
-- Sem policies de UPDATE/DELETE: o razão é imutável.
DROP POLICY IF EXISTS "kraflo_mov_estoque_insert" ON public.movimentacoes_estoque;
CREATE POLICY "kraflo_mov_estoque_insert" ON public.movimentacoes_estoque
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pecas_estoque p
    WHERE p.id = peca_id
      AND (p.empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_admin_kraflo(auth.uid()))
  )
  AND (tipo = 'saida' OR public.is_company_admin(auth.uid()))
);

-- Impede alterar o saldo por UPDATE direto vindo do cliente
CREATE OR REPLACE FUNCTION public.fn_proteger_saldo_estoque()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.quantidade IS DISTINCT FROM OLD.quantidade AND pg_trigger_depth() = 1 THEN
    RAISE EXCEPTION 'O saldo só pode ser alterado por movimentação de estoque';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_saldo_estoque ON public.pecas_estoque;
CREATE TRIGGER trg_proteger_saldo_estoque
BEFORE UPDATE ON public.pecas_estoque
FOR EACH ROW EXECUTE FUNCTION public.fn_proteger_saldo_estoque();

-- ---------- custo de peças por OS ----------
CREATE OR REPLACE VIEW public.v_os_custo_pecas
WITH (security_invoker = true) AS
SELECT
  pu.ordem_id,
  os.empresa_id,
  count(*)::int AS itens,
  coalesce(sum(pu.quantidade * coalesce(pu.custo_unitario, 0)), 0)::numeric(14,2) AS custo_pecas
FROM public.pecas_utilizadas pu
JOIN public.ordens_de_servico os ON os.id = pu.ordem_id
GROUP BY pu.ordem_id, os.empresa_id;

GRANT SELECT ON public.v_os_custo_pecas TO authenticated;
