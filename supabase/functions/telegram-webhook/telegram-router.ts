/**
 * Telegram Router - Routes updates to appropriate handlers
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TelegramMessage, TelegramCallbackQuery, UserState } from './telegram-types.ts';
import { getUserState, setUserState, clearUserState, States } from './session-state.ts';
import { sendMessage, answerCallback } from './services/telegram-service.ts';
import { mainMenuKeyboard, cancelKeyboard } from './infra/config.ts';
import { getOSById, deleteOS, updateOSField } from './services/os-service.ts';
import { logger } from './infra/logger.ts';
import { getStopCategoryLabel, getRootCauseLabel } from './infra/categories.ts';
import { getSubcategorias, getSubcategoriaNome } from './services/categoria-service.ts';
import { resolveStopCategoryId, resolveRootCauseId } from './services/category-id-resolver.ts';
import { isRegistered } from './security/auth-context.ts';

async function resolveEmpresaIdForCallback(
  userId: number,
  userState: UserState | null,
  supabase: SupabaseClient
): Promise<string | null> {
  const empresaIdFromState =
    (userState?.data?.os?.empresa_id as string | undefined) ||
    (userState?.data?.tecnico?.empresa_id as string | undefined);

  if (empresaIdFromState) return empresaIdFromState;

  const tecnico = await isRegistered(userId, supabase);
  return tecnico?.empresa_id || null;
}

// Import handlers
import { handleStart } from './handlers/handle-start.ts';
import { handleMeuId } from './handlers/handle-meuid.ts';
import { handleAbout } from './handlers/handle-about.ts';
import { handleOpenOSStart, handleOpenOSFlow, createOSWithoutPhoto } from './handlers/handle-open-os.ts';
import { handleCloseOSStart, handleCloseOSFlow, finalizeCloseOS, promptRootCauseCategory } from './handlers/handle-close-os.ts';
import { handleListOpenOS, handleListClosedOS } from './handlers/handle-list-os.ts';
import { handleEditOSStart, handleEditOSFlow } from './handlers/handle-edit-os.ts';
import { handleDeleteOSStart } from './handlers/handle-delete-os.ts';
import { handleIAStart, handleIA, handleIAFlow } from './handlers/handle-ia.ts';
import { handleReportsStart, generateGeneralReport, generateMyOSReport, generateEquipmentReport, generate30DaysReport, generateDetailedPdfReport, handleReportFlow } from './handlers/handle-reports.ts';
import { handlePartsStart, handlePartsFlow } from './handlers/handle-parts.ts';

/**
 * Route incoming message to appropriate handler
 */
export async function routeMessage(
  message: TelegramMessage,
  supabase: SupabaseClient
): Promise<void> {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text || '';
  const photo = message.photo;

  const userState = await getUserState(userId, supabase);

  // Handle cancel
  if (text === '❌ Cancelar') {
    await clearUserState(userId, supabase);
    await sendMessage(chatId, '❌ Operação cancelada.', mainMenuKeyboard);
    return;
  }

  // Route commands
  if (text === '/start') {
    await handleStart(chatId, userId, supabase);
  } else if (text === '/meuid') {
    await handleMeuId(chatId, userId);
  } else if (text === '/ia' || text.startsWith('/ia ')) {
    await handleIA(chatId, userId, text.replace('/ia', '').trim(), supabase);
  } else if (text === '🆕 Abrir OS') {
    await handleOpenOSStart(chatId, userId, supabase);
  } else if (text === '✅ Fechar OS') {
    await handleCloseOSStart(chatId, userId, supabase);
  } else if (text === '📋 Listar Abertas') {
    await handleListOpenOS(chatId, userId, supabase);
  } else if (text === '🗂️ Listar Fechadas') {
    await handleListClosedOS(chatId, userId, supabase);
  } else if (text === '⚙️ Consultar Peças') {
    await handlePartsStart(chatId, userId, supabase);
  } else if (text === '✏️ Editar OS') {
    await handleEditOSStart(chatId, userId, supabase);
  } else if (text === '🗑️ Deletar OS') {
    await handleDeleteOSStart(chatId, userId, supabase);
  } else if (text === '📊 Relatórios') {
    await handleReportsStart(chatId, userId, supabase);
  } else if (text === '🤖 Assistente IA') {
    await handleIAStart(chatId, userId, supabase);
  } else if (text === 'ℹ️ Sobre') {
    await handleAbout(chatId);
  } else if (userState) {
    await handleConversationFlow(chatId, userId, text, photo, userState, supabase);
  }
}

