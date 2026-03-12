-- Fix search_path for the new functions
CREATE OR REPLACE FUNCTION public.search_manual_chunks(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5,
  filter_empresa_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  manual_id UUID,
  conteudo TEXT,
  pagina INTEGER,
  similarity FLOAT,
  nome_arquivo TEXT,
  equipamento_tipo TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mc.id,
    mc.manual_id,
    mc.conteudo,
    mc.pagina,
    1 - (mc.embedding <=> query_embedding) AS similarity,
    m.nome_arquivo,
    m.equipamento_tipo
  FROM public.manual_chunks mc
  JOIN public.manuais m ON m.id = mc.manual_id
  WHERE 
    (filter_empresa_id IS NULL OR m.empresa_id = filter_empresa_id)
    AND 1 - (mc.embedding <=> query_embedding) > match_threshold
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_os_similares(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5,
  filter_empresa_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  ordem_id BIGINT,
  texto_indexado TEXT,
  similarity FLOAT,
  equipamento_nome TEXT,
  descricao_problema TEXT,
  diagnostico_solucao TEXT,
  notas_finais TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oe.id,
    oe.ordem_id,
    oe.texto_indexado,
    1 - (oe.embedding <=> query_embedding) AS similarity,
    os.equipamento_nome,
    os.descricao_problema,
    os.diagnostico_solucao,
    os.notas_finais
  FROM public.os_embeddings oe
  JOIN public.ordens_de_servico os ON os.id = oe.ordem_id
  WHERE 
    (filter_empresa_id IS NULL OR os.empresa_id = filter_empresa_id)
    AND 1 - (oe.embedding <=> query_embedding) > match_threshold
  ORDER BY oe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;