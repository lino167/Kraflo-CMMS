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
    `📋 Copie este número e cole no campo "ID Telegram" ao fazer seu cadastro no sistema web.`,
    undefined,
    'Markdown'
  );
}
