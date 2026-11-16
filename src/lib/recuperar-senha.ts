import { z } from 'zod'

/**
 * Recuperação de senha por e-mail.
 *
 * Fluxo: /auth ("Esqueci minha senha") -> e-mail com link -> /redefinir-senha -> nova senha.
 * O link só vale se o endereço /redefinir-senha estiver na lista de URLs de redirecionamento
 * permitidas do Supabase (Authentication > URL Configuration).
 */

export const ROTA_REDEFINIR_SENHA = '/redefinir-senha'

/** Segundos de espera antes de pedir outro e-mail (o Supabase também limita por conta própria). */
export const ESPERA_REENVIO_SEGUNDOS = 60

export const emailRecuperacaoSchema = z.string().trim().email('Informe um e-mail válido').max(255, 'E-mail muito longo')

export const novaSenhaSchema = z
  .object({
    senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres').max(72, 'Senha muito longa'),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, {
    message: 'As senhas não coincidem',
    path: ['confirmacao'],
  })

export function urlRedefinirSenha(origem: string): string {
  return `${origem.replace(/\/$/, '')}${ROTA_REDEFINIR_SENHA}`
}

/**
 * O endereço traz `type=recovery` (fluxo padrão do Supabase) ou um erro (`error=`, `error_code=`)
 * quando o link expirou. Lido do trecho depois do # e da query.
 */
export function leLinkDeRecuperacao(hash: string, search: string): 'recuperacao' | 'erro' | null {
  const partes = new URLSearchParams(`${hash.replace(/^#/, '')}&${search.replace(/^\?/, '')}`)
  if (partes.get('error') || partes.get('error_code') || partes.get('error_description')) return 'erro'
  if (partes.get('type') === 'recovery') return 'recuperacao'
  return null
}
