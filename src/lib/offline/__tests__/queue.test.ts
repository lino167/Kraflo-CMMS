import { describe, it, expect } from 'vitest'
import { OfflineQueue, type NewOfflineOp, type OfflineOp, type SendResult } from '@/lib/offline/queue'
import { memoryStore } from '@/lib/offline/store'

const openOp = (uuid: string, nome = 'Tear 01'): NewOfflineOp => ({
  kind: 'open_os',
  open: {
    client_uuid: uuid,
    empresa_id: 'emp',
    tecnico_id: 7,
    equipamento_nome: nome,
    equipamento_tag: 'TJ-01',
    localizacao: null,
    tipo_manutencao: 'Corretiva',
    prioridade: 'Alta',
    descricao_problema: 'Vazamento de óleo',
    categoria_parada_id: 'cat-1',
    subcategoria_parada_id: null,
    opened_at: '2026-11-11T10:00:00.000Z',
  },
})

const closeOp = (osClientUuid: string | null, osId: number | null): NewOfflineOp => ({
  kind: 'close_os',
  os_client_uuid: osClientUuid,
  os_id: osId,
  pecas: [{ nome_peca: 'Óleo', tag_peca: null, quantidade: 2 }],
  close: {
    status_os: 'Fechada',
    diagnostico_solucao: 'Troca de retentor',
    notas_finais: null,
    categoria_problema_id: 'prob-1',
    subcategoria_problema_id: null,
    closed_at: '2026-11-11T12:00:00.000Z',
  },
})

const ok = async (): Promise<SendResult> => ({ kind: 'ok' })

const OWNER = 'user-a'
const add = (q: OfflineQueue, op: NewOfflineOp) => q.add(op, OWNER)
const sync = (q: OfflineQueue, send: (op: OfflineOp) => Promise<SendResult>) => q.sync(send, OWNER)

describe('OfflineQueue', () => {
  it('mantém a ordem de inclusão e persiste no armazenamento', async () => {
    const store = memoryStore()
    const q = new OfflineQueue(store)
    await add(q, openOp('a'))
    await add(q, openOp('b'))
    const again = new OfflineQueue(store)
    const ops = await again.list()
    expect(ops.map((o) => (o.kind === 'open_os' ? o.open.client_uuid : ''))).toEqual(['a', 'b'])
    expect(ops.every((o) => o.status === 'pending')).toBe(true)
  })

  it('envia tudo quando há conexão e esvazia a fila', async () => {
    const q = new OfflineQueue(memoryStore())
    await add(q, openOp('a'))
    await add(q, closeOp('a', null))
    const seen: string[] = []
    const report = await sync(q, async (op) => {
      seen.push(op.kind)
      return ok()
    })
    expect(seen).toEqual(['open_os', 'close_os'])
    expect(report).toEqual({ sent: 2, conflicts: 0, errors: 0, offline: false })
    expect(await q.list()).toEqual([])
  })

  it('para no primeiro erro de rede e mantém a fila para a próxima tentativa', async () => {
    const q = new OfflineQueue(memoryStore())
    await add(q, openOp('a'))
    await add(q, openOp('b'))
    const report = await sync(q, async () => ({ kind: 'network' }))
    expect(report).toEqual({ sent: 0, conflicts: 0, errors: 0, offline: true })
    const ops = await q.list()
    expect(ops).toHaveLength(2)
    expect(ops[0].attempts).toBe(1)
  })

  it('guarda progresso parcial de um envio interrompido', async () => {
    const q = new OfflineQueue(memoryStore())
    await add(q, closeOp('a', 10))
    await sync(q, async () => ({ kind: 'network', patch: { parts_sent: true } }))
    const [op] = await q.list()
    expect(op.parts_sent).toBe(true)
  })

  it('conflito não trava as demais operações e fica marcado para revisão', async () => {
    const q = new OfflineQueue(memoryStore())
    await add(q, closeOp(null, 5))
    await add(q, openOp('b'))
    const report = await sync(q, async (op: OfflineOp) =>
      op.kind === 'close_os'
        ? { kind: 'conflict', message: 'OS #5 já está "Fechada" no servidor' }
        : ok(),
    )
    expect(report).toEqual({ sent: 1, conflicts: 1, errors: 0, offline: false })
    const [remaining] = await q.list()
    expect(remaining.status).toBe('conflict')
    expect(remaining.message).toContain('já está')
  })

  it('erro de validação marca a operação e permite descartar ou reenviar', async () => {
    const q = new OfflineQueue(memoryStore())
    const added = await add(q, openOp('a'))
    await sync(q, async () => ({ kind: 'error', message: 'Categoria inválida' }))
    expect((await q.list())[0].status).toBe('error')

    await q.requeue(added.id)
    expect((await q.list())[0].status).toBe('pending')

    await q.discard(added.id)
    expect(await q.list()).toEqual([])
  })

  it('não envia duas vezes quando a sincronização é chamada em paralelo', async () => {
    const q = new OfflineQueue(memoryStore())
    await add(q, openOp('a'))
    let calls = 0
    const send = async (): Promise<SendResult> => {
      calls += 1
      await new Promise((r) => setTimeout(r, 10))
      return ok()
    }
    const [r1, r2] = await Promise.all([sync(q, send), sync(q, send)])
    expect(calls).toBe(1)
    expect(r1).toBe(r2)
  })

  it('ao reenviar após queda, operação já aplicada no servidor não é duplicada (idempotência por client_uuid)', async () => {
    // Simula o servidor: o primeiro envio chega, mas a resposta se perde (rede cai depois).
    const serverRows = new Set<string>()
    const serverInsert = async (uuid: string): Promise<SendResult> => {
      if (!serverRows.has(uuid)) serverRows.add(uuid)
      return ok()
    }
    const q = new OfflineQueue(memoryStore())
    await add(q, openOp('uuid-1'))
    let first = true
    await sync(q, async (op) => {
      if (op.kind !== 'open_os') return ok()
      await serverInsert(op.open.client_uuid)
      if (first) {
        first = false
        return { kind: 'network' }
      }
      return serverInsert(op.open.client_uuid)
    })
    await sync(q, async (op) => (op.kind === 'open_os' ? serverInsert(op.open.client_uuid) : ok()))
    expect(serverRows.size).toBe(1)
    expect(await q.list()).toEqual([])
  })

  it('não envia lançamentos de outro usuário que estejam no mesmo aparelho', async () => {
    const q = new OfflineQueue(memoryStore())
    await add(q, openOp('do-a'))
    await q.add(openOp('do-b'), 'user-b')
    const enviados: string[] = []
    await sync(q, async (op) => {
      if (op.kind === 'open_os') enviados.push(op.open.client_uuid)
      return ok()
    })
    expect(enviados).toEqual(['do-a'])
    const restantes = await q.list()
    expect(restantes).toHaveLength(1)
    expect(restantes[0].owner_id).toBe('user-b')
  })

  it('clear() apaga toda a fila', async () => {
    const q = new OfflineQueue(memoryStore())
    await add(q, openOp('a'))
    await q.clear()
    expect(await q.list()).toEqual([])
  })
})
