import { describe, it, expect } from 'vitest'
import { getErrorMessage } from '@/lib/error-handler'

describe('getErrorMessage', () => {
  it('mostra a mensagem de regra de negócio do banco', () => {
    expect(getErrorMessage({ code: '23514', message: 'Estoque insuficiente para "Rolamento": saldo 2, solicitado 5' }))
      .toContain('Estoque insuficiente')
    expect(getErrorMessage({ code: 'P0001', message: 'O saldo só pode ser alterado por movimentação de estoque' }))
      .toContain('movimentação')
  })

  it('traduz violação de RLS e duplicidade', () => {
    expect(getErrorMessage({ code: '42501', message: 'new row violates row-level security policy for table "x"' }))
      .toBe('Você não tem permissão para esta ação.')
    expect(getErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint' }))
      .toBe('Já existe um registro com esses dados.')
  })

  it('mostra erros de validação locais e não vaza erros desconhecidos do banco', () => {
    expect(getErrorMessage(new Error('Informe o nome da peça'))).toBe('Informe o nome da peça')
    expect(getErrorMessage({ code: '42P01', message: 'relation "foo" does not exist' })).not.toContain('relation')
  })
})
