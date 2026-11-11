import { describe, it, expect } from 'vitest'
import {
  nivelEstoque,
  valorEmEstoque,
  sugestaoReposicao,
  movimentacaoSchema,
  solicitacaoPortalSchema,
  portalUrl,
  equipamentoUrl,
} from '@/lib/estoque'

describe('nivelEstoque', () => {
  it('classifica zerado, baixo e ok', () => {
    expect(nivelEstoque({ quantidade: 0, estoque_minimo: 5 })).toBe('zerado')
    expect(nivelEstoque({ quantidade: 5, estoque_minimo: 5 })).toBe('baixo')
    expect(nivelEstoque({ quantidade: 6, estoque_minimo: 5 })).toBe('ok')
  })

  it('sem mínimo definido só alerta quando zera', () => {
    expect(nivelEstoque({ quantidade: 1, estoque_minimo: 0 })).toBe('ok')
    expect(nivelEstoque({ quantidade: 0, estoque_minimo: 0 })).toBe('zerado')
  })
})

describe('valorEmEstoque / sugestaoReposicao', () => {
  it('soma quantidade x custo', () => {
    expect(
      valorEmEstoque([
        { quantidade: 10, estoque_minimo: 0, custo_unitario: 2.5 },
        { quantidade: 3, estoque_minimo: 0, custo_unitario: 100 },
      ]),
    ).toBe(325)
  })

  it('sugere repor até o dobro do mínimo', () => {
    expect(sugestaoReposicao({ quantidade: 2, estoque_minimo: 5 })).toBe(8)
    expect(sugestaoReposicao({ quantidade: 20, estoque_minimo: 5 })).toBe(0)
    expect(sugestaoReposicao({ quantidade: 0, estoque_minimo: 0 })).toBe(0)
  })
})

describe('movimentacaoSchema', () => {
  const base = { saldo_atual: 10 }

  it('bloqueia saída maior que o saldo', () => {
    const r = movimentacaoSchema.safeParse({ ...base, tipo: 'saida', quantidade: 11 })
    expect(r.success).toBe(false)
  })

  it('aceita saída até o saldo e converte texto em número', () => {
    const r = movimentacaoSchema.safeParse({ ...base, tipo: 'saida', quantidade: '10' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.quantidade).toBe(10)
  })

  it('entrada exige quantidade positiva, ajuste aceita zero', () => {
    expect(movimentacaoSchema.safeParse({ ...base, tipo: 'entrada', quantidade: 0 }).success).toBe(false)
    expect(movimentacaoSchema.safeParse({ ...base, tipo: 'ajuste', quantidade: 0 }).success).toBe(true)
  })
})

describe('solicitacaoPortalSchema', () => {
  it('exige equipamento, descrição e nome', () => {
    const r = solicitacaoPortalSchema.safeParse({
      equipamento_nome: ' ',
      descricao: 'oi',
      prioridade: 'Média',
      solicitante_nome: '',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const campos = r.error.issues.map((i) => i.path[0])
      expect(campos).toEqual(expect.arrayContaining(['equipamento_nome', 'descricao', 'solicitante_nome']))
    }
  })

  it('rejeita prioridade fora da lista', () => {
    const r = solicitacaoPortalSchema.safeParse({
      equipamento_nome: 'Tear 01',
      descricao: 'Vazamento de óleo',
      prioridade: 'Crítica',
      solicitante_nome: 'Zé',
    })
    expect(r.success).toBe(false)
  })
})

describe('URLs de QR code', () => {
  it('monta o link do portal com e sem equipamento', () => {
    expect(portalUrl('https://app.kraflo.com/', 'abc123')).toBe('https://app.kraflo.com/solicitar/abc123')
    expect(portalUrl('https://app.kraflo.com', 'abc123', 'TJ 01/A')).toBe(
      'https://app.kraflo.com/solicitar/abc123?tag=TJ%2001%2FA',
    )
  })

  it('monta o link do Raio-X do equipamento', () => {
    expect(equipamentoUrl('https://app.kraflo.com', 'TJ-01')).toBe('https://app.kraflo.com/equipamento/TJ-01')
  })
})