/**
 * Handle conversation flow based on current state
 */
async function handleConversationFlow(
  chatId: number,
  userId: number,
  text: string,
  photo: any,
  userState: UserState,
  supabase: SupabaseClient
): Promise<void> {
  const { state, data } = userState;

  // Try each flow handler
  if (await handleOpenOSFlow(chatId, userId, text, photo, state, data, supabase)) return;
  if (await handleCloseOSFlow(chatId, userId, text, photo, state, data, supabase)) return;
  if (await handleEditOSFlow(chatId, userId, text, state, data, supabase)) return;
  if (await handleIAFlow(chatId, userId, text, state, supabase)) return;
  if (await handleReportFlow(chatId, userId, text, state, supabase)) return;
  if (await handlePartsFlow(chatId, userId, text, state, data, supabase)) return;
}

/**
 * Route callback query to appropriate handler
 */
export async function routeCallback(
  query: TelegramCallbackQuery,
  supabase: SupabaseClient
): Promise<void> {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const callbackData = query.data;
  const userState = await getUserState(userId, supabase);

  // Handle calendar callbacks first
  if (await handleCalendarCallback(chatId, userId, callbackData, userState, supabase)) {
    await answerCallback(query.id);
    return;
  }

  await answerCallback(query.id);

  if (callbackData === 'cancel') {
    await clearUserState(userId, supabase);
    await sendMessage(chatId, '❌ Operação cancelada.', mainMenuKeyboard);
    return;
  }

  if (callbackData === 'noop') return;

  // Stop category selection (OS opening)
  if (callbackData.startsWith('stop_cat_') && userState) {
    const hardcodedId = callbackData.replace('stop_cat_', '');
    userState.data.categoria_parada = hardcodedId;

    // 🆕 Converter ID hardcoded para UUID do banco
    const empresaId = userState.data.tecnico?.empresa_id;
    const realId = empresaId
      ? await resolveStopCategoryId(supabase, empresaId, hardcodedId)
      : null;

    // Salvar o UUID real da categoria no state para persistir no banco
    if (realId) {
      userState.data.categoria_parada_id = realId;
    }

    if (!realId) {
      console.error('Categoria não encontrada no banco:', hardcodedId);
      await setUserState(userId, States.OS_EQUIPMENT, userState.data, supabase);
      await sendMessage(
        chatId,
        `✅ Categoria: *${getStopCategoryLabel(hardcodedId)}*\n\n🔧 Digite o *nome do equipamento*:`,
        cancelKeyboard,
        'Markdown'
      );
      return;
    }

    // Buscar subcategorias do banco usando UUID real
    const subcategorias = await getSubcategorias(supabase, realId, 'parada');

    if (subcategorias.length > 0) {
      // Tem subcategorias - exibir para seleção
      await setUserState(userId, States.OS_STOP_SUBCATEGORY, userState.data, supabase);
      await sendMessage(
        chatId,
        `✅ Categoria: *${getStopCategoryLabel(hardcodedId)}*\n\n🔍 Selecione a *subcategoria* (opcional):`,
        {
          inline_keyboard: [
            ...subcategorias.map(sub => [{
              text: sub.nome,
              callback_data: `stop_subcat_${sub.id}`
            }]),
            [{ text: '⏭️ Pular (sem subcategoria)', callback_data: 'stop_subcat_skip' }],
            [{ text: '❌ Cancelar', callback_data: 'cancel' }],
          ]
        },
        'Markdown'
      );
    } else {
      // Não tem subcategorias - ir direto para equipamento
      await setUserState(userId, States.OS_EQUIPMENT, userState.data, supabase);
      await sendMessage(
        chatId,
        `✅ Categoria: *${getStopCategoryLabel(hardcodedId)}*\n\n🔧 Digite o *nome do equipamento*:`,
        cancelKeyboard,
        'Markdown'
      );
    }
    return;
  }

  // 🆕 Stop subcategory selection (OS opening)
  if (callbackData.startsWith('stop_subcat_') && userState) {
    const subcategoriaId = callbackData === 'stop_subcat_skip'
      ? null
      : callbackData.replace('stop_subcat_', '');

    userState.data.subcategoria_parada_id = subcategoriaId;
    await setUserState(userId, States.OS_EQUIPMENT, userState.data, supabase);

    let message = '';
    if (subcategoriaId) {
      const subNome = await getSubcategoriaNome(supabase, subcategoriaId);
      message = `✅ Subcategoria: *${subNome}*\n\n`;
    }
    message += '🔧 Digite o *nome do equipamento*:';

    await sendMessage(chatId, message, cancelKeyboard, 'Markdown');
    return;
  }

  // Root cause category selection (OS closing)
  if (callbackData.startsWith('cause_cat_') && userState) {
    const hardcodedId = callbackData.replace('cause_cat_', '');
    userState.data.causa_raiz = hardcodedId;

    const empresaId = await resolveEmpresaIdForCallback(userId, userState, supabase);
    if (!empresaId) {
      logger.error('Empresa não encontrada para callback de fechamento', undefined, {
        userId,
        callbackData,
      });
      await clearUserState(userId, supabase);
      await sendMessage(
        chatId,
        '❌ Não consegui identificar sua empresa para continuar o fechamento. Envie /start e tente novamente.',
        mainMenuKeyboard
      );
      return;
    }

    // 🆕 Converter ID hardcoded para UUID do banco
    const realId = await resolveRootCauseId(supabase, empresaId, hardcodedId);

    // Salvar o UUID real da categoria no state para persistir no banco
    if (realId) {
      userState.data.categoria_problema_id = realId;
    }

    if (!realId) {
      console.error('Categoria não encontrada no banco:', hardcodedId);
      await setUserState(userId, States.CLOSE_SOLUTION, userState.data, supabase);
      await sendMessage(
        chatId,
        `✅ Causa raiz: *${getRootCauseLabel(hardcodedId)}*\n\n💡 Descreva o *diagnóstico e solução* aplicada:`,
        cancelKeyboard,
        'Markdown'
      );
      return;
    }

    // Buscar subcategorias do banco usando UUID real
    const subcategorias = await getSubcategorias(supabase, realId, 'problema');

    if (subcategorias.length > 0) {
      // Tem subcategorias - exibir para seleção
      await setUserState(userId, States.CLOSE_ROOT_SUBCATEGORY, userState.data, supabase);
      await sendMessage(
        chatId,
        `✅ Causa raiz: *${getRootCauseLabel(hardcodedId)}*\n\n🔍 Selecione a *subcategoria* (opcional):`,
        {
          inline_keyboard: [
            ...subcategorias.map(sub => [{
              text: sub.nome,
              callback_data: `cause_subcat_${sub.id}`
            }]),
            [{ text: '⏭️ Pular (sem subcategoria)', callback_data: 'cause_subcat_skip' }],
            [{ text: '❌ Cancelar', callback_data: 'cancel' }],
          ]
        },
        'Markdown'
      );
    } else {
      // Não tem subcategorias - ir direto para solução
      await setUserState(userId, States.CLOSE_SOLUTION, userState.data, supabase);
      await sendMessage(
        chatId,
        `✅ Causa raiz: *${getRootCauseLabel(hardcodedId)}*\n\n💡 Descreva o *diagnóstico e solução* aplicada:`,
        cancelKeyboard,
        'Markdown'
      );
    }
    return;
  }

  // 🆕 Root cause subcategory selection (OS closing)
  if (callbackData.startsWith('cause_subcat_') && userState) {
    const subcategoriaId = callbackData === 'cause_subcat_skip'
      ? null
      : callbackData.replace('cause_subcat_', '');

    userState.data.subcategoria_problema_id = subcategoriaId;
    await setUserState(userId, States.CLOSE_SOLUTION, userState.data, supabase);

    let message = '';
    if (subcategoriaId) {
      const subNome = await getSubcategoriaNome(supabase, subcategoriaId);
      message = `✅ Subcategoria: *${subNome}*\n\n`;
    }
    message += '💡 Descreva o *diagnóstico e solução* aplicada:';

    await sendMessage(chatId, message, cancelKeyboard, 'Markdown');
    return;
  }

  // Maintenance type selection
  if (callbackData.startsWith('maint_') && userState) {
    userState.data.tipo_manutencao = callbackData.replace('maint_', '');
    await setUserState(userId, States.OS_PRIORITY, userState.data, supabase);
    await sendMessage(chatId, '⚡ Selecione a *prioridade*:', {
      inline_keyboard: [
        [{ text: '🟢 Baixa', callback_data: 'priority_Baixa' }],
        [{ text: '🟡 Média', callback_data: 'priority_Média' }],
        [{ text: '🟠 Alta', callback_data: 'priority_Alta' }],
        [{ text: '🔴 Urgente', callback_data: 'priority_Urgente' }],
      ],
    }, 'Markdown');
    return;
  }

  // Priority selection
  if (callbackData.startsWith('priority_') && userState) {
    userState.data.prioridade = callbackData.replace('priority_', '');
    await setUserState(userId, States.OS_PROBLEM, userState.data, supabase);
    await sendMessage(chatId, '📝 Descreva o *problema* encontrado:', cancelKeyboard, 'Markdown');
    return;
  }

  // Close OS selection - now prompts for root cause category first
  if (callbackData.startsWith('close_os_')) {
    const osId = parseInt(callbackData.replace('close_os_', ''));
    const os = await getOSById(supabase, osId);
    if (os) {
      await promptRootCauseCategory(chatId, userId, os, supabase);
    }
    return;
  }

  // Parts callbacks
  if (callbackData === 'parts_yes' && userState) {
    await setUserState(userId, States.CLOSE_PART_NAME, userState.data, supabase);
    await sendMessage(chatId, '🔩 Digite o *nome da peça* utilizada:', cancelKeyboard, 'Markdown');
    return;
  }

  if (callbackData === 'parts_no' && userState) {
    await setUserState(userId, States.CLOSE_STATUS, userState.data, supabase);
    await sendMessage(chatId, '📊 Selecione o *status final*:', {
      inline_keyboard: [
        [{ text: '✅ Liberado para produção', callback_data: 'status_Liberado para produção' }],
        [{ text: '❌ Não liberado', callback_data: 'status_Não liberado' }],
        [{ text: '🏁 Fechada', callback_data: 'status_Fechada' }],
      ],
    }, 'Markdown');
    return;
  }

  // Status selection
  if (callbackData.startsWith('status_') && userState) {
    userState.data.status_os = callbackData.replace('status_', '');
    await setUserState(userId, States.CLOSE_ASK_NOTES, userState.data, supabase);
    await sendMessage(chatId, '📝 Deseja adicionar notas finais?', {
      inline_keyboard: [
        [{ text: '✅ Sim', callback_data: 'notes_yes' }],
        [{ text: '❌ Não', callback_data: 'notes_no' }],
      ],
    });
    return;
  }

  // Notes callbacks
  if (callbackData === 'notes_yes' && userState) {
    await setUserState(userId, States.CLOSE_NOTES, userState.data, supabase);
    await sendMessage(chatId, '📝 Digite as notas finais:', cancelKeyboard);
    return;
  }

  if (callbackData === 'notes_no' && userState) {
    await setUserState(userId, States.CLOSE_ASK_PHOTO, userState.data, supabase);
    await sendMessage(chatId, '📷 Deseja anexar uma foto do serviço finalizado?', {
      inline_keyboard: [
        [{ text: '✅ Sim', callback_data: 'close_photo_yes' }],
        [{ text: '❌ Não', callback_data: 'close_photo_no' }],
      ],
    });
    return;
  }

  // Photo callbacks
  if (callbackData === 'os_photo_yes' && userState) {
    await setUserState(userId, States.OS_PHOTO, userState.data, supabase);
    await sendMessage(chatId, '📷 Envie a foto do problema:', cancelKeyboard);
    return;
  }

  if (callbackData === 'os_photo_no' && userState) {
    await createOSWithoutPhoto(chatId, userId, userState.data, supabase);
    return;
  }

  if (callbackData === 'close_photo_yes' && userState) {
    await setUserState(userId, States.CLOSE_PHOTO, userState.data, supabase);
    await sendMessage(chatId, '📷 Envie a foto do serviço finalizado:', cancelKeyboard);
    return;
  }

  if (callbackData === 'close_photo_no' && userState) {
    await finalizeCloseOS(chatId, userId, userState.data, supabase);
    return;
  }

  // Edit OS
  if (callbackData.startsWith('edit_os_')) {
    const osId = parseInt(callbackData.replace('edit_os_', ''));
    const os = await getOSById(supabase, osId);
    if (os) {
      await setUserState(userId, States.EDIT_SELECT_FIELD, { os }, supabase);
      await sendMessage(chatId, `✏️ *Editando OS #${os.id}*\n\n🔧 Equipamento: ${os.equipamento_nome}\n🏷️ TAG: ${os.equipamento_tag || 'N/A'}\n📍 Local: ${os.localizacao || 'N/A'}\n\nSelecione o campo que deseja editar:`, {
        inline_keyboard: [
          [{ text: '🔧 Equipamento', callback_data: 'editfield_equipamento' }],
          [{ text: '🏷️ TAG', callback_data: 'editfield_tag' }],
          [{ text: '📍 Localização', callback_data: 'editfield_localizacao' }],
          [{ text: '🛠️ Tipo Manutenção', callback_data: 'editfield_tipo' }],
          [{ text: '⚡ Prioridade', callback_data: 'editfield_prioridade' }],
          [{ text: '📝 Problema', callback_data: 'editfield_problema' }],
          [{ text: '❌ Cancelar', callback_data: 'cancel' }],
        ],
      }, 'Markdown');
    }
    return;
  }

  // Edit field selection
  if (callbackData.startsWith('editfield_') && userState) {
    const field = callbackData.replace('editfield_', '');
    userState.data.editField = field;
    if (field === 'tipo') {
      await sendMessage(chatId, '🛠️ Selecione o novo tipo de manutenção:', {
        inline_keyboard: [
          [{ text: 'Corretiva', callback_data: 'editvalue_tipo_Corretiva' }],
          [{ text: 'Preventiva', callback_data: 'editvalue_tipo_Preventiva' }],
          [{ text: 'Preditiva', callback_data: 'editvalue_tipo_Preditiva' }],
        ],
      });
    } else if (field === 'prioridade') {
      await sendMessage(chatId, '⚡ Selecione a nova prioridade:', {
        inline_keyboard: [
          [{ text: '🟢 Baixa', callback_data: 'editvalue_prioridade_Baixa' }],
          [{ text: '🟡 Média', callback_data: 'editvalue_prioridade_Média' }],
          [{ text: '🟠 Alta', callback_data: 'editvalue_prioridade_Alta' }],
          [{ text: '🔴 Urgente', callback_data: 'editvalue_prioridade_Urgente' }],
        ],
      });
    } else {
      await setUserState(userId, States.EDIT_VALUE, userState.data, supabase);
      const fieldNames: Record<string, string> = { equipamento: 'nome do equipamento', tag: 'TAG do equipamento', localizacao: 'localização', problema: 'descrição do problema' };
      await sendMessage(chatId, `📝 Digite o novo valor para *${fieldNames[field]}*:`, cancelKeyboard, 'Markdown');
    }
    return;
  }

  // Edit value from inline buttons
  if (callbackData.startsWith('editvalue_') && userState) {
    const parts = callbackData.replace('editvalue_', '').split('_');
    const field = parts[0];
    const value = parts.slice(1).join('_');
    const fieldMap: Record<string, string> = { tipo: 'tipo_manutencao', prioridade: 'prioridade' };
    const success = await updateOSField(supabase, userState.data.os.id, fieldMap[field], value);
    await clearUserState(userId, supabase);
    if (!success) {
      await sendMessage(chatId, '❌ Erro ao atualizar OS.', mainMenuKeyboard);
    } else {
      await sendMessage(chatId, `✅ OS #${userState.data.os.id} atualizada com sucesso!`, mainMenuKeyboard);
    }
    return;
  }

  // Delete OS
  if (callbackData.startsWith('delete_os_')) {
    const osId = parseInt(callbackData.replace('delete_os_', ''));
    const os = await getOSById(supabase, osId);
    if (os) {
      await setUserState(userId, States.DELETE_CONFIRM, { os }, supabase);
      await sendMessage(chatId, `⚠️ *Confirmar Exclusão*\n\nDeseja realmente deletar a OS #${os.id}?\n\n🔧 ${os.equipamento_nome}\n📝 ${os.descricao_problema || 'Sem descrição'}\n\n*Esta ação não pode ser desfeita!*`, {
        inline_keyboard: [
          [{ text: '✅ Sim, deletar', callback_data: `confirm_delete_${os.id}` }],
          [{ text: '❌ Não, cancelar', callback_data: 'cancel' }],
        ],
      }, 'Markdown');
    }
    return;
  }

  if (callbackData.startsWith('confirm_delete_') && userState) {
    const osId = parseInt(callbackData.replace('confirm_delete_', ''));
    const success = await deleteOS(supabase, osId);
    await clearUserState(userId, supabase);
    if (!success) {
      await sendMessage(chatId, '❌ Erro ao deletar OS.', mainMenuKeyboard);
    } else {
      await sendMessage(chatId, `✅ OS #${osId} deletada com sucesso!`, mainMenuKeyboard);
    }
    return;
  }

  // Reports
  if (callbackData === 'report_general') {
    await generateGeneralReport(chatId, userId, supabase);
    return;
  }
  if (callbackData === 'report_mine') {
    await generateMyOSReport(chatId, userId, supabase);
    return;
  }
  if (callbackData === 'report_equipment') {
    await setUserState(userId, States.REPORT_EQUIPMENT, {}, supabase);
    await sendMessage(chatId, '🔧 Digite o nome do equipamento para o relatório:', cancelKeyboard);
    return;
  }
  if (callbackData === 'report_30days') {
    await generate30DaysReport(chatId, userId, supabase);
    return;
  }
}

