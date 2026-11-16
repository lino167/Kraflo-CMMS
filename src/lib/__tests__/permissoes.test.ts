import { describe, expect, it } from 'vitest'
import { minimoDaRota, papelDe, pode, podeAcessarRota, podeExcluirOS, rotaInicial, temNivel } from '@/lib/permissoes'

describe('papelDe', () => {
  it('sem papel de admin é técnico', () => {
    expect(papelDe([])).toBe('tecnico')
    expect(papelDe(['qualquer_coisa'])).toBe('tecnico')
  })
  it('usa o papel mais alto', () => {
    expect(papelDe(['admin_empresa'])).toBe('admin_empresa')
    expect(papelDe(['admin_empresa', 'admin_kraflo'])).toBe('admin_kraflo')
  })
})

describe('temNivel', () => {
  it('admin_kraflo > admin_empresa > tecnico', () => {
    expect(temNivel('admin_kraflo', 'admin_empresa')).toBe(true)
    expect(temNivel('admin_empresa', 'admin_kraflo')).toBe(false)
    expect(temNivel('tecnico', 'admin_empresa')).toBe(false)
    expect(temNivel('tecnico', 'tecnico')).toBe(true)
  })
})

describe('telas por papel', () => {
  const adminOnly = ['/', '/relatorios', '/configuracoes', '/admin/indexacao']
  const tecnico = [
    '/campo',
    '/ordens-servico',
    '/biblioteca',
    '/estoque',
    '/assistente',
    '/equipamento',
    '/equipamento/TP-001',
    '/meu-desempenho',
    '/conta',
  ]

  it('técnico só abre as telas de operação', () => {
    for (const r of tecnico) expect(podeAcessarRota('tecnico', r), r).toBe(true)
    for (const r of adminOnly) expect(podeAcessarRota('tecnico', r), r).toBe(false)
  })

  it('admin da empresa abre tudo que é da empresa', () => {
    for (const r of [...tecnico, ...adminOnly]) expect(podeAcessarRota('admin_empresa', r), r).toBe(true)
  })

  it('admin Kraflo abre tudo', () => {
    for (const r of [...tecnico, ...adminOnly]) expect(podeAcessarRota('admin_kraflo', r), r).toBe(true)
  })

  it('a raiz é administrativa, mas "/campo" não herda a regra da raiz', () => {
    expect(minimoDaRota('/')).toBe('admin_empresa')
    expect(minimoDaRota('/campo')).toBe('tecnico')
  })

  it('ignora barra final, query e hash', () => {
    expect(minimoDaRota('/configuracoes/')).toBe('admin_empresa')
    expect(minimoDaRota('/relatorios?x=1')).toBe('admin_empresa')
    expect(minimoDaRota('/admin/indexacao#topo')).toBe('admin_empresa')
  })

  it('um prefixo parecido não vira rota administrativa', () => {
    expect(minimoDaRota('/administracao-de-algo')).toBe('tecnico')
    expect(minimoDaRota('/relatorios-do-tecnico')).toBe('tecnico')
  })

  it('rota desconhecida (404) não é bloqueada por papel', () => {
    expect(podeAcessarRota('tecnico', '/nao-existe')).toBe(true)
  })
})

describe('rotaInicial', () => {
  it('técnico começa no Modo Campo, admin no Dashboard', () => {
    expect(rotaInicial('tecnico')).toBe('/campo')
    expect(rotaInicial('admin_empresa')).toBe('/')
    expect(rotaInicial('admin_kraflo')).toBe('/')
  })
})

describe('ações', () => {
  it('técnico não exclui OS, não gerencia manuais nem estoque, e não atribui OS a outro', () => {
    for (const a of ['os.excluir', 'os.reabrir', 'manual.gerenciar', 'estoque.gerenciar', 'equipe.gerenciar', 'indexacao.gerenciar', 'os.atribuir'] as const) {
      expect(pode('tecnico', a), a).toBe(false)
      expect(pode('admin_empresa', a), a).toBe(true)
      expect(pode('admin_kraflo', a), a).toBe(true)
    }
  })
})

describe('podeExcluirOS', () => {
  const eu = 'user-1'
  it('a administração exclui qualquer OS, com ou sem criador', () => {
    expect(podeExcluirOS('admin_empresa', { criado_por: 'outro' }, eu)).toBe(true)
    expect(podeExcluirOS('admin_empresa', { criado_por: null }, eu)).toBe(true)
    expect(podeExcluirOS('admin_kraflo', {}, eu)).toBe(true)
  })
  it('o técnico exclui a OS que ele criou', () => {
    expect(podeExcluirOS('tecnico', { criado_por: eu }, eu)).toBe(true)
  })
  it('o técnico não exclui OS de outra pessoa', () => {
    expect(podeExcluirOS('tecnico', { criado_por: 'outro' }, eu)).toBe(false)
  })
  it('OS sem criador (bot ou anterior ao campo) só a administração exclui', () => {
    expect(podeExcluirOS('tecnico', { criado_por: null }, eu)).toBe(false)
    expect(podeExcluirOS('tecnico', {}, eu)).toBe(false)
  })
  it('sem usuário identificado, o técnico não exclui', () => {
    expect(podeExcluirOS('tecnico', { criado_por: eu }, null)).toBe(false)
    expect(podeExcluirOS('tecnico', { criado_por: eu }, undefined)).toBe(false)
  })
})
