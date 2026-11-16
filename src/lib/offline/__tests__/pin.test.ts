// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { memoryStore } from '@/lib/offline/store'
import { SecureStore, LockedError } from '@/lib/offline/secure-store'
import { PIN_MAX_ATTEMPTS, pinOwner, setupPin, unlockWithPin, validatePin, wipeLocalData } from '@/lib/offline/pin'
import { OfflineQueue } from '@/lib/offline/queue'

describe('validatePin', () => {
  it('recusa PIN curto, não numérico, repetido ou em sequência', () => {
    expect(validatePin('12345')).toBeTruthy()
    expect(validatePin('abc123')).toBeTruthy()
    expect(validatePin('111111')).toBeTruthy()
    expect(validatePin('123456')).toBeTruthy()
    expect(validatePin('654321')).toBeTruthy()
    expect(validatePin('482915')).toBeNull()
  })
})

describe('PIN e armazenamento cifrado', () => {
  it('sem desbloquear, não lê nem grava', async () => {
    const secure = new SecureStore(memoryStore())
    await expect(secure.get('x')).rejects.toBeInstanceOf(LockedError)
    await expect(secure.set('x', 1)).rejects.toBeInstanceOf(LockedError)
  })

  it('o que fica no aparelho não contém o texto original', async () => {
    const base = memoryStore()
    const secure = new SecureStore(base)
    secure.unlock(await setupPin(base, '482915', 'user-a'))
    await secure.set('offline:snapshot:v2', { maquinas: [{ nome: 'Tear Jato de Ar 01' }] })
    const raw = JSON.stringify(await base.get('offline:snapshot:v2'))
    expect(raw).not.toContain('Tear Jato')
    expect(await secure.get('offline:snapshot:v2')).toEqual({ maquinas: [{ nome: 'Tear Jato de Ar 01' }] })
  })

  it('PIN certo desbloqueia os mesmos dados depois de fechar o app', async () => {
    const base = memoryStore()
    const s1 = new SecureStore(base)
    s1.unlock(await setupPin(base, '482915', 'user-a'))
    const q1 = new OfflineQueue(s1)
    await q1.add({ kind: 'close_os', os_id: 5, os_client_uuid: null, empresa_id: 'e', pecas: [], foto: null,
      close: { status_os: 'Fechada', diagnostico_solucao: 'Troca de correia', notas_finais: null, categoria_problema_id: 'c', subcategoria_problema_id: null, closed_at: 'x' } }, 'user-a')

    const s2 = new SecureStore(base) // app reaberto: chave não está mais na memória
    const r = await unlockWithPin(base, '482915')
    expect(r.ok).toBe(true)
    if (r.ok) s2.unlock(r.key)
    expect(await new OfflineQueue(s2).list()).toHaveLength(1)
    expect(await pinOwner(base)).toBe('user-a')
  })

  it('PIN errado não desbloqueia e conta as tentativas', async () => {
    const base = memoryStore()
    await setupPin(base, '482915', 'user-a')
    const r = await unlockWithPin(base, '000001')
    expect(r).toEqual({ ok: false, remaining: PIN_MAX_ATTEMPTS - 1, wiped: false })
  })

  it(`após ${PIN_MAX_ATTEMPTS} erros seguidos os dados offline são apagados`, async () => {
    const base = memoryStore()
    const secure = new SecureStore(base)
    secure.unlock(await setupPin(base, '482915', 'user-a'))
    await secure.set('offline:queue:v2', [{ id: '1' }])
    let last
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i++) last = await unlockWithPin(base, '000001')
    expect(last).toEqual({ ok: false, remaining: 0, wiped: true })
    expect(await base.get('offline:queue:v2')).toBeUndefined()
    expect(await pinOwner(base)).toBeNull()
    expect((await unlockWithPin(base, '482915')).ok).toBe(false)
  })

  it('acerto zera o contador de erros', async () => {
    const base = memoryStore()
    await setupPin(base, '482915', 'user-a')
    await unlockWithPin(base, '000001')
    expect((await unlockWithPin(base, '482915')).ok).toBe(true)
    const r = await unlockWithPin(base, '000001')
    expect(r).toMatchObject({ remaining: PIN_MAX_ATTEMPTS - 1 })
  })

  it('wipeLocalData remove PIN, dados de apoio e fila', async () => {
    const base = memoryStore()
    const secure = new SecureStore(base)
    secure.unlock(await setupPin(base, '482915', 'user-a'))
    await secure.set('offline:snapshot:v2', { a: 1 })
    await wipeLocalData(base)
    expect(await base.get('offline:snapshot:v2')).toBeUndefined()
    expect(await pinOwner(base)).toBeNull()
  })
})
