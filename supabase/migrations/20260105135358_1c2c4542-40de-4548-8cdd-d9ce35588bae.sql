-- Trigger para enfileirar OS automaticamente quando criada ou atualizada
CREATE OR REPLACE FUNCTION public.enqueue_os_for_indexing()
RETURNS TRIGGER AS $$
BEGIN
  -- Só enfileira se a OS está fechada (tem dados completos para indexar)
  IF NEW.status_os IN ('Fechada', 'Liberado para produção', 'Não liberado') THEN
    INSERT INTO public.os_index_jobs (os_id, empresa_id, status, embedding_version, next_run_at)
    VALUES (NEW.id, NEW.empresa_id, 'queued', 1, NOW())
    ON CONFLICT (os_id) DO UPDATE SET 
      status = 'queued',
      next_run_at = NOW(),
      updated_at = NOW()
    WHERE os_index_jobs.status != 'done';
  END IF;
  
  -- Atualiza o index_status na OS
  NEW.index_status = 'queued';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove trigger existente se houver
DROP TRIGGER IF EXISTS trigger_enqueue_os_indexing ON public.ordens_de_servico;

-- Cria trigger que dispara em INSERT ou UPDATE
CREATE TRIGGER trigger_enqueue_os_indexing
  BEFORE INSERT OR UPDATE OF status_os, descricao_problema, diagnostico_solucao, notas_finais
  ON public.ordens_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_os_for_indexing();

-- Adiciona unique constraint em os_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'os_index_jobs_os_id_key'
  ) THEN
    ALTER TABLE public.os_index_jobs ADD CONSTRAINT os_index_jobs_os_id_key UNIQUE (os_id);
  END IF;
END $$;