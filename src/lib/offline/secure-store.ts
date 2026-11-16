import type { KVStore } from './store'
import { decryptJson, encryptJson, type CipherBox } from './crypto'

export class LockedError extends Error {
  constructor() {
    super('Dados offline bloqueados: informe o PIN')
    this.name = 'LockedError'
  }
}

/** Armazenamento que grava tudo cifrado. Só lê ou grava enquanto estiver desbloqueado. */
export class SecureStore implements KVStore {
  private key: CryptoKey | null = null

  constructor(private readonly base: KVStore) {}

  get isUnlocked(): boolean {
    return this.key !== null
  }

  unlock(key: CryptoKey): void {
    this.key = key
  }

  lock(): void {
    this.key = null
  }

  async get<T>(name: string): Promise<T | undefined> {
    if (!this.key) throw new LockedError()
    const box = await this.base.get<CipherBox>(name)
    if (!box) return undefined
    return decryptJson<T>(this.key, box)
  }

  async set<T>(name: string, value: T): Promise<void> {
    if (!this.key) throw new LockedError()
    await this.base.set(name, await encryptJson(this.key, value))
  }

  del(name: string): Promise<void> {
    return this.base.del(name)
  }
}
