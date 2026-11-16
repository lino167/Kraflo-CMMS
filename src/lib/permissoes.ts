/**
 * Papéis e permissões do Kraflo.
 *
 * Três papéis, em ordem crescente de acesso:
 *   - tecnico:       executa o trabalho (OS, Modo Campo, consulta técnica). É quem não tem papel de admin.
 *   - admin_empresa: gere a própria empresa (painéis, ativos, equipe, estoque, indexação).
 *   - admin_kraflo:  equipe da Kraflo, em todas as empresas.
 *
 * Esta é a única fonte da verdade da interface: o menu, o bloqueio de rotas e os botões administrativos
 * leem daqui. Mudar quem pode o quê é mudar uma linha deste arquivo.
 *
 * ATENÇÃO: esconder uma tela não protege nada sozinho. Quem decide de verdade é o banco (RLS):
 * ver supabase/migrations/20261116130000_separacao_admin_tecnico.sql e docs/perfis-e-permissoes.md.
 */

export type Papel = 'tecnico' | 'admin_empresa' | 'admin_kraflo'

const NIVEL: Record<Papel, number> = { tecnico: 0, admin_empresa: 1, admin_kraflo: 2 }

/** O papel mais alto entre os papéis da conta; quem não tem papel de admin é técnico. */
export function papelDe(roles: readonly string[]): Papel {
  if (roles.includes('admin_kraflo')) return 'admin_kraflo'
  if (roles.includes('admin_empresa')) return 'admin_empresa'
  return 'tecnico'
}

export const temNivel = (papel: Papel, minimo: Papel): boolean => NIVEL[papel] >= NIVEL[minimo]

/* ------------------------------------------------------------------ *
 * Telas
 * ------------------------------------------------------------------ */

/**
 * Papel mínimo para abrir cada tela (por prefixo do endereço). O que não está aqui é livre para quem
 * estiver logado.
 *
 * Operação (técnico): OS, Modo Campo, Biblioteca (consulta), Estoque (consulta), Assistente IA,
 *   Raio-X, Meu Desempenho e Conta.
 * Administração: Dashboard, Relatórios IA, Gestão de Ativos e Indexação.
 */
const ROTAS_ADMIN: { prefixo: string; minimo: Papel }[] = [
  { prefixo: '/relatorios', minimo: 'admin_empresa' },
  { prefixo: '/configuracoes', minimo: 'admin_empresa' },
  { prefixo: '/admin', minimo: 'admin_empresa' },
]

/** O Dashboard é a raiz: só a rota exatamente "/" é administrativa (as outras começam com "/" também). */
const RAIZ_MINIMO: Papel = 'admin_empresa'

export function minimoDaRota(caminho: string): Papel {
  const limpo = caminho.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
  if (limpo === '/') return RAIZ_MINIMO
  const regra = ROTAS_ADMIN.find((r) => limpo === r.prefixo || limpo.startsWith(r.prefixo + '/'))
  return regra ? regra.minimo : 'tecnico'
}

export const podeAcessarRota = (papel: Papel, caminho: string): boolean => temNivel(papel, minimoDaRota(caminho))

/** Para onde mandar quem abre uma tela que não é do seu papel. */
export const rotaInicial = (papel: Papel): string => (papel === 'tecnico' ? '/campo' : '/')

/* ------------------------------------------------------------------ *
 * Ações dentro das telas compartilhadas
 * ------------------------------------------------------------------ */

const ACOES = {
  /** Excluir OS: definitivo, só administração (o banco também recusa). */
  'os.excluir': 'admin_empresa',
  /** Reabrir uma OS já fechada: correção de registro, só administração. */
  'os.reabrir': 'admin_empresa',
  /** Enviar, editar, reindexar e apagar manuais (o banco também recusa). */
  'manual.gerenciar': 'admin_empresa',
  /** Cadastrar peças e lançar movimentações de estoque. */
  'estoque.gerenciar': 'admin_empresa',
  /** Ver o código de convite e a equipe. */
  'equipe.gerenciar': 'admin_empresa',
  /** Disparar a indexação das OS para a busca por IA. */
  'indexacao.gerenciar': 'admin_empresa',
  /** Escolher outro técnico ao abrir uma OS (o técnico abre sempre em seu nome). */
  'os.atribuir': 'admin_empresa',
} as const satisfies Record<string, Papel>

export type Acao = keyof typeof ACOES

export const pode = (papel: Papel, acao: Acao): boolean => temNivel(papel, ACOES[acao])
