import { useAuth } from '@/hooks/useAuth'
import { papelDe, pode, type Acao } from '@/lib/permissoes'

/** O papel de quem está logado e o que ele pode fazer (regras em lib/permissoes.ts). */
export function usePermissoes() {
  const { roles } = useAuth()
  const papel = papelDe(roles)
  return {
    papel,
    ehAdmin: papel !== 'tecnico',
    pode: (acao: Acao) => pode(papel, acao),
  }
}
