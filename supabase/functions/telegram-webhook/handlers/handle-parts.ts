/**
 * Handler for Parts search
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendMessage } from '../services/telegram-service.ts';
import { mainMenuKeyboard, cancelKeyboard } from '../infra/config.ts';
import { setUserState, clearUserState, States } from '../session-state.ts';
import { isRegistered } from '../security/auth-context.ts';
import { searchPartsHistory } from '../services/report-service.ts';
import { logger } from '../infra/logger.ts';

/**
 * Start the Parts search flow
 */
export async function handlePartsStart(
  chatId: number,
  userId: number,
  supabase: SupabaseClient
): Promise<void> {
  logger.command('Consultar Peças', userId, chatId);

  const tecnico = await isRegistered(userId, supabase);
  if (!tecnico) {
    await sendMessage(chatId, '❌ Você precisa estar cadastrado.', mainMenuKeyboard);
    return;
  }

  await setUserState(userId, States.PARTS_SEARCH, { tecnico }, supabase);
  await sendMessage(
    chatId,
    '⚙️ *Consultar Peças*\n\nDigite o nome ou parte do nome da peça que deseja buscar:',
    cancelKeyboard,
    'Markdown'
  );
}

/**
 * Handle parts search flow
 */
export async function handlePartsFlow(
  chatId: number,
  userId: number,
  text: string,
  state: string,
  data: Record<string, any>,
  supabase: SupabaseClient
): Promise<boolean> {
  if (state === States.PARTS_SEARCH) {
    const parts = await searchPartsHistory(supabase, data.tecnico.empresa_id, text);
    await clearUserState(userId, supabase);

    if (parts.length === 0) {
      await sendMessage(chatId, `❌ Nenhuma peça encontrada para "${text}".`, mainMenuKeyboard);
    } else {
      let msg = `⚙️ *Peças encontradas para "${text}"*\n\n`;
      for (const p of parts.slice(0, 15)) {
        const date = p.data_uso ? new Date(p.data_uso).toLocaleDateString('pt-BR') : 'N/A';
        msg += `• *${p.nome_peca}*${p.tag_peca ? ` (${p.tag_peca})` : ''}\n`;
        msg += `  📅 Último uso: ${date} | 🔧 ${p.equipamento_nome}\n\n`;
      }
      await sendMessage(chatId, msg, mainMenuKeyboard, 'Markdown');
    }
    return true;
  }
  return false;
}
