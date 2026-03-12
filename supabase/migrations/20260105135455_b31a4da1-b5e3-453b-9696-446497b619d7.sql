-- Corrige search_path da função de trigger
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
    WHERE os_index_jobs.status NOT IN ('done', 'running');
  END IF;
  
  -- Atualiza o index_status na OS
  NEW.index_status = 'queued';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;