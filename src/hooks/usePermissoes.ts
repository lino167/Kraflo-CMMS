import { useAuth } from '@/hooks/useAuth'
import { papelDe, pode, podeExcluirOS, type Acao } from '@/lib/permissoes'

/** O papel de quem está logado e o que ele pode fazer (regras em lib/permissoes.ts). */
export function usePermissoes() {
  const { roles, user } = useAuth()
  const papel = papelDe(roles)
  return {
    papel,
    ehAdmin: papel !== 'tecnico',
    pode: (acao: Acao) => pode(papel, acao),
    /** Administração: qualquer OS da empresa. Técnico: só as que ele criou. */
    podeExcluirOS: (os: { criado_por?: string | null }) => podeExcluirOS(papel, os, user?.id),
  }
}
