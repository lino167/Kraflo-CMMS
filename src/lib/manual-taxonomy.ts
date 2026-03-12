/**
 * Prompt 2: Taxonomia padronizada para manuais
 * Vocabulário controlado para categorias, indústrias e tags
 */

import { z } from 'zod';

// Categorias permitidas (alinhadas com ENUM manual_category no banco)
export const MANUAL_CATEGORIES = [
  { value: 'eletrica', label: 'Elétrica' },
  { value: 'pneumatica', label: 'Pneumática' },
  { value: 'hidraulica', label: 'Hidráulica' },
  { value: 'seguranca', label: 'Segurança (NRs)' },
  { value: 'preventiva', label: 'Manutenção Preventiva' },
  { value: 'lubrificacao', label: 'Lubrificação' },
  { value: 'troubleshooting', label: 'Troubleshooting' },
  { value: 'mecanica', label: 'Mecânica' },
  { value: 'automacao', label: 'Automação' },
  { value: 'instrumentacao', label: 'Instrumentação' },
  { value: 'geral', label: 'Geral' },
] as const;

export type ManualCategory = typeof MANUAL_CATEGORIES[number]['value'];

// Indústrias/Segmentos
export const MANUAL_INDUSTRIES = [
  { value: 'geral', label: 'Geral' },
  { value: 'textil', label: 'Têxtil' },
  { value: 'hvac', label: 'HVAC / Refrigeração' },
  { value: 'predial', label: 'Predial / Facilities' },
  { value: 'automotivo', label: 'Automotivo' },
  { value: 'alimenticio', label: 'Alimentício' },
  { value: 'metalurgico', label: 'Metalúrgico' },
  { value: 'quimico', label: 'Químico' },
  { value: 'farmaceutico', label: 'Farmacêutico' },
] as const;

export type ManualIndustry = typeof MANUAL_INDUSTRIES[number]['value'];

// Tags sugeridas (lista extensível)
export const SUGGESTED_TAGS = [
  'nr-10', 'nr-12', 'nr-35', 'nr-33',
  'motor', 'redutor', 'inversor', 'clp', 'ihm',
  'compressor', 'valvula', 'cilindro', 'bomba',
  'sensor', 'transmissor', 'atuador',
  'rolamento', 'correia', 'engrenagem',
  'oleo', 'graxa', 'filtro',
  'manutencao-corretiva', 'manutencao-preditiva',
  'check-list', 'procedimento', 'diagrama',
] as const;

// Tipos de manual
export const MANUAL_TYPES = [
  { value: 'general', label: 'Geral (NRs, boas práticas, procedimentos)' },
  { value: 'equipment', label: 'Equipamento específico' },
] as const;

export type ManualType = 'general' | 'equipment';

// Função para normalizar tags
export function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9-]/g, '-') // substitui caracteres especiais por hífen
    .replace(/-+/g, '-') // remove hífens duplicados
    .replace(/^-|-$/g, ''); // remove hífens no início/fim
}

// Schema Zod para validação do formulário de upload
export const manualUploadSchema = z.object({
  nome_arquivo: z.string().min(1, 'Nome do arquivo é obrigatório'),
  manual_type: z.enum(['general', 'equipment'], {
    required_error: 'Tipo de manual é obrigatório',
  }),
  category: z.string().min(1, 'Categoria é obrigatória'),
  tags: z.array(z.string()).default([]),
  industry: z.string().optional(),
  fabricante: z.string().optional(),
  modelo: z.string().optional(),
  equipamento_tipo: z.string().optional(),
  is_public: z.boolean().default(false),
}).refine(
  (data) => {
    // Se for tipo equipment, fabricante ou modelo são recomendados
    if (data.manual_type === 'equipment') {
      return data.fabricante || data.modelo || data.equipamento_tipo;
    }
    return true;
  },
  {
    message: 'Para manuais de equipamento, informe fabricante, modelo ou tipo de equipamento',
    path: ['fabricante'],
  }
);

export type ManualUploadFormData = z.infer<typeof manualUploadSchema>;
