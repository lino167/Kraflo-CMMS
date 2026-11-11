import { z } from 'zod'

export interface PecaSaldo {
  quantidade: number
  estoque_minimo: number
  custo_unitario: number
}

export type NivelEstoque = 'zerado' | 'baixo' | 'ok'

/** Classifica o saldo em relação ao estoque mínimo. */
export function nivelEstoque(peca: Pick<PecaSaldo, 'quantidade' | 'estoque_minimo'>): NivelEstoque {
  if (peca.quantidade <= 0) return 'zerado'
  if (peca.quantidade <= peca.estoque_minimo) return 'baixo'
  return 'ok'
}

/** Valor total imobilizado em estoque. */
export function valorEmEstoque(pecas: PecaSaldo[]): number {
  return pecas.reduce((total, p) => total + p.quantidade * p.custo_unitario, 0)
}

/** Quantidade sugerida de compra para voltar a 2x o mínimo. */
export function sugestaoReposicao(peca: Pick<PecaSaldo, 'quantidade' | 'estoque_minimo'>): number {
  if (nivelEstoque(peca) === 'ok' || peca.estoque_minimo <= 0) return 0
  return Math.max(0, peca.estoque_minimo * 2 - peca.quantidade)
}

export function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatQtd(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

const numero = (min: number, msg: string) =>
  z.coerce.number({ invalid_type_error: 'Informe um número' }).min(min, msg)

export const pecaSchema = z.object({
  codigo: z.string().trim().max(60).optional(),
  nome: z.string().trim().min(2, 'Informe o nome da peça').max(150),
  unidade: z.string().trim().min(1).max(10),
  estoque_minimo: numero(0, 'Não pode ser negativo'),
  custo_unitario: numero(0, 'Não pode ser negativo'),
  localizacao: z.string().trim().max(120).optional(),
  fornecedor: z.string().trim().max(120).optional(),
})

export const movimentacaoSchema = z
  .object({
    tipo: z.enum(['entrada', 'saida', 'ajuste']),
    quantidade: numero(0, 'Não pode ser negativo'),
    custo_unitario: numero(0, 'Não pode ser negativo').optional(),
    observacao: z.string().trim().max(300).optional(),
    saldo_atual: z.number(),
  })
  .superRefine((mov, ctx) => {
    if (mov.tipo !== 'ajuste' && mov.quantidade <= 0) {
      ctx.addIssue({ code: 'custom', path: ['quantidade'], message: 'Informe uma quantidade maior que zero' })
    }
    if (mov.tipo === 'saida' && mov.quantidade > mov.saldo_atual) {
      ctx.addIssue({ code: 'custom', path: ['quantidade'], message: 'Quantidade maior que o saldo em estoque' })
    }
  })

export const solicitacaoPortalSchema = z.object({
  equipamento_nome: z.string().trim().min(2, 'Informe o equipamento').max(150),
  equipamento_tag: z.string().trim().max(60).optional(),
  localizacao: z.string().trim().max(150).optional(),
  descricao: z.string().trim().min(5, 'Descreva o problema com mais detalhes').max(2000),
  prioridade: z.enum(['Baixa', 'Média', 'Alta', 'Urgente']),
  solicitante_nome: z.string().trim().min(2, 'Informe seu nome').max(120),
  solicitante_contato: z.string().trim().max(120).optional(),
})

export type SolicitacaoPortal = z.infer<typeof solicitacaoPortalSchema>

/** URL pública do portal de solicitações; `tag` pré-seleciona o equipamento. */
export function portalUrl(origin: string, token: string, tag?: string | null): string {
  const base = `${origin.replace(/\/$/, '')}/solicitar/${encodeURIComponent(token)}`
  return tag ? `${base}?tag=${encodeURIComponent(tag)}` : base
}

/** URL interna (exige login) do histórico do equipamento. */
export function equipamentoUrl(origin: string, tag: string): string {
  return `${origin.replace(/\/$/, '')}/equipamento/${encodeURIComponent(tag)}`
}
