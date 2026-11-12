/**
 * Handler for /meuid command
 */

import { sendMessage } from '../services/telegram-service.ts';
import { logger } from '../infra/logger.ts';

export async function handleMeuId(chatId: number, userId: number): Promise<void> {
  logger.command('/meuid', userId, chatId);

  await sendMessage(
    chatId,
    `🆔 *Seu ID Telegram*\n\n` +
    `\`${userId}\`\n\n` +
    `ℹ️ Este número não é mais usado no cadastro. Para usar o bot, gere um código no app (Conta e Equipe → Vincular Telegram) e envie /vincular CODIGO.`,
    undefined,
    'Markdown'
  );
}
