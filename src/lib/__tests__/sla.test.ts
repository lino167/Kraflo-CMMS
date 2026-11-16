import { describe, expect, it } from 'vitest'
import { calcularSla, formatarHoras, formatarPercentual, nivelDe, type OSParaSla } from '@/lib/sla'

const agora = new Date('2026-11-16T12:00:00Z')
const h = (horasAtras: number) => new Date(agora.getTime() - horasAtras * 3_600_000).toISOString()

const os = (p: Partial<OSParaSla>): OSParaSla => ({
  status_os: 'Fechada',
  prioridade: 'Urgente',
  tipo_manutencao: 'Corretiva',
  data_abertura: h(10),
  data_fechamento: h(9),
  ...p,
})

describe('calcularSla', () => {
  it('sem OS não inventa números', () => {
    const r = calcularSla([], agora)
    expect(r.finalizadas).toBe(0)
    expect(r.percentualGeral).toBeNull()
    expect(r.mediaGeralHoras).toBeNull()
    expect(r.niveis.every((n) => n.percentual === null && n.mediaHoras === null)).toBe(true)
  })

  it('conta no prazo e fora do prazo por nível', () => {
    const r = calcularSla(
      [
        os({ data_abertura: h(10), data_fechamento: h(9) }), // 1 h <= 2 h
        os({ data_abertura: h(10), data_fechamento: h(7) }), // 3 h > 2 h
        os({ prioridade: 'Alta', data_abertura: h(20), data_fechamento: h(16) }), // 4 h <= 6 h
      ],
      agora,
    )
    const urgente = r.niveis.find((n) => n.nivel === 'Urgente')!
    expect(urgente.finalizadas).toBe(2)
    expect(urgente.noPrazo).toBe(1)
    expect(urgente.percentual).toBe(50)
    expect(urgente.mediaHoras).toBe(2)
    const alta = r.niveis.find((n) => n.nivel === 'Alta')!
    expect(alta.percentual).toBe(100)
    expect(r.percentualGeral).toBeCloseTo((2 / 3) * 100)
  })

  it('ignora preventivas', () => {
    const r = calcularSla([os({ tipo_manutencao: 'Preventiva' })], agora)
    expect(r.finalizadas).toBe(0)
  })

  it('Média e Baixa entram no nível Média (24 h)', () => {
    expect(nivelDe('Baixa')).toBe('Média')
    expect(nivelDe(null)).toBe('Média')
    const r = calcularSla([os({ prioridade: 'Baixa', data_abertura: h(30), data_fechamento: h(10) })], agora) // 20 h
    expect(r.niveis.find((n) => n.nivel === 'Média')!.percentual).toBe(100)
  })

  it('conta OS abertas que já passaram da meta', () => {
    const r = calcularSla(
      [
        os({ status_os: 'Aberta', data_fechamento: null, data_abertura: h(3) }), // urgente aberta há 3 h > 2 h
        os({ status_os: 'Em manutenção', data_fechamento: null, data_abertura: h(1) }), // dentro
      ],
      agora,
    )
    expect(r.abertasForaDoPrazo).toBe(1)
    expect(r.finalizadas).toBe(0)
  })

  it('descarta datas inconsistentes (fechou antes de abrir)', () => {
    const r = calcularSla([os({ data_abertura: h(1), data_fechamento: h(5) })], agora)
    expect(r.finalizadas).toBe(0)
  })
})

describe('formatação', () => {
  it('formata horas', () => {
    expect(formatarHoras(null)).toBe('—')
    expect(formatarHoras(0.5)).toBe('30 min')
    expect(formatarHoras(1.5333)).toBe('1h 32m')
    expect(formatarHoras(4)).toBe('4h')
  })
  it('formata percentual', () => {
    expect(formatarPercentual(null)).toBe('—')
    expect(formatarPercentual(96.4)).toBe('96,4%')
  })
})
