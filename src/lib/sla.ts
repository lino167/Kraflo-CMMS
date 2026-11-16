/**
 * SLA de atendimento calculado a partir das OS reais.
 *
 * Meta de resolução por prioridade (horas entre a abertura e o fechamento):
 *   Urgente: 2 h · Alta: 6 h · Média e Baixa: 24 h.
 *
 * Só entram OS corretivas e preditivas: uma preventiva é agendada e não tem urgência de atendimento.
 */

export interface OSParaSla {
  status_os: string
  prioridade: string | null
  tipo_manutencao: string | null
  data_abertura: string
  data_fechamento: string | null
}

export type NivelSla = 'Urgente' | 'Alta' | 'Média'

export const METAS_SLA_HORAS: Record<NivelSla, number> = {
  Urgente: 2,
  Alta: 6,
  Média: 24,
}

const FINALIZADAS = ['Fechada', 'Liberado para produção', 'Não liberado']

export interface ResumoSla {
  nivel: NivelSla
  metaHoras: number
  /** OS finalizadas que entraram na conta. */
  finalizadas: number
  /** Quantas fecharam dentro da meta. */
  noPrazo: number
  /** Percentual dentro da meta, ou null quando ainda não há OS finalizadas. */
  percentual: number | null
  /** Tempo médio real de resolução, em horas, ou null sem dados. */
  mediaHoras: number | null
  /** OS ainda abertas que já passaram da meta. */
  abertasForaDoPrazo: number
}

export interface ResultadoSla {
  niveis: ResumoSla[]
  finalizadas: number
  noPrazo: number
  percentualGeral: number | null
  mediaGeralHoras: number | null
  abertasForaDoPrazo: number
}

/** A prioridade vira um nível de SLA; sem prioridade conhecida, conta como Média. */
export function nivelDe(prioridade: string | null): NivelSla {
  if (prioridade === 'Urgente') return 'Urgente'
  if (prioridade === 'Alta') return 'Alta'
  return 'Média'
}

const horasEntre = (inicio: string, fim: number) => (fim - new Date(inicio).getTime()) / 3_600_000

export function calcularSla(lista: OSParaSla[], agora: Date = new Date()): ResultadoSla {
  const considerar = lista.filter((os) => os.tipo_manutencao !== 'Preventiva')
  const niveis = (Object.keys(METAS_SLA_HORAS) as NivelSla[]).map((nivel): ResumoSla => {
    const meta = METAS_SLA_HORAS[nivel]
    const doNivel = considerar.filter((os) => nivelDe(os.prioridade) === nivel)

    const duracoes = doNivel
      .filter((os) => FINALIZADAS.includes(os.status_os) && os.data_fechamento)
      .map((os) => horasEntre(os.data_abertura, new Date(os.data_fechamento as string).getTime()))
      .filter((h) => Number.isFinite(h) && h >= 0)

    const noPrazo = duracoes.filter((h) => h <= meta).length
    const abertas = doNivel.filter((os) => !FINALIZADAS.includes(os.status_os))
    const abertasForaDoPrazo = abertas.filter((os) => horasEntre(os.data_abertura, agora.getTime()) > meta).length

    return {
      nivel,
      metaHoras: meta,
      finalizadas: duracoes.length,
      noPrazo,
      percentual: duracoes.length ? (noPrazo / duracoes.length) * 100 : null,
      mediaHoras: duracoes.length ? duracoes.reduce((a, b) => a + b, 0) / duracoes.length : null,
      abertasForaDoPrazo,
    }
  })

  const finalizadas = niveis.reduce((n, x) => n + x.finalizadas, 0)
  const noPrazo = niveis.reduce((n, x) => n + x.noPrazo, 0)
  const somaHoras = niveis.reduce((n, x) => n + (x.mediaHoras ?? 0) * x.finalizadas, 0)

  return {
    niveis,
    finalizadas,
    noPrazo,
    percentualGeral: finalizadas ? (noPrazo / finalizadas) * 100 : null,
    mediaGeralHoras: finalizadas ? somaHoras / finalizadas : null,
    abertasForaDoPrazo: niveis.reduce((n, x) => n + x.abertasForaDoPrazo, 0),
  }
}

/** 1.53 -> "1h 32m"; 0.5 -> "30 min"; null -> "—". */
export function formatarHoras(horas: number | null): string {
  if (horas === null || !Number.isFinite(horas)) return '—'
  const totalMin = Math.round(horas * 60)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`
}

export function formatarPercentual(p: number | null): string {
  return p === null ? '—' : `${p.toFixed(1).replace('.', ',')}%`
}
