import type { KVStore } from './store'

/*
 * Fila de operações feitas offline (abrir e fechar OS).
 *
 * Regras:
 * - Cada operação tem um identificador gerado no aparelho (client_uuid). O servidor
 *   usa esse identificador para não criar a mesma OS duas vezes se o envio for repetido.
 * - A fila é enviada na ordem em que as operações foram feitas.
 * - Falha de rede interrompe o envio e mantém a fila intacta para a próxima tentativa.
 * - Conflitos (ex.: a OS já foi fechada por outra pessoa) e erros de validação não
 *   travam a fila: a operação fica marcada para revisão do usuário.
 *
 * Este módulo não importa o cliente do Supabase: a chamada ao servidor é injetada,
 * o que permite testar toda a regra de sincronização sem rede.
 */

export interface OpenFields {
  client_uuid: string
  empresa_id: string
  tecnico_id: number
  equipamento_nome: string
  equipamento_tag: string | null
  localizacao: string | null
  tipo_manutencao: string
  prioridade: string
  descricao_problema: string
  categoria_parada_id: string
  subcategoria_parada_id: string | null
  opened_at: string
}

export interface CloseFields {
  status_os: 'Fechada' | 'Liberado para produção' | 'Não liberado'
  diagnostico_solucao: string
  notas_finais: string | null
  categoria_problema_id: string
  subcategoria_problema_id: string | null
  closed_at: string
}

export interface PecaOffline {
  nome_peca: string
  tag_peca: string | null
  quantidade: number
}

interface BaseOp {
  id: string
  created_at: string
  attempts: number
  status: 'pending' | 'conflict' | 'error'
  message: string | null
  /** Progresso parcial de um envio interrompido (ex.: peças já gravadas) */
  parts_sent?: boolean
}

export type OfflineOp =
  | (BaseOp & { kind: 'open_os'; open: OpenFields })
  | (BaseOp & {
      kind: 'close_os'
      os_client_uuid: string | null
      os_id: number | null
      close: CloseFields
      pecas: PecaOffline[]
    })

export type NewOfflineOp =
  | { kind: 'open_os'; open: OpenFields }
  | {
      kind: 'close_os'
      os_client_uuid: string | null
      os_id: number | null
      close: CloseFields
      pecas: PecaOffline[]
    }

export type SendResult =
  | { kind: 'ok' }
  | { kind: 'conflict'; message: string }
  | { kind: 'error'; message: string }
  /** Sem conexão: para o envio. `patch` guarda progresso parcial, se houver. */
  | { kind: 'network'; patch?: Partial<Pick<BaseOp, 'parts_sent'>> }

export interface SyncReport {
  sent: number
  conflicts: number
  errors: number
  offline: boolean
}

const QUEUE_KEY = 'offline:queue:v1'

function newId(): string {
  return globalThis.crypto.randomUUID()
}

export class OfflineQueue {
  private chain: Promise<unknown> = Promise.resolve()
  private syncing: Promise<SyncReport> | null = null

  constructor(private readonly store: KVStore) {}

  /** Serializa leituras e escritas para não perder operações em paralelo. */
  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn)
    this.chain = run.catch(() => undefined)
    return run
  }

  private async read(): Promise<OfflineOp[]> {
    return (await this.store.get<OfflineOp[]>(QUEUE_KEY)) ?? []
  }

  private async write(ops: OfflineOp[]): Promise<void> {
    await this.store.set(QUEUE_KEY, ops)
  }

  list(): Promise<OfflineOp[]> {
    return this.locked(() => this.read())
  }

  add(op: NewOfflineOp): Promise<OfflineOp> {
    return this.locked(async () => {
      const ops = await this.read()
      const full = {
        ...op,
        id: newId(),
        created_at: new Date().toISOString(),
        attempts: 0,
        status: 'pending',
        message: null,
      } as OfflineOp
      await this.write([...ops, full])
      return full
    })
  }

  /** Remove uma operação que o usuário decidiu descartar (conflito ou erro). */
  discard(id: string): Promise<void> {
    return this.locked(async () => {
      await this.write((await this.read()).filter((o) => o.id !== id))
    })
  }

  /** Volta uma operação com erro para a fila, para nova tentativa. */
  requeue(id: string): Promise<void> {
    return this.locked(async () => {
      const ops = await this.read()
      await this.write(
        ops.map((o) => (o.id === id ? { ...o, status: 'pending', message: null } : o)),
      )
    })
  }

  /**
   * Envia as operações pendentes em ordem. Chamadas simultâneas reutilizam o envio em curso.
   */
  sync(send: (op: OfflineOp) => Promise<SendResult>): Promise<SyncReport> {
    if (this.syncing) return this.syncing

    const run = this.locked(async () => {
      const report: SyncReport = { sent: 0, conflicts: 0, errors: 0, offline: false }
      let ops = await this.read()

      for (const op of ops) {
        if (op.status !== 'pending') continue

        const result = await send(op)

        if (result.kind === 'network') {
          report.offline = true
          const patch = result.patch ?? {}
          ops = ops.map((o) =>
            o.id === op.id ? ({ ...o, ...patch, attempts: o.attempts + 1 } as OfflineOp) : o,
          )
          await this.write(ops)
          break
        }

        if (result.kind === 'ok') {
          ops = ops.filter((o) => o.id !== op.id)
          report.sent += 1
        } else {
          ops = ops.map((o) =>
            o.id === op.id
              ? {
                  ...o,
                  status: result.kind === 'conflict' ? 'conflict' : 'error',
                  message: result.message,
                  attempts: o.attempts + 1,
                }
              : o,
          )
          if (result.kind === 'conflict') report.conflicts += 1
          else report.errors += 1
        }
        await this.write(ops)
      }

      return report
    })

    this.syncing = run.finally(() => {
      this.syncing = null
    })
    return this.syncing
  }
}
