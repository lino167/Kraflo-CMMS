/**
 * Handler for Edit OS flow
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendMessage } from '../services/telegram-service.ts';
import { mainMenuKeyboard, cancelKeyboard } from '../infra/config.ts';
import { setUserState, clearUserState, States } from '../session-state.ts';
import { isRegistered } from '../security/auth-context.ts';
import { getOSByTechnician, updateOSField } from '../services/os-service.ts';
import { logger } from '../infra/logger.ts';

/**
 * Start the Edit OS flow
 */
export async function handleEditOSStart(
  chatId: number,
  userId: number,
  supabase: SupabaseClient
): Promise<void> {
  logger.command('Editar OS', userId, chatId);

  const tecnico = await isRegistered(userId, supabase);
  if (!tecnico) {
    await sendMessage(chatId, '❌ Você precisa estar cadastrado.', mainMenuKeyboard);
    return;
  }

  const osList = await getOSByTechnician(supabase, userId);

  if (osList.length === 0) {
    await sendMessage(chatId, '📭 Você não tem nenhuma OS para editar.', mainMenuKeyboard);
    return;
  }

  const buttons = osList.map((os) => [
    {
      text: `#${os.id} - ${os.equipamento_nome} (${os.status_os})`,
      callback_data: `edit_os_${os.id}`,
    },
  ]);
  buttons.push([{ text: '❌ Cancelar', callback_data: 'cancel' }]);

  await sendMessage(
    chatId,
    '✏️ *Editar OS*\n\nSelecione a OS que deseja editar:',
    { inline_keyboard: buttons },
    'Markdown'
  );
}

/**
 * Handle Edit OS flow steps
 */
export async function handleEditOSFlow(
  chatId: number,
  userId: number,
  text: string,
  state: string,
  data: Record<string, any>,
  supabase: SupabaseClient
): Promise<boolean> {
  if (state === States.EDIT_VALUE) {
    const fieldMap: Record<string, string> = {
      equipamento: 'equipamento_nome',
      tag: 'equipamento_tag',
      localizacao: 'localizacao',
      problema: 'descricao_problema',
    };

    const dbField = fieldMap[data.editField];
    const success = await updateOSField(supabase, data.os.id, dbField, text);

    await clearUserState(userId, supabase);

    if (!success) {
      await sendMessage(chatId, '❌ Erro ao atualizar OS.', mainMenuKeyboard);
    } else {
      await sendMessage(chatId, `✅ OS #${data.os.id} atualizada com sucesso!`, mainMenuKeyboard);
    }
    return true;
  }

  return false;
}
