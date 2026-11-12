/** Tempo máximo de uso offline sem revalidar o acesso com o servidor. */
export const OFFLINE_ACCESS_MAX_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * O acesso offline só vale se o perfil foi validado com o servidor nos últimos N dias.
 * Assim, um técnico desligado ou afastado perde o acesso local mesmo sem conexão.
 */
export function isOfflineAccessValid(validatedAt: number | null, now: number = Date.now()): boolean {
  if (validatedAt == null) return false
  const age = now - validatedAt
  return age >= 0 && age <= OFFLINE_ACCESS_MAX_DAYS * DAY_MS
}
