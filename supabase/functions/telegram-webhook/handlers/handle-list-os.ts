/**
 * Handler for List OS commands
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendMessage } from '../services/telegram-service.ts';
import { mainMenuKeyboard } from '../infra/config.ts';
import { isRegistered } from '../security/auth-context.ts';
import { getOpenOSByCompany, getClosedOSByCompany } from '../services/os-service.ts';
import { logger } from '../infra/logger.ts';

/**
 * Handle List Open OS command
 */
export async function handleListOpenOS(
  chatId: number,
  userId: number,
  supabase: SupabaseClient
): Promise<void> {
  logger.command('Listar Abertas', userId, chatId);

  const tecnico = await isRegistered(userId, supabase);
  if (!tecnico) {
    await sendMessage(chatId, '❌ Você precisa estar cadastrado.', mainMenuKeyboard);
    return;
  }

  const openOS = await getOpenOSByCompany(supabase, tecnico.empresa_id);

  if (openOS.length === 0) {
    await sendMessage(chatId, '📭 Não há OS abertas no momento.', mainMenuKeyboard);
    return;
  }

  let msg = '📋 *OS Abertas*\n\n';
  for (const os of openOS) {
    const date = new Date(os.data_abertura).toLocaleDateString('pt-BR');
    msg += `🔹 *#${os.id}* - ${os.equipamento_nome}\n`;
    msg += `   📍 ${os.localizacao || 'N/A'} | 📅 ${date}\n`;
    msg += `   🔧 ${os.tipo_manutencao || 'N/A'} | ⚡ ${os.prioridade || 'N/A'}\n\n`;
  }

  await sendMessage(chatId, msg, mainMenuKeyboard, 'Markdown');
}

/**
 * Handle List Closed OS command
 */
export async function handleListClosedOS(
  chatId: number,
  userId: number,
  supabase: SupabaseClient
): Promise<void> {
  logger.command('Listar Fechadas', userId, chatId);

  const tecnico = await isRegistered(userId, supabase);
  if (!tecnico) {
    await sendMessage(chatId, '❌ Você precisa estar cadastrado.', mainMenuKeyboard);
    return;
  }

  const closedOS = await getClosedOSByCompany(supabase, tecnico.empresa_id);

  if (closedOS.length === 0) {
    await sendMessage(chatId, '📭 Não há OS fechadas recentemente.', mainMenuKeyboard);
    return;
  }

  let msg = '🗂️ *OS Fechadas*\n\n';
  for (const os of closedOS) {
    const date = os.data_fechamento
      ? new Date(os.data_fechamento).toLocaleDateString('pt-BR')
      : 'N/A';
    msg += `✅ *#${os.id}* - ${os.equipamento_nome}\n`;
    msg += `   📍 ${os.localizacao || 'N/A'} | 📅 ${date}\n`;
    msg += `   📊 ${os.status_os}\n\n`;
  }

  await sendMessage(chatId, msg, mainMenuKeyboard, 'Markdown');
}
