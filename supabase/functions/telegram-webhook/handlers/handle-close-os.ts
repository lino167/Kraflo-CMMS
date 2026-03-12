/**
 * Handler for Close OS flow
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  sendMessage,
  downloadTelegramFile,
} from '../services/telegram-service.ts'
import { mainMenuKeyboard, cancelKeyboard } from '../infra/config.ts'
import { setUserState, clearUserState, States } from '../session-state.ts'
import { isRegistered } from '../security/auth-context.ts'
import { getOpenOSByTechnician, closeOS } from '../services/os-service.ts'
import { uploadPhoto } from '../services/storage-service.ts'
import { logger } from '../infra/logger.ts'
import { TelegramPhoto, Peca } from '../telegram-types.ts'
import {
  buildRootCauseKeyboard,
  getRootCauseLabel,
} from '../infra/categories.ts'

/**
 * Start the Close OS flow
 */
export async function handleCloseOSStart(
  chatId: number,
  userId: number,
  supabase: SupabaseClient,
): Promise<void> {
  logger.command('Fechar OS', userId, chatId)

  const tecnico = await isRegistered(userId, supabase)
  if (!tecnico) {
    await sendMessage(
      chatId,
      `❌ Você precisa estar cadastrado para usar esta função.`,
      mainMenuKeyboard,
    )
    return
  }

  const openOS = await getOpenOSByTechnician(supabase, userId)

  if (openOS.length === 0) {
    await sendMessage(
      chatId,
      '📭 Você não tem nenhuma OS aberta no momento.',
      mainMenuKeyboard,
    )
    return
  }

  const buttons = openOS.map((os) => [
    {
      text: `#${os.id} - ${os.equipamento_nome} (${os.equipamento_tag || 's/tag'})`,
      callback_data: `close_os_${os.id}`,
    },
  ])
  buttons.push([{ text: '❌ Cancelar', callback_data: 'cancel' }])

  await sendMessage(
    chatId,
    '✅ *Fechar OS*\n\nSelecione a OS que deseja fechar:',
    { inline_keyboard: buttons },
    'Markdown',
  )
}

/**
 * After OS selection, prompt for root cause category
 */
export async function promptRootCauseCategory(
  chatId: number,
  userId: number,
  os: any,
  supabase: SupabaseClient,
): Promise<void> {
  await setUserState(
    userId,
    States.CLOSE_ROOT_CAUSE,
    { os, parts: [] },
    supabase,
  )
  await sendMessage(
    chatId,
    `✅ *Fechando OS #${os.id}*\n\n🔧 ${os.equipamento_nome}\n📝 ${os.descricao_problema || 'Sem descrição'}\n\n🔍 Selecione a *causa raiz* do problema:`,
    buildRootCauseKeyboard(),
    'Markdown',
  )
}

/**
 * Handle Close OS flow steps based on current state
 */
export async function handleCloseOSFlow(
  chatId: number,
  userId: number,
  text: string,
  photo: TelegramPhoto[] | undefined,
  state: string,
  data: Record<string, any>,
  supabase: SupabaseClient,
): Promise<boolean> {
  switch (state) {
    case States.CLOSE_SOLUTION:
      data.diagnostico_solucao = text
      await setUserState(userId, States.CLOSE_PARTS, data, supabase)
      await sendMessage(chatId, '🔩 Foram utilizadas peças na manutenção?', {
        inline_keyboard: [
          [{ text: '✅ Sim', callback_data: 'parts_yes' }],
          [{ text: '❌ Não', callback_data: 'parts_no' }],
        ],
      })
      return true

    case States.CLOSE_PART_NAME:
      data.currentPart = { nome_peca: text }
      await setUserState(userId, States.CLOSE_PART_TAG, data, supabase)
      await sendMessage(
        chatId,
        "🏷️ Digite a TAG da peça (ou 'pular'):",
        cancelKeyboard,
      )
      return true

    case States.CLOSE_PART_TAG:
      data.currentPart.tag_peca = text.toLowerCase() === 'pular' ? null : text
      await setUserState(userId, States.CLOSE_PART_QTY, data, supabase)
      await sendMessage(
        chatId,
        '🔢 Digite a quantidade utilizada:',
        cancelKeyboard,
      )
      return true

    case States.CLOSE_PART_QTY: {
      const qty = parseInt(text)
      if (isNaN(qty) || qty <= 0) {
        await sendMessage(chatId, '❌ Digite um número válido:')
        return true
      }
      data.currentPart.quantidade = qty
      if (!data.parts) data.parts = []
      data.parts.push(data.currentPart)
      data.currentPart = null
      await setUserState(userId, States.CLOSE_MORE_PARTS, data, supabase)
      await sendMessage(chatId, '➕ Deseja adicionar mais peças?', {
        inline_keyboard: [
          [{ text: '✅ Sim', callback_data: 'parts_yes' }],
          [{ text: '❌ Não, continuar', callback_data: 'parts_no' }],
        ],
      })
      return true
    }

    case States.CLOSE_NOTES:
      data.notas_finais = text
      await setUserState(userId, States.CLOSE_ASK_PHOTO, data, supabase)
      await sendMessage(
        chatId,
        '📷 Deseja anexar uma foto do serviço finalizado?',
        {
          inline_keyboard: [
            [{ text: '✅ Sim', callback_data: 'close_photo_yes' }],
            [{ text: '❌ Não', callback_data: 'close_photo_no' }],
          ],
        },
      )
      return true

    case States.CLOSE_PHOTO:
      return await handleClosePhotoStep(
        chatId,
        userId,
        text,
        photo,
        data,
        supabase,
      )

    default:
      return false
  }
}

/**
 * Handle the photo step for OS closing
 */
async function handleClosePhotoStep(
  chatId: number,
  userId: number,
  text: string,
  photo: TelegramPhoto[] | undefined,
  data: Record<string, any>,
  supabase: SupabaseClient,
): Promise<boolean> {
  if (photo && photo.length > 0) {
    const largestPhoto = photo[photo.length - 1]
    const fileData = await downloadTelegramFile(largestPhoto.file_id)

    if (fileData) {
      const tecnico = await isRegistered(userId, supabase)
      if (tecnico) {
        const photoUrl = await uploadPhoto(
          supabase,
          fileData.buffer,
          tecnico.empresa_id,
          data.os.id,
          'fechamento',
        )
        data.closePhotoUrl = photoUrl
      }
    }

    await finalizeCloseOS(chatId, userId, data, supabase)
  } else if (text.toLowerCase() === 'pular') {
    await finalizeCloseOS(chatId, userId, data, supabase)
  } else {
    await sendMessage(
      chatId,
      "❌ Envie uma foto ou digite 'pular':",
      cancelKeyboard,
    )
  }
  return true
}

/**
 * Finalize the OS closing process
 */
export async function finalizeCloseOS(
  chatId: number,
  userId: number,
  data: Record<string, any>,
  supabase: SupabaseClient,
): Promise<void> {
  const {
    os,
    parts,
    diagnostico_solucao,
    status_os,
    notas_finais,
    closePhotoUrl,
    causa_raiz,
    categoria_problema_id,
    subcategoria_problema_id,
  } = data

  const success = await closeOS(supabase, {
    osId: os.id,
    diagnosticoSolucao: diagnostico_solucao,
    statusOs: status_os,
    notasFinais: notas_finais,
    urlArquivoFechamento: closePhotoUrl,
    parts: parts as Peca[],
    categoriaProblemaId: categoria_problema_id,
    subcategoriaProblemaId: subcategoria_problema_id,
  })

  await clearUserState(userId, supabase)

  if (!success) {
    await sendMessage(chatId, '❌ Erro ao fechar OS.', mainMenuKeyboard)
  } else {
    let msg = `✅ *OS #${os.id} fechada com sucesso!*\n\n`
    msg += `📊 Status: ${status_os}\n`
    if (causa_raiz) {
      msg += `🔍 Causa Raiz: ${getRootCauseLabel(causa_raiz)}\n`
    }
    msg += `💡 Solução: ${diagnostico_solucao}\n`
    if (closePhotoUrl) {
      msg += `📷 Foto de fechamento: ✅\n`
    }
    if (parts && parts.length > 0) {
      msg += `\n🔩 *Peças utilizadas:*\n`
      for (const p of parts) {
        msg += `• ${p.nome_peca} (${p.quantidade}x)\n`
      }
    }
    await sendMessage(chatId, msg, mainMenuKeyboard, 'Markdown')
  }
}
