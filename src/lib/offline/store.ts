import { get, set } from 'idb-keyval'

/** Armazenamento chave-valor persistente no aparelho (IndexedDB em produção). */
export interface KVStore {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
}

export const idbStore: KVStore = {
  get: <T,>(key: string) => get<T>(key),
  set: <T,>(key: string, value: T) => set(key, value),
}

/** Implementação em memória, usada nos testes. */
export function memoryStore(): KVStore {
  const data = new Map<string, unknown>()
  return {
    async get<T>(key: string) {
      return data.get(key) as T | undefined
    },
    async set<T>(key: string, value: T) {
      data.set(key, value)
    },
  }
}
