/**
 * Handler for IA Assistant
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendMessage, sendChatAction } from '../services/telegram-service.ts';
import { mainMenuKeyboard, cancelKeyboard } from '../infra/config.ts';
import { setUserState, clearUserState, States } from '../session-state.ts';
import { isRegistered } from '../security/auth-context.ts';
import { queryAssistant } from '../services/ia-service.ts';
import { logger } from '../infra/logger.ts';

/**
 * Start the IA conversation flow
 */
export async function handleIAStart(
  chatId: number,
  userId: number,
  supabase: SupabaseClient
): Promise<void> {
  logger.command('Assistente IA', userId, chatId);

  await setUserState(userId, States.IA_QUESTION, {}, supabase);
  await sendMessage(
    chatId,
    '🤖 *Assistente IA de Manutenção*\n\nDigite sua dúvida técnica sobre manutenção de equipamentos.\n\nExemplos:\n• Como resolver parada de tramas no tear Picanol?\n• Qual o procedimento para ajustar o tempereiro?\n• Histórico de problemas com bloqueio de jacquard',
    cancelKeyboard,
    'Markdown'
  );
}

/**
 * Handle IA command with optional direct question
 */
export async function handleIA(
  chatId: number,
  userId: number,
  question: string,
  supabase: SupabaseClient
): Promise<void> {
  if (!question) {
    await handleIAStart(chatId, userId, supabase);
    return;
  }

  const tecnico = await isRegistered(userId, supabase);
  if (!tecnico) {
    await sendMessage(chatId, '❌ Você precisa estar cadastrado para usar o assistente. Use /start');
    return;
  }

  await sendChatAction(chatId, 'typing');

  const result = await queryAssistant(question, userId, tecnico.empresa_id);

  if (result.error) {
    await sendMessage(chatId, `❌ Erro: ${result.error}`, mainMenuKeyboard);
  } else {
    let msg = `🤖 *Assistente IA*\n\n${result.resposta}`;
    if (result.fontes) {
      msg += `\n\n📚 Consultados: ${result.fontes.manuais_consultados} manuais, ${result.fontes.os_similares} OS`;
    }
    logger.info('Sending IA response to user', { userId, msgLength: msg.length });
    await sendMessage(chatId, msg, mainMenuKeyboard, 'Markdown');
  }
}

/**
 * Handle IA question from conversation flow
 */
export async function handleIAFlow(
  chatId: number,
  userId: number,
  text: string,
  state: string,
  supabase: SupabaseClient
): Promise<boolean> {
  if (state === States.IA_QUESTION) {
    logger.info('Processing IA question from flow', { userId, questionPreview: text.substring(0, 50) });
    await clearUserState(userId, supabase);
    await handleIA(chatId, userId, text, supabase);
    return true;
  }
  return false;
}