// Calendar helper
function buildCalendarKeyboard(year: number, month: number, mode: 'start' | 'end') {
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const monthName = names[month - 1];
  const first = new Date(year, month - 1, 1);
  const startWeekDay = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const rows: any[] = [];
  rows.push([
    { text: '«', callback_data: `cal_nav_${mode}_${prev.y}-${String(prev.m).padStart(2, '0')}` },
    { text: `${monthName} ${year}`, callback_data: 'noop' },
    { text: '»', callback_data: `cal_nav_${mode}_${next.y}-${String(next.m).padStart(2, '0')}` },
  ]);
  rows.push([{ text: 'D', callback_data: 'noop' }, { text: 'S', callback_data: 'noop' }, { text: 'T', callback_data: 'noop' }, { text: 'Q', callback_data: 'noop' }, { text: 'Q', callback_data: 'noop' }, { text: 'S', callback_data: 'noop' }, { text: 'S', callback_data: 'noop' }]);
  let day = 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  for (let r = 0; day <= daysInMonth; r++) {
    const row: any[] = [];
    for (let c = 0; c < 7; c++) {
      const cellIndex = r * 7 + c;
      if (cellIndex < startWeekDay) row.push({ text: ' ', callback_data: 'noop' });
      else if (day <= daysInMonth) { row.push({ text: String(day), callback_data: `cal_${mode}_${year}-${pad(month)}-${pad(day)}` }); day++; }
      else row.push({ text: ' ', callback_data: 'noop' });
    }
    rows.push(row);
  }
  rows.push([{ text: '❌ Cancelar', callback_data: 'cancel' }]);
  return rows;
}

async function handleCalendarCallback(chatId: number, userId: number, callbackData: string, userState: UserState | null, supabase: SupabaseClient): Promise<boolean> {
  if (callbackData === 'report_detailed_cal') {
    const now = new Date();
    await setUserState(userId, States.REPORT_CAL_START, { view_year: now.getFullYear(), view_month: now.getMonth() + 1 }, supabase);
    await sendMessage(chatId, '📅 *Selecione a data inicial*', { inline_keyboard: buildCalendarKeyboard(now.getFullYear(), now.getMonth() + 1, 'start') }, 'Markdown');
    return true;
  }
  if (callbackData.startsWith('cal_nav_start_')) {
    const [y, m] = callbackData.replace('cal_nav_start_', '').split('-').map((v: string) => parseInt(v));
    await setUserState(userId, States.REPORT_CAL_START, { view_year: y, view_month: m }, supabase);
    await sendMessage(chatId, '📅 *Selecione a data inicial*', { inline_keyboard: buildCalendarKeyboard(y, m, 'start') }, 'Markdown');
    return true;
  }
  if (callbackData.startsWith('cal_start_')) {
    const iso = callbackData.replace('cal_start_', '');
    const y = parseInt(iso.slice(0, 4));
    const m = parseInt(iso.slice(5, 7));
    await setUserState(userId, States.REPORT_CAL_END, { report_start: iso, view_year: y, view_month: m }, supabase);
    await sendMessage(chatId, '📅 *Selecione a data final*', { inline_keyboard: buildCalendarKeyboard(y, m, 'end') }, 'Markdown');
    return true;
  }
  if (callbackData.startsWith('cal_nav_end_')) {
    const [y, m] = callbackData.replace('cal_nav_end_', '').split('-').map((v: string) => parseInt(v));
    const startIso = userState?.data?.report_start;
    await setUserState(userId, States.REPORT_CAL_END, { report_start: startIso, view_year: y, view_month: m }, supabase);
    await sendMessage(chatId, '📅 *Selecione a data final*', { inline_keyboard: buildCalendarKeyboard(y, m, 'end') }, 'Markdown');
    return true;
  }
  if (callbackData.startsWith('cal_end_')) {
    const endIso = callbackData.replace('cal_end_', '');
    const startIso = userState?.data?.report_start;
    if (!startIso) { await clearUserState(userId, supabase); await sendMessage(chatId, '❌ Ocorreu um erro. Inicie novamente o relatório.', mainMenuKeyboard); return true; }
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (end.getTime() < start.getTime()) { await sendMessage(chatId, '❌ A data final não pode ser anterior à inicial.'); return true; }
    await sendMessage(chatId, '🧾 Gerando relatório em PDF...', cancelKeyboard);
    await generateDetailedPdfReport(chatId, userId, start, end, supabase);
    await clearUserState(userId, supabase);
    return true;
  }
  return false;
}
