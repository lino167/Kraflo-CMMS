-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Table for uploaded manuals
CREATE TABLE public.manuais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo TEXT NOT NULL,
  equipamento_tipo TEXT, -- "Tear Picanol", "Tear Sulzer", etc.
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  url_arquivo TEXT NOT NULL,
  total_paginas INTEGER,
  processado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Chunks of manual text for RAG
CREATE TABLE public.manual_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id UUID REFERENCES public.manuais(id) ON DELETE CASCADE NOT NULL,
  conteudo TEXT NOT NULL,
  embedding vector(768), -- Gemini embedding dimension
  pagina INTEGER,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Embeddings for OS (to find similar problems)
CREATE TABLE public.os_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id BIGINT REFERENCES public.ordens_de_servico(id) ON DELETE CASCADE NOT NULL UNIQUE,
  embedding vector(768),
  texto_indexado TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Conversation history for AI assistant
CREATE TABLE public.ia_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id BIGINT REFERENCES public.tecnicos(id_telegram) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE TABLE public.ia_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID REFERENCES public.ia_conversas(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  fontes JSONB, -- sources used (manuals, OS)
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Create indexes for vector similarity search
CREATE INDEX manual_chunks_embedding_idx ON public.manual_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX os_embeddings_embedding_idx ON public.os_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS
ALTER TABLE public.manuais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_mensagens ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all access for now (no auth implemented yet)
CREATE POLICY "Allow all access to manuais" ON public.manuais FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to manual_chunks" ON public.manual_chunks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to os_embeddings" ON public.os_embeddings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to ia_conversas" ON public.ia_conversas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to ia_mensagens" ON public.ia_mensagens FOR ALL USING (true) WITH CHECK (true);

-- Function to search similar manual chunks
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

-- Function to search similar OS
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