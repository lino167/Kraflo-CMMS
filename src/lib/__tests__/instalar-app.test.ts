import { describe, expect, it } from 'vitest'
import { classificarInstalacao, dispensadoRecentemente, ehIOS } from '@/lib/instalar-app'

describe('ehIOS', () => {
  it('reconhece iPhone e iPad', () => {
    expect(ehIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true)
    expect(ehIOS('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)', 5)).toBe(true)
  })
  it('reconhece iPadOS que se apresenta como Mac (tem toque)', () => {
    expect(ehIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
  })
  it('um Mac de verdade (sem toque) e o Android não são iOS', () => {
    expect(ehIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
    expect(ehIOS('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120', 5)).toBe(false)
  })
})

describe('classificarInstalacao', () => {
  it('já instalado vence tudo', () => {
    expect(classificarInstalacao({ standalone: true, temEvento: true, ios: true })).toBe('instalado')
  })
  it('com o evento do navegador, instala com um toque', () => {
    expect(classificarInstalacao({ standalone: false, temEvento: true, ios: false })).toBe('pelo-navegador')
  })
  it('iPhone sem evento segue os passos manuais', () => {
    expect(classificarInstalacao({ standalone: false, temEvento: false, ios: true })).toBe('ios')
  })
  it('outro navegador sem evento recebe instruções gerais', () => {
    expect(classificarInstalacao({ standalone: false, temEvento: false, ios: false })).toBe('outro')
  })
})

describe('dispensadoRecentemente', () => {
  const dia = 86_400_000
  it('nunca dispensado: mostra', () => {
    expect(dispensadoRecentemente(Date.now(), null)).toBe(false)
  })
  it('dispensado há poucos dias: não insiste', () => {
    const agora = Date.now()
    expect(dispensadoRecentemente(agora, agora - 3 * dia)).toBe(true)
  })
  it('dispensado há mais de 14 dias: volta a mostrar', () => {
    const agora = Date.now()
    expect(dispensadoRecentemente(agora, agora - 15 * dia)).toBe(false)
  })
  it('valor inválido guardado não esconde o aviso', () => {
    expect(dispensadoRecentemente(Date.now(), Number.NaN)).toBe(false)
  })
})
