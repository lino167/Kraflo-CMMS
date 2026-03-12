-- Ajustes recomendados para qualidade do RAG

-- 1) Converter category para ENUM
CREATE TYPE public.manual_category AS ENUM (
  'eletrica',
  'pneumatica',
  'hidraulica',
  'seguranca',
  'preventiva',
  'lubrificacao',
  'troubleshooting',
  'mecanica',
  'automacao',
  'instrumentacao',
  'geral'
);

-- Normalizar valores existentes antes de converter
UPDATE public.manuais SET category = LOWER(TRIM(category)) WHERE category IS NOT NULL;

-- Converter coluna para ENUM
ALTER TABLE public.manuais
ALTER COLUMN category TYPE public.manual_category
USING category::public.manual_category;

-- 2) Documentar regras de normalização de tags
COMMENT ON COLUMN public.manuais.tags IS 
'Tags normalizadas: lowercase, sem acentos, sem espaços nas extremidades. Ex: nr-10, motor, inversor';

-- 3) Criar índices para performance do RAG e filtros
CREATE INDEX IF NOT EXISTS idx_manuais_empresa_type
ON public.manuais (empresa_id, manual_type);

CREATE INDEX IF NOT EXISTS idx_manuais_category
ON public.manuais (category);

CREATE INDEX IF NOT EXISTS idx_manuais_is_public
ON public.manuais (is_public);

CREATE INDEX IF NOT EXISTS idx_manuais_tags
ON public.manuais USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_manuais_fabricante_modelo
ON public.manuais (fabricante, modelo);

-- 4) Definir default para industry
ALTER TABLE public.manuais
ALTER COLUMN industry SET DEFAULT 'geral';