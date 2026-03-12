/**
 * Handler for Open OS flow
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendMessage, downloadTelegramFile } from '../services/telegram-service.ts';
import { mainMenuKeyboard, cancelKeyboard, WEB_APP_URL } from '../infra/config.ts';
import { setUserState, clearUserState, States } from '../session-state.ts';
import { isRegistered } from '../security/auth-context.ts';
import { createOS } from '../services/os-service.ts';
import { uploadPhoto } from '../services/storage-service.ts';
import { logger } from '../infra/logger.ts';
import { TelegramPhoto } from '../telegram-types.ts';
import { buildStopCategoryKeyboard, getStopCategoryLabel } from '../infra/categories.ts';

/**
 * Start the Open OS flow - now starts with stop category selection
 */
export async function handleOpenOSStart(
  chatId: number,
  userId: number,
  supabase: SupabaseClient
): Promise<void> {
  logger.command('Abrir OS', userId, chatId);

  const tecnico = await isRegistered(userId, supabase);
  if (!tecnico) {
    await sendMessage(
      chatId,
      `❌ Você precisa estar cadastrado para usar esta função.\n\n` +
      `📝 Cadastre-se pelo sistema web:\n${WEB_APP_URL}/auth\n\n` +
      `🆔 Seu ID Telegram: \`${userId}\``,
      undefined,
      'Markdown'
    );
    return;
  }

  // Start with stop category selection for faster workflow
  await setUserState(userId, States.OS_STOP_CATEGORY, { tecnico }, supabase);
  await sendMessage(
    chatId,
    '🆕 *Nova Ordem de Serviço*\n\n🛑 Selecione a *categoria da parada*:',
    buildStopCategoryKeyboard(),
    'Markdown'
  );
}

/**
 * Handle OS flow steps based on current state
 */
export async function handleOpenOSFlow(
  chatId: number,
  userId: number,
  text: string,
  photo: TelegramPhoto[] | undefined,
  state: string,
  data: Record<string, any>,
  supabase: SupabaseClient
): Promise<boolean> {
  switch (state) {
    case States.OS_EQUIPMENT:
      data.equipamento_nome = text;
      await setUserState(userId, States.OS_TAG, data, supabase);
      await sendMessage(
        chatId,
        "🏷️ Digite a *TAG* do equipamento (ou 'pular'):",
        cancelKeyboard,
        'Markdown'
      );
      return true;

    case States.OS_TAG:
      data.equipamento_tag = text.toLowerCase() === 'pular' ? null : text;
      await setUserState(userId, States.OS_LOCATION, data, supabase);
      await sendMessage(
        chatId,
        '📍 Digite a *localização* do equipamento:',
        cancelKeyboard,
        'Markdown'
      );
      return true;

    case States.OS_LOCATION:
      data.localizacao = text;
      await setUserState(userId, States.OS_MAINT_TYPE, data, supabase);
      await sendMessage(
        chatId,
        '🔧 Selecione o *tipo de manutenção*:',
        {
          inline_keyboard: [
            [{ text: 'Corretiva', callback_data: 'maint_Corretiva' }],
            [{ text: 'Preventiva', callback_data: 'maint_Preventiva' }],
            [{ text: 'Preditiva', callback_data: 'maint_Preditiva' }],
          ],
        },
        'Markdown'
      );
      return true;

    case States.OS_PROBLEM:
      data.descricao_problema = text;
      await setUserState(userId, States.OS_ASK_PHOTO, data, supabase);
      await sendMessage(chatId, '📷 Deseja anexar uma foto do problema?', {
        inline_keyboard: [
          [{ text: '✅ Sim', callback_data: 'os_photo_yes' }],
          [{ text: '❌ Não', callback_data: 'os_photo_no' }],
        ],
      });
      return true;

    case States.OS_PHOTO:
      return await handleOSPhotoStep(chatId, userId, text, photo, data, supabase);

    default:
      return false;
  }
}

/**
 * Handle the photo step for OS creation
 */
async function handleOSPhotoStep(
  chatId: number,
  userId: number,
  text: string,
  photo: TelegramPhoto[] | undefined,
  data: Record<string, any>,
  supabase: SupabaseClient
): Promise<boolean> {
  if (photo && photo.length > 0) {
    // Get the largest photo (last in array)
    const largestPhoto = photo[photo.length - 1];
    const fileData = await downloadTelegramFile(largestPhoto.file_id);

    if (fileData) {
      // Create OS first to get the ID
      const newOS = await createOS(supabase, {
        tecnicoId: userId,
        empresaId: data.tecnico.empresa_id,
        equipamentoNome: data.equipamento_nome,
        equipamentoTag: data.equipamento_tag,
        localizacao: data.localizacao,
        tipoManutencao: data.tipo_manutencao,
        prioridade: data.prioridade,
        descricaoProblema: data.descricao_problema,
        categoriaParadaId: data.categoria_parada_id,
        subcategoriaParadaId: data.subcategoria_parada_id,
      });

      if (!newOS) {
        await sendMessage(chatId, '❌ Erro ao criar OS. Tente novamente.', mainMenuKeyboard);
      } else {
        // Upload photo
        const photoUrl = await uploadPhoto(
          supabase,
          fileData.buffer,
          data.tecnico.empresa_id,
          newOS.id,
          'abertura'
        );

        if (photoUrl) {
          await supabase
            .from('ordens_de_servico')
            .update({ url_foto: photoUrl })
            .eq('id', newOS.id);
        }

        const categoryLabel = data.categoria_parada ? getStopCategoryLabel(data.categoria_parada) : '';
        await sendMessage(
          chatId,
          `✅ *OS #${newOS.id} criada com sucesso!*\n\n` +
            (categoryLabel ? `🛑 Categoria: ${categoryLabel}\n` : '') +
            `🔧 ${data.equipamento_nome} (${data.equipamento_tag || 's/tag'})\n` +
            `📍 ${data.localizacao}\n` +
            `🛠️ ${data.tipo_manutencao} | ⚡ ${data.prioridade}\n` +
            `📝 ${data.descricao_problema}\n` +
            `📷 Foto anexada: ${photoUrl ? '✅' : '❌'}`,
          mainMenuKeyboard,
          'Markdown'
        );
      }
    } else {
      await sendMessage(chatId, '❌ Erro ao processar foto. Criando OS sem foto...', undefined);
      await createOSWithoutPhoto(chatId, userId, data, supabase);
    }
    await clearUserState(userId, supabase);
  } else if (text && text.toLowerCase() === 'pular') {
    await createOSWithoutPhoto(chatId, userId, data, supabase);
  } else {
    await sendMessage(chatId, "❌ Envie uma foto ou digite 'pular':", cancelKeyboard);
  }
  return true;
}

/**
 * Create OS without photo attachment
 */
export async function createOSWithoutPhoto(
  chatId: number,
  userId: number,
  data: Record<string, any>,
  supabase: SupabaseClient
): Promise<void> {
  const newOS = await createOS(supabase, {
    tecnicoId: userId,
    empresaId: data.tecnico.empresa_id,
    equipamentoNome: data.equipamento_nome,
    equipamentoTag: data.equipamento_tag,
    localizacao: data.localizacao,
    tipoManutencao: data.tipo_manutencao,
    prioridade: data.prioridade,
    descricaoProblema: data.descricao_problema,
    categoriaParadaId: data.categoria_parada_id,
    subcategoriaParadaId: data.subcategoria_parada_id,
  });

  await clearUserState(userId, supabase);

  if (!newOS) {
    await sendMessage(chatId, '❌ Erro ao criar OS. Tente novamente.', mainMenuKeyboard);
  } else {
    const categoryLabel = data.categoria_parada ? getStopCategoryLabel(data.categoria_parada) : '';
    await sendMessage(
      chatId,
      `✅ *OS #${newOS.id} criada com sucesso!*\n\n` +
        (categoryLabel ? `🛑 Categoria: ${categoryLabel}\n` : '') +
        `🔧 ${data.equipamento_nome} (${data.equipamento_tag || 's/tag'})\n` +
        `📍 ${data.localizacao}\n` +
        `🛠️ ${data.tipo_manutencao} | ⚡ ${data.prioridade}\n` +
        `📝 ${data.descricao_problema}`,
      mainMenuKeyboard,
      'Markdown'
    );
  }
}
