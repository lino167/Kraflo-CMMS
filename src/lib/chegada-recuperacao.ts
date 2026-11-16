import { leLinkDeRecuperacao } from '@/lib/recuperar-senha'

/**
 * Importado na entrada do app (main.tsx), antes de tudo: o Supabase lê o link na inicialização e apaga o
 * trecho depois do #. Sem guardar aqui, a página /redefinir-senha, que carrega depois, não saberia que o
 * visitante chegou por um link de recuperação.
 */
export const chegadaPorLink: 'recuperacao' | 'erro' | null =
  typeof window === 'undefined' ? null : leLinkDeRecuperacao(window.location.hash, window.location.search)
