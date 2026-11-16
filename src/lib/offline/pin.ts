import type { KVStore } from './store'
import { decryptJson, deriveKey, encryptJson, randomSalt, type CipherBox } from './crypto'

export const PIN_MIN_LENGTH = 6
export const PIN_MAX_ATTEMPTS = 5

const PIN_KEY = 'offline:pin:v1'
/** Todas as chaves de dados offline; apagadas juntas no logout ou após erros demais de PIN. */
export const OFFLINE_DATA_KEYS = ['offline:snapshot:v1', 'offline:queue:v1', 'offline:snapshot:v2', 'offline:queue:v2']
const CHECK_VALUE = 'kraflo-pin-ok'

interface PinMeta {
  salt: string
  check: CipherBox
  fails: number
  owner_id: string
}

export type UnlockResult =
  | { ok: true; key: CryptoKey }
  | { ok: false; remaining: number; wiped: boolean }

export function validatePin(pin: string): string | null {
  if (pin.length < PIN_MIN_LENGTH) return `O PIN precisa ter pelo menos ${PIN_MIN_LENGTH} dígitos.`
  if (!/^\d+$/.test(pin)) return 'Use apenas números no PIN.'
  if (/^(\d)\1+$/.test(pin)) return 'Evite um PIN com todos os dígitos iguais.'
  if ('0123456789012345'.includes(pin) || '9876543210987654'.includes(pin)) return 'Evite sequências como 123456.'
  return null
}

/** Dono do PIN gravado neste aparelho, ou null se não houver PIN. */
export async function pinOwner(base: KVStore): Promise<string | null> {
  return (await base.get<PinMeta>(PIN_KEY))?.owner_id ?? null
}

/** Cria o PIN (substitui qualquer dado offline anterior, que não seria legível com a nova chave). */
export async function setupPin(base: KVStore, pin: string, ownerId: string): Promise<CryptoKey> {
  const invalid = validatePin(pin)
  if (invalid) throw new Error(invalid)
  await wipeLocalData(base)
  const salt = randomSalt()
  const key = await deriveKey(pin, salt)
  const meta: PinMeta = { salt, check: await encryptJson(key, CHECK_VALUE), fails: 0, owner_id: ownerId }
  await base.set(PIN_KEY, meta)
  return key
}

/** Confere o PIN. Depois de PIN_MAX_ATTEMPTS erros seguidos, apaga os dados offline do aparelho. */
export async function unlockWithPin(base: KVStore, pin: string): Promise<UnlockResult> {
  const meta = await base.get<PinMeta>(PIN_KEY)
  if (!meta) return { ok: false, remaining: 0, wiped: true }

  const key = await deriveKey(pin, meta.salt)
  let valid = false
  try {
    valid = (await decryptJson<string>(key, meta.check)) === CHECK_VALUE
  } catch {
    valid = false
  }

  if (valid) {
    if (meta.fails > 0) await base.set(PIN_KEY, { ...meta, fails: 0 })
    return { ok: true, key }
  }

  const fails = meta.fails + 1
  if (fails >= PIN_MAX_ATTEMPTS) {
    await wipeLocalData(base)
    return { ok: false, remaining: 0, wiped: true }
  }
  await base.set(PIN_KEY, { ...meta, fails })
  return { ok: false, remaining: PIN_MAX_ATTEMPTS - fails, wiped: false }
}

/** Apaga PIN, dados de apoio e fila de envio deste aparelho. */
export async function wipeLocalData(base: KVStore): Promise<void> {
  await Promise.all([...OFFLINE_DATA_KEYS, PIN_KEY].map((k) => base.del(k)))
}
