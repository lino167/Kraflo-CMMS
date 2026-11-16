import { describe, expect, it } from 'vitest'
import {
  emailRecuperacaoSchema,
  leLinkDeRecuperacao,
  novaSenhaSchema,
  urlRedefinirSenha,
} from '@/lib/recuperar-senha'

describe('urlRedefinirSenha', () => {
  it('monta a URL de retorno a partir da origem', () => {
    expect(urlRedefinirSenha('https://kraflo.vercel.app')).toBe('https://kraflo.vercel.app/redefinir-senha')
    expect(urlRedefinirSenha('http://localhost:8080/')).toBe('http://localhost:8080/redefinir-senha')
  })
})

describe('leLinkDeRecuperacao', () => {
  it('reconhece o link de recuperação do Supabase', () => {
    expect(leLinkDeRecuperacao('#access_token=abc&refresh_token=x&type=recovery', '')).toBe('recuperacao')
  })
  it('reconhece link expirado', () => {
    expect(leLinkDeRecuperacao('#error=access_denied&error_code=otp_expired&error_description=expirou', '')).toBe('erro')
  })
  it('não trata uma visita comum como recuperação', () => {
    expect(leLinkDeRecuperacao('', '')).toBeNull()
    expect(leLinkDeRecuperacao('#type=signup', '')).toBeNull()
  })
  it('lê também a query (?type=recovery)', () => {
    expect(leLinkDeRecuperacao('', '?type=recovery')).toBe('recuperacao')
  })
})

describe('novaSenhaSchema', () => {
  it('aceita senhas iguais com tamanho válido', () => {
    expect(novaSenhaSchema.safeParse({ senha: 'abc123', confirmacao: 'abc123' }).success).toBe(true)
  })
  it('recusa senha curta', () => {
    expect(novaSenhaSchema.safeParse({ senha: 'abc', confirmacao: 'abc' }).success).toBe(false)
  })
  it('recusa senhas diferentes', () => {
    const r = novaSenhaSchema.safeParse({ senha: 'abc123', confirmacao: 'abc124' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toEqual(['confirmacao'])
  })
  it('recusa senha acima de 72 caracteres (limite do bcrypt)', () => {
    const longa = 'a'.repeat(73)
    expect(novaSenhaSchema.safeParse({ senha: longa, confirmacao: longa }).success).toBe(false)
  })
})

describe('emailRecuperacaoSchema', () => {
  it('apara espaços e valida', () => {
    expect(emailRecuperacaoSchema.parse('  a@b.com ')).toBe('a@b.com')
    expect(emailRecuperacaoSchema.safeParse('sem-arroba').success).toBe(false)
  })
})
