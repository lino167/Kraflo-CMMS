-- =============================================
-- PROMPTS 2, 3 e 4: Governança de Indexação de OS
-- =============================================

-- 1) Criar ENUM para status de indexação
CREATE TYPE public.os_index_status AS ENUM (
  'pending',
  'queued', 
  'indexing',
  'indexed',
  'error'
);

-- 2) Adicionar campos de controle em ordens_de_servico (Prompt 2)
ALTER TABLE public.ordens_de_servico
ADD COLUMN IF NOT EXISTS index_status public.os_index_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS last_indexed_at timestamptz,
ADD COLUMN IF NOT EXISTS index_error text,
ADD COLUMN IF NOT EXISTS embedding_version int DEFAULT 1;

-- Índices para campos de indexação
CREATE INDEX IF NOT EXISTS idx_os_index_status 
ON public.ordens_de_servico (index_status);

CREATE INDEX IF NOT EXISTS idx_os_embedding_version 
ON public.ordens_de_servico (embedding_version);

CREATE INDEX IF NOT EXISTS idx_os_last_indexed 
ON public.ordens_de_servico (last_indexed_at);

-- 3) Criar tabela de fila os_index_jobs (Prompt 3)
CREATE TABLE IF NOT EXISTS public.os_index_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  os_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'error')),
  attempts int NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  embedding_version int NOT NULL DEFAULT 1,
  UNIQUE (os_id, embedding_version)
);

-- Índices para fila
CREATE INDEX IF NOT EXISTS idx_os_index_jobs_status_next_run 
ON public.os_index_jobs (status, next_run_at) 
WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS idx_os_index_jobs_empresa 
ON public.os_index_jobs (empresa_id);

CREATE INDEX IF NOT EXISTS idx_os_index_jobs_os_id 
ON public.os_index_jobs (os_id);

-- RLS para os_index_jobs
ALTER TABLE public.os_index_jobs ENABLE ROW LEVEL SECURITY;

-- Admins podem ver jobs da empresa
CREATE POLICY "Admin Empresa can view their index jobs"
ON public.os_index_jobs FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Admin Kraflo pode gerenciar todos
CREATE POLICY "Admin Kraflo can manage all index jobs"
ON public.os_index_jobs FOR ALL
USING (is_admin_kraflo(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_os_index_jobs_updated_at
BEFORE UPDATE ON public.os_index_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 4) Função SECURITY DEFINER para enfileirar indexação (Prompt 4)
CREATE OR REPLACE FUNCTION public.enqueue_os_index(p_os_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_current_version int;
BEGIN
  -- Buscar empresa_id e versão atual da OS
  SELECT empresa_id, COALESCE(embedding_version, 1)
  INTO v_empresa_id, v_current_version
  FROM public.ordens_de_servico
  WHERE id = p_os_id;
  
  IF v_empresa_id IS NULL THEN
    RETURN; -- OS não existe
  END IF;
  
  -- Atualizar status da OS para queued
  UPDATE public.ordens_de_servico
  SET index_status = 'queued',
      index_error = NULL
  WHERE id = p_os_id;
  
  -- Inserir ou atualizar job na fila (upsert)
  INSERT INTO public.os_index_jobs (empresa_id, os_id, status, embedding_version, next_run_at)
  VALUES (v_empresa_id, p_os_id, 'queued', v_current_version, now())
  ON CONFLICT (os_id, embedding_version) 
  DO UPDATE SET 
    status = 'queued',
    next_run_at = now(),
    attempts = 0,
    last_error = NULL,
    updated_at = now()
  WHERE os_index_jobs.status IN ('error', 'done'); -- Só reprocessa se erro ou já concluído
END;
$$;

-- 5) Trigger para enfileirar automaticamente ao criar/alterar OS
CREATE OR REPLACE FUNCTION public.trigger_enqueue_os_index()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Para INSERT: sempre enfileirar
  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_os_index(NEW.id);
    RETURN NEW;
  END IF;
  
  -- Para UPDATE: só enfileirar se campos relevantes mudaram
  IF TG_OP = 'UPDATE' THEN
    IF (
      OLD.descricao_problema IS DISTINCT FROM NEW.descricao_problema OR
      OLD.diagnostico_solucao IS DISTINCT FROM NEW.diagnostico_solucao OR
      OLD.notas_finais IS DISTINCT FROM NEW.notas_finais OR
      OLD.equipamento_nome IS DISTINCT FROM NEW.equipamento_nome OR
      OLD.equipamento_tag IS DISTINCT FROM NEW.equipamento_tag OR
      OLD.tipo_manutencao IS DISTINCT FROM NEW.tipo_manutencao OR
      OLD.status_os IS DISTINCT FROM NEW.status_os
    ) THEN
      PERFORM public.enqueue_os_index(NEW.id);
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_os_index_enqueue ON public.ordens_de_servico;
CREATE TRIGGER trigger_os_index_enqueue
AFTER INSERT OR UPDATE ON public.ordens_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.trigger_enqueue_os_index();

-- 6) Adicionar empresa_id em os_embeddings para facilitar queries
ALTER TABLE public.os_embeddings
ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id),
ADD COLUMN IF NOT EXISTS embedding_version int DEFAULT 1;

-- Atualizar empresa_id para embeddings existentes
UPDATE public.os_embeddings oe
SET empresa_id = os.empresa_id
FROM public.ordens_de_servico os
WHERE oe.ordem_id = os.id AND oe.empresa_id IS NULL;

-- Índice para empresa_id em embeddings
CREATE INDEX IF NOT EXISTS idx_os_embeddings_empresa 
ON public.os_embeddings (empresa_id);

CREATE INDEX IF NOT EXISTS idx_os_embeddings_version 
ON public.os_embeddings (embedding_version);

-- Comentários de documentação
COMMENT ON TABLE public.os_index_jobs IS 
'Fila de jobs para indexação de OS. Status: queued→running→done/error. Backoff exponencial em erros.';

COMMENT ON COLUMN public.ordens_de_servico.index_status IS 
'Status de indexação: pending (nunca indexada), queued (na fila), indexing (processando), indexed (ok), error (falhou)';

COMMENT ON COLUMN public.ordens_de_servico.embedding_version IS 
'Versão do embedding. Incrementar para forçar reindexação global.';

COMMENT ON FUNCTION public.enqueue_os_index IS 
'Enfileira uma OS para indexação. Uso: SELECT enqueue_os_index(os_id). SECURITY DEFINER para bypass RLS.';