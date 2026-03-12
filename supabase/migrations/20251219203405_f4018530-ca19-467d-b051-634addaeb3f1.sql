-- Prompt 1: Evoluir tabela manuais para metadados universais

-- Criar enum para tipo de manual
CREATE TYPE public.manual_type AS ENUM ('general', 'equipment');

-- Adicionar novos campos à tabela manuais
ALTER TABLE public.manuais
ADD COLUMN IF NOT EXISTS manual_type public.manual_type NOT NULL DEFAULT 'equipment',
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS industry text,
ADD COLUMN IF NOT EXISTS fabricante text,
ADD COLUMN IF NOT EXISTS modelo text,
ADD COLUMN IF NOT EXISTS equipamento_id uuid,
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Adicionar constraint para equipamento_id (opcional, sem FK rígida por flexibilidade)
COMMENT ON COLUMN public.manuais.manual_type IS 'Tipo: general (NRs, segurança, etc) ou equipment (específico de máquina)';
COMMENT ON COLUMN public.manuais.category IS 'Categoria: eletrica, pneumatica, seguranca, preventiva, hidraulica, lubrificacao, troubleshooting';
COMMENT ON COLUMN public.manuais.tags IS 'Tags padronizadas para busca';
COMMENT ON COLUMN public.manuais.industry IS 'Segmento: textil, hvac, predial, automotivo, geral';
COMMENT ON COLUMN public.manuais.fabricante IS 'Fabricante do equipamento';
COMMENT ON COLUMN public.manuais.modelo IS 'Modelo do equipamento';
COMMENT ON COLUMN public.manuais.is_public IS 'Se true, acessível por todas as empresas (somente leitura)';