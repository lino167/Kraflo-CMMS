/**
 * Handler for Reports
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendMessage, sendDocument } from '../services/telegram-service.ts';
import { mainMenuKeyboard, cancelKeyboard } from '../infra/config.ts';
import { setUserState, clearUserState, States } from '../session-state.ts';
import { isRegistered } from '../security/auth-context.ts';
import {
  getGeneralStats,
  getPersonalStats,
  getOSByEquipment,
  getLast30DaysStats,
  getOSByDateRange,
} from '../services/report-service.ts';
import { uploadPdfReport } from '../services/storage-service.ts';
import { logger } from '../infra/logger.ts';

/**
 * Start the Reports menu
 */
export async function handleReportsStart(
  chatId: number,
  userId: number,
  supabase: SupabaseClient
): Promise<void> {
  logger.command('Relatórios', userId, chatId);

  const tecnico = await isRegistered(userId, supabase);
  if (!tecnico) {
    await sendMessage(chatId, '❌ Você precisa estar cadastrado.', mainMenuKeyboard);
    return;
  }

  await sendMessage(
    chatId,
    '📊 *Relatórios*\n\nSelecione o tipo de relatório:',
    {
      inline_keyboard: [
        [{ text: '📈 Resumo Geral', callback_data: 'report_general' }],
        [{ text: '👤 Minhas OS', callback_data: 'report_mine' }],
        [{ text: '🔧 Por Equipamento', callback_data: 'report_equipment' }],
        [{ text: '📅 Últimos 30 dias', callback_data: 'report_30days' }],
        [{ text: '🧾 Detalhado (PDF por intervalo)', callback_data: 'report_detailed_cal' }],
        [{ text: '❌ Cancelar', callback_data: 'cancel' }],
      ],
    },
    'Markdown'
  );
}

/**
 * Generate general report
 */
export async function generateGeneralReport(
  chatId: number,
  userId: number,
  supabase: SupabaseClient
): Promise<void> {
  const tecnico = await isRegistered(userId, supabase);
  if (!tecnico) return;

  const stats = await getGeneralStats(supabase, tecnico.empresa_id);
  if (!stats) {
    await sendMessage(chatId, '❌ Não foi possível gerar o relatório.', mainMenuKeyboard);
    return;
  }

  let msg = '📊 *Relatório Geral*\n\n';
  msg += `📋 Total de OS: *${stats.total}*\n`;
  msg += `🔓 Abertas: *${stats.abertas}*\n`;
  msg += `✅ Fechadas: *${stats.fechadas}*\n\n`;
  msg += `🛠️ Por Tipo:\n`;
  msg += `   • Corretivas: ${stats.corretivas}\n`;
  msg += `   • Preventivas: ${stats.preventivas}\n\n`;
  msg += `⚡ Urgentes: *${stats.urgentes}*\n`;

  await sendMessage(chatId, msg, mainMenuKeyboard, 'Markdown');
}

/**
 * Generate personal OS report
 */
export async function generateMyOSReport(
  chatId: number,
  userId: number,
  supabase: SupabaseClient
): Promise<void> {
  const stats = await getPersonalStats(supabase, userId);

  if (!stats || stats.total === 0) {
    await sendMessage(chatId, '📭 Você não tem nenhuma OS registrada.', mainMenuKeyboard);
    return;
  }

  let msg = '👤 *Minhas OS*\n\n';
  msg += `📋 Total: *${stats.total}*\n`;
  msg += `🔓 Abertas: *${stats.abertas}*\n`;
  msg += `✅ Fechadas: *${stats.fechadas}*\n`;
  msg += `⏱️ Tempo médio de resolução: *${stats.avgResolutionHours ? `${stats.avgResolutionHours}h` : 'N/A'}*\n`;

  await sendMessage(chatId, msg, mainMenuKeyboard, 'Markdown');
}

/**
 * Generate equipment report
 */
export async function generateEquipmentReport(
  chatId: number,
  userId: number,
  equipmentName: string,
  supabase: SupabaseClient
): Promise<void> {
  const tecnico = await isRegistered(userId, supabase);
  if (!tecnico) return;

  const osList = await getOSByEquipment(supabase, tecnico.empresa_id, equipmentName);
  await clearUserState(userId, supabase);

  if (osList.length === 0) {
    await sendMessage(chatId, `❌ Nenhuma OS encontrada para equipamento "${equipmentName}".`, mainMenuKeyboard);
    return;
  }

  let msg = `🔧 *Relatório: ${equipmentName}*\n\n`;
  msg += `📋 OS encontradas: ${osList.length}\n\n`;

  for (const os of osList.slice(0, 10)) {
    const date = new Date(os.data_abertura).toLocaleDateString('pt-BR');
    const isOpen = os.status_os === 'Aberta' || os.status_os === 'Em manutenção';
    const status = isOpen ? '🔓' : '✅';
    msg += `${status} *#${os.id}* - ${date}\n`;
    msg += `   ${os.descricao_problema?.substring(0, 50) || 'Sem descrição'}...\n\n`;
  }

  await sendMessage(chatId, msg, mainMenuKeyboard, 'Markdown');
}

/**
 * Generate 30 days report
 */
export async function generate30DaysReport(
  chatId: number,
  userId: number,
  supabase: SupabaseClient
): Promise<void> {
  const tecnico = await isRegistered(userId, supabase);
  if (!tecnico) return;

  const result = await getLast30DaysStats(supabase, tecnico.empresa_id);

  if (!result || result.stats.total === 0) {
    await sendMessage(chatId, '📭 Nenhuma OS nos últimos 30 dias.', mainMenuKeyboard);
    return;
  }

  let msg = '📅 *Últimos 30 Dias*\n\n';
  msg += `📋 Total de OS: *${result.stats.total}*\n`;
  msg += `🔓 Abertas: *${result.stats.abertas}*\n`;
  msg += `✅ Fechadas: *${result.stats.fechadas}*\n\n`;
  msg += `🔧 *Equipamentos mais frequentes:*\n`;
  for (const equip of result.topEquipments) {
    msg += `   • ${equip.name}: ${equip.count} OS\n`;
  }

  await sendMessage(chatId, msg, mainMenuKeyboard, 'Markdown');
}

/**
 * Handle report equipment flow
 */
export async function handleReportFlow(
  chatId: number,
  userId: number,
  text: string,
  state: string,
  supabase: SupabaseClient
): Promise<boolean> {
  if (state === States.REPORT_EQUIPMENT) {
    await generateEquipmentReport(chatId, userId, text, supabase);
    return true;
  }
  return false;
}

// === PDF Report Generation ===

function formatDatePt(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatFileDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTimePt(iso: string): string {
  const d = new Date(iso);
  return `${formatDatePt(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function wrapText(text: string, maxPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxPerLine) {
      lines.push(current.trim());
      current = w;
    } else {
      current += (current ? ' ' : '') + w;
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

function safe(v: any): string {
  return (v ?? 'N/A').toString();
}

/**
 * Generate detailed PDF report
 */
export async function generateDetailedPdfReport(
  chatId: number,
  userId: number,
  start: Date,
  end: Date,
  supabase: SupabaseClient
): Promise<void> {
  const tecnico = await isRegistered(userId, supabase);
  if (!tecnico) {
    await sendMessage(chatId, '❌ Você precisa estar cadastrado.', mainMenuKeyboard);
    return;
  }

  const osList = await getOSByDateRange(supabase, tecnico.empresa_id, start, end);
  const total = osList.length;
  const abertas = osList.filter((os) => os.status_os === 'Aberta' || os.status_os === 'Em manutenção').length;
  const fechadas = total - abertas;

  // Build PDF using pdf-lib
  const { PDFDocument, StandardFonts, rgb } = await import('https://esm.sh/pdf-lib@1.17.1');
  const pdfDoc = await PDFDocument.create();
  let currentPage = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const marginLeft = 40;
  const marginRight = 40;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let y = 800;

  const addNewPage = () => {
    currentPage = pdfDoc.addPage([595.28, 841.89]);
    y = 800;
  };

  const drawText = (text: string, x: number, size = 12, bold = false, color = rgb(0, 0, 0)) => {
    currentPage.drawText(text, { x, y, size, font: bold ? fontBold : font, color });
    y -= size + 6;
  };

  const drawLine = (thickness = 1, color = rgb(0.7, 0.7, 0.7)) => {
    currentPage.drawLine({
      start: { x: marginLeft, y: y + 8 },
      end: { x: pageWidth - marginRight, y: y + 8 },
      thickness,
      color,
    });
    y -= 10;
  };

  const checkPageBreak = (neededSpace: number) => {
    if (y < neededSpace) addNewPage();
  };

  // Header
  drawText('KRAFLO - Relatório Detalhado de OS', marginLeft, 18, true, rgb(0.1, 0.3, 0.5));
  y -= 5;
  drawLine(2, rgb(0.1, 0.3, 0.5));
  drawText(`Período: ${formatDatePt(start)} até ${formatDatePt(end)}`, marginLeft, 12);
  drawText(`Total de OS: ${total}  |  Abertas: ${abertas}  |  Fechadas/Outras: ${fechadas}`, marginLeft, 12);
  y -= 10;
  drawLine(1, rgb(0.8, 0.8, 0.8));
  y -= 15;

  // OS Details
  for (let i = 0; i < osList.length; i++) {
    const os = osList[i];
    checkPageBreak(200);

    currentPage.drawRectangle({
      x: marginLeft,
      y: y - 2,
      width: contentWidth,
      height: 22,
      color: rgb(0.95, 0.95, 0.95),
    });

    const statusColor = os.status_os === 'Aberta' ? rgb(0.8, 0.4, 0) : rgb(0, 0.5, 0.2);
    drawText(`OS #${os.id}`, marginLeft + 5, 14, true, rgb(0, 0, 0));
    currentPage.drawText(`[${os.status_os}]`, { x: marginLeft + 70, y: y + 20, size: 12, font: fontBold, color: statusColor });
    y -= 8;

    drawText(`Equipamento: ${safe(os.equipamento_nome)}`, marginLeft + 10, 11, true);
    if (os.equipamento_tag) drawText(`Tag: ${safe(os.equipamento_tag)}`, marginLeft + 10, 10);
    if (os.localizacao) drawText(`Localização: ${safe(os.localizacao)}`, marginLeft + 10, 10);
    y -= 5;

    currentPage.drawText('Datas:', { x: marginLeft + 10, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    y -= 14;
    drawText(`Abertura: ${formatDateTimePt(os.data_abertura)}`, marginLeft + 20, 10);
    if (os.data_fechamento) drawText(`Fechamento: ${formatDateTimePt(os.data_fechamento)}`, marginLeft + 20, 10);
    y -= 5;

    if (os.tipo_manutencao || os.prioridade) {
      currentPage.drawText('Classificação:', { x: marginLeft + 10, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
      y -= 14;
      if (os.tipo_manutencao) drawText(`Tipo: ${safe(os.tipo_manutencao)}`, marginLeft + 20, 10);
      if (os.prioridade) drawText(`Prioridade: ${safe(os.prioridade)}`, marginLeft + 20, 10);
      y -= 5;
    }

    if (os.descricao_problema) {
      checkPageBreak(80);
      currentPage.drawText('Descrição do Problema:', { x: marginLeft + 10, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
      y -= 14;
      for (const ln of wrapText(safe(os.descricao_problema), 85)) {
        checkPageBreak(20);
        drawText(ln, marginLeft + 20, 10);
      }
      y -= 5;
    }

    if (os.diagnostico_solucao) {
      checkPageBreak(80);
      currentPage.drawText('Diagnóstico/Solução:', { x: marginLeft + 10, y, size: 10, font: fontBold, color: rgb(0, 0.4, 0.2) });
      y -= 14;
      for (const ln of wrapText(safe(os.diagnostico_solucao), 85)) {
        checkPageBreak(20);
        drawText(ln, marginLeft + 20, 10);
      }
      y -= 5;
    }

    if (os.notas_finais) {
      checkPageBreak(80);
      currentPage.drawText('Notas Finais:', { x: marginLeft + 10, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
      y -= 14;
      for (const ln of wrapText(safe(os.notas_finais), 85)) {
        checkPageBreak(20);
        drawText(ln, marginLeft + 20, 10);
      }
      y -= 5;
    }

    y -= 10;
    if (i < osList.length - 1) {
      checkPageBreak(30);
      drawLine(1, rgb(0.6, 0.6, 0.6));
      y -= 15;
    }
  }

  // Footer
  y = 30;
  currentPage.drawText(`Gerado em: ${formatDateTimePt(new Date().toISOString())} | KRAFLO Sistema de Manutenção`, {
    x: marginLeft,
    y,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  const publicUrl = await uploadPdfReport(
    supabase,
    pdfBytes,
    tecnico.empresa_id,
    formatFileDate(start),
    formatFileDate(end)
  );

  if (!publicUrl) {
    await sendMessage(chatId, '❌ Erro ao salvar PDF.', mainMenuKeyboard);
    return;
  }

  await sendDocument(chatId, publicUrl, `Relatório detalhado (${formatDatePt(start)} - ${formatDatePt(end)})`);
}
