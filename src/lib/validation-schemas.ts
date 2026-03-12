/**
 * Centralized Zod Validation Schemas for KRAFLO
 * All form validations should use these schemas
 */

import { z } from 'zod';

// Common field validations
const requiredString = (fieldName: string) => 
  z.string().trim().min(1, `${fieldName} é obrigatório`);

const optionalString = () => 
  z.string().trim().optional().or(z.literal(''));

const email = () => 
  z.string().trim().email('Email inválido').max(255, 'Email muito longo');

const password = () => 
  z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(72, 'Senha muito longa');

// OS (Ordem de Serviço) Schema
export const osFormSchema = z.object({
  equipamento_nome: requiredString('Nome do equipamento')
    .max(200, 'Nome do equipamento muito longo'),
  equipamento_tag: optionalString()
    .transform(v => v || null),
  localizacao: optionalString()
    .transform(v => v || null),
  tipo_manutencao: z.enum(['Corretiva', 'Preventiva', 'Preditiva'], {
    errorMap: () => ({ message: 'Tipo de manutenção inválido' }),
  }).optional().nullable(),
  prioridade: z.enum(['Baixa', 'Média', 'Alta', 'Urgente'], {
    errorMap: () => ({ message: 'Prioridade inválida' }),
  }).optional().nullable(),
  descricao_problema: optionalString()
    .transform(v => v || null),
  diagnostico_solucao: optionalString()
    .transform(v => v || null),
  notas_finais: optionalString()
    .transform(v => v || null),
});

export type OSFormData = z.infer<typeof osFormSchema>;

// OS Close Schema
export const osCloseSchema = z.object({
  status_os: z.enum(['Fechada', 'Liberado para produção', 'Aguardando peças', 'Em manutenção'], {
    errorMap: () => ({ message: 'Status inválido' }),
  }),
  diagnostico_solucao: requiredString('Diagnóstico/causa')
    .max(2000, 'Diagnóstico muito longo'),
  notas_finais: optionalString()
    .transform(v => v || null),
});

export type OSCloseData = z.infer<typeof osCloseSchema>;

// Parts (Peças) Schema
export const pecaSchema = z.object({
  nome_peca: requiredString('Nome da peça')
    .max(200, 'Nome da peça muito longo'),
  tag_peca: optionalString()
    .transform(v => v || null),
  quantidade: z.number()
    .int('Quantidade deve ser um número inteiro')
    .min(1, 'Quantidade deve ser pelo menos 1')
    .max(9999, 'Quantidade muito grande'),
});

export type PecaData = z.infer<typeof pecaSchema>;

// Login Schema
export const loginSchema = z.object({
  email: email(),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export type LoginData = z.infer<typeof loginSchema>;

// Signup Schema
export const signupSchema = z.object({
  nomeCompleto: requiredString('Nome completo')
    .max(200, 'Nome muito longo'),
  email: email(),
  password: password(),
  confirmPassword: z.string(),
  funcao: optionalString(),
  setor: optionalString(),
  codigoEmpresa: optionalString(),
  idTelegram: optionalString()
    .refine(
      (val) => !val || /^\d+$/.test(val),
      'ID Telegram deve conter apenas números'
    ),
  nomeEmpresa: optionalString(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export type SignupData = z.infer<typeof signupSchema>;

// Manual Upload Schema
export const manualUploadSchema = z.object({
  equipamento_tipo: optionalString(),
});

export type ManualUploadData = z.infer<typeof manualUploadSchema>;

// AI Chat Schema
export const aiMessageSchema = z.object({
  mensagem: requiredString('Mensagem')
    .max(4000, 'Mensagem muito longa'),
});

export type AIMessageData = z.infer<typeof aiMessageSchema>;

// Date Range Schema
export const dateRangeSchema = z.object({
  from: z.date(),
  to: z.date(),
}).refine((data) => data.from <= data.to, {
  message: 'Data inicial deve ser anterior à data final',
  path: ['from'],
});

export type DateRangeData = z.infer<typeof dateRangeSchema>;

// Search/Filter Schema
export const searchFilterSchema = z.object({
  query: optionalString().transform(v => v || ''),
  status: z.enum(['all', 'Aberta', 'Em manutenção', 'Não liberado', 'Fechada', 'Liberado para produção']).optional(),
  prioridade: z.enum(['all', 'Baixa', 'Média', 'Alta', 'Urgente']).optional(),
});

export type SearchFilterData = z.infer<typeof searchFilterSchema>;

// Helper function to validate data
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

// Helper to get first error message
export function getFirstError(error: z.ZodError): string {
  return error.errors[0]?.message || 'Dados inválidos';
}
