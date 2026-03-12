-- ==========================================
-- MOVE vector extension from public to extensions schema
-- ==========================================

-- Move the vector extension to extensions schema
ALTER EXTENSION vector SET SCHEMA extensions;

-- Update search_path for functions that use vector type
-- search_manual_chunks uses vector in parameter
CREATE OR REPLACE FUNCTION public.search_manual_chunks(
  query_embedding extensions.vector,
  match_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 5,
  filter_empresa_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  manual_id uuid,
  conteudo text,
  pagina integer,
  similarity double precision,
  nome_arquivo text,
  equipamento_tipo text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- search_os_similares uses vector in parameter
CREATE OR REPLACE FUNCTION public.search_os_similares(
  query_embedding extensions.vector,
  match_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 5,
  filter_empresa_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  ordem_id bigint,
  texto_indexado text,
  similarity double precision,
  equipamento_nome text,
  descricao_problema text,
  diagnostico_solucao text,
  notas_finais text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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