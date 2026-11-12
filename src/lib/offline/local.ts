import { idbStore } from './store'
import { SecureStore } from './secure-store'
import { OfflineQueue } from './queue'

/** Armazenamento cifrado do aparelho e a fila única de envio, compartilhados por todas as telas. */
export const secureStore = new SecureStore(idbStore)
export const offlineQueue = new OfflineQueue(secureStore)
