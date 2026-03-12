/**
 * Handler for Delete OS flow
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendMessage } from '../services/telegram-service.ts';
import { mainMenuKeyboard } from '../infra/config.ts';
import { isRegistered } from '../security/auth-context.ts';
import { getOpenOSByTechnician } from '../services/os-service.ts';
import { logger } from '../infra/logger.ts';

/**
 * Start the Delete OS flow
 */
export async function handleDeleteOSStart(
  chatId: number,
  userId: number,
  supabase: SupabaseClient
): Promise<void> {
  logger.command('Deletar OS', userId, chatId);

  const tecnico = await isRegistered(userId, supabase);
  if (!tecnico) {
    await sendMessage(chatId, '❌ Você precisa estar cadastrado.', mainMenuKeyboard);
    return;
  }

  const osList = await getOpenOSByTechnician(supabase, userId);

  if (osList.length === 0) {
    await sendMessage(
      chatId,
      '📭 Você não tem nenhuma OS aberta para deletar.\n\n⚠️ Apenas OS abertas podem ser deletadas.',
      mainMenuKeyboard
    );
    return;
  }

  const buttons = osList.map((os) => [
    {
      text: `#${os.id} - ${os.equipamento_nome}`,
      callback_data: `delete_os_${os.id}`,
    },
  ]);
  buttons.push([{ text: '❌ Cancelar', callback_data: 'cancel' }]);

  await sendMessage(
    chatId,
    '🗑️ *Deletar OS*\n\n⚠️ *Atenção:* Esta ação é irreversível!\n\nSelecione a OS que deseja deletar:',
    { inline_keyboard: buttons },
    'Markdown'
  );
}
