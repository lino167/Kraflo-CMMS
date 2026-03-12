/**
 * Role-based access control guards for bot commands
 */

import { AuthContext } from './auth-context.ts';
import { sendMessage } from '../services/telegram-service.ts';
import { mainMenuKeyboard, WEB_APP_URL } from '../infra/config.ts';

/**
 * Ensure user is registered as a technician
 */
export async function ensureRegistered(
  chatId: number,
  userId: number,
  auth: AuthContext
): Promise<boolean> {
  if (!auth.isRegistered || !auth.tecnico) {
    await sendMessage(
      chatId,
      `❌ Você precisa estar cadastrado para usar esta função.\n\n` +
      `📝 Cadastre-se pelo sistema web:\n${WEB_APP_URL}/auth\n\n` +
      `🆔 Seu ID Telegram: \`${userId}\``,
      undefined,
      'Markdown',
      true
    );
    return false;
  }
  return true;
}

/**
 * Ensure user has admin_empresa or admin_kraflo role
 */
export async function ensureAdmin(
  chatId: number,
  auth: AuthContext
): Promise<boolean> {
  if (auth.role !== 'admin_empresa' && auth.role !== 'admin_kraflo') {
    await sendMessage(
      chatId,
      '❌ Acesso negado. Apenas administradores podem executar esta ação.',
      mainMenuKeyboard
    );
    return false;
  }
  return true;
}

/**
 * Ensure user is admin_kraflo (super admin)
 */
export async function ensureAdminKraflo(
  chatId: number,
  auth: AuthContext
): Promise<boolean> {
  if (auth.role !== 'admin_kraflo') {
    await sendMessage(
      chatId,
      '❌ Acesso negado. Apenas administradores Kraflo podem executar esta ação.',
      mainMenuKeyboard
    );
    return false;
  }
  return true;
}

/**
 * Check if user can access OS from a specific company
 */
export function canAccessCompanyData(
  auth: AuthContext,
  targetEmpresaId: string
): boolean {
  // Admin Kraflo can access all companies
  if (auth.role === 'admin_kraflo') return true;
  
  // Other users can only access their own company
  return auth.empresaId === targetEmpresaId;
}
