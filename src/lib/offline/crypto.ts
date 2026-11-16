/*
 * Criptografia dos dados offline. A chave é derivada do PIN do usuário (PBKDF2)
 * e existe só na memória enquanto o app está desbloqueado; no aparelho ficam
 * apenas o texto cifrado (AES-GCM), o sal e um verificador.
 */
const PBKDF2_ITERATIONS = 310_000

export interface CipherBox {
  iv: string
  ct: string
}

function toB64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function randomSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)))
}

export async function deriveKey(pin: string, saltB64: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<CipherBox> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(JSON.stringify(value))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) }
}

/** Lança erro se a chave estiver errada ou o conteúdo tiver sido alterado. */
export async function decryptJson<T>(key: CryptoKey, box: CipherBox): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.ct))
  return JSON.parse(new TextDecoder().decode(plain)) as T
}
