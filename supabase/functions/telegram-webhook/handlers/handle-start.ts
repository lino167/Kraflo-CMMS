/**
 * Handler for /start command
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendMessage } from '../services/telegram-service.ts';
import { mainMenuKeyboard, WEB_APP_URL } from '../infra/config.ts';
import { isRegistered } from '../security/auth-context.ts';
import { logger } from '../infra/logger.ts';

export async function handleStart(
  chatId: number,
  userId: number,
  supabase: SupabaseClient
): Promise<void> {
  logger.command('/start', userId, chatId);

  const tecnico = await isRegistered(userId, supabase);

  if (tecnico) {
    await sendMessage(
      chatId,
      `👋 Olá, ${tecnico.nome_completo}!\n\nVocê já está cadastrado no KRAFLO. Use o menu abaixo para gerenciar suas Ordens de Serviço.`,
      mainMenuKeyboard
    );
  } else {
    await sendMessage(
      chatId,
      `👋 Bem-vindo ao KRAFLO!\n\n` +
      `Plataforma de gestão de manutenção para operações industriais e técnicas.\n\n` +
      `❌ *Você ainda não está cadastrado.*\n\n` +
      `Para usar o bot, você precisa vincular sua conta do Telegram ao nosso sistema.\n\n` +
      `📝 *Siga estes passos:*\n` +
      `1️⃣ Acesse o sistema web:\n${WEB_APP_URL}/auth\n` +
      `2️⃣ Faça login ou crie sua conta.\n` +
      `3️⃣ Edite seu perfil e cole o número abaixo no campo "ID Telegram":\n\n` +
      `🆔 *Seu ID Telegram:* \`${userId}\`\n\n` +
      `_(Toque no número acima para copiar)_`,
      undefined,
      'Markdown',
      true
    );
  }
}
