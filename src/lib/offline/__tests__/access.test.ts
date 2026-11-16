import { describe, it, expect } from 'vitest'
import { isOfflineAccessValid, OFFLINE_ACCESS_MAX_DAYS } from '@/lib/offline/access'

const DAY = 24 * 60 * 60 * 1000
const now = Date.parse('2026-11-11T12:00:00Z')

describe('isOfflineAccessValid', () => {
  it('nunca validado não tem acesso offline', () => {
    expect(isOfflineAccessValid(null, now)).toBe(false)
  })

  it(`vale até ${OFFLINE_ACCESS_MAX_DAYS} dias depois da última validação`, () => {
    expect(isOfflineAccessValid(now - 1 * DAY, now)).toBe(true)
    expect(isOfflineAccessValid(now - OFFLINE_ACCESS_MAX_DAYS * DAY, now)).toBe(true)
    expect(isOfflineAccessValid(now - (OFFLINE_ACCESS_MAX_DAYS * DAY + 1), now)).toBe(false)
  })

  it('data no futuro (relógio adiantado ou adulterado) não vale', () => {
    expect(isOfflineAccessValid(now + DAY, now)).toBe(false)
  })
})
