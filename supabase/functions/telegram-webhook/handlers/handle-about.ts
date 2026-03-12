/**
 * Handler for "Sobre" (About) command
 */

import { sendMessage } from '../services/telegram-service.ts';
import { mainMenuKeyboard } from '../infra/config.ts';

export async function handleAbout(chatId: number): Promise<void> {
  await sendMessage(
    chatId,
    'ℹ️ *KRAFLO - Plataforma de Gestão de Manutenção*\n\n' +
      'O KRAFLO é um CMMS (Sistema de Gestão de Manutenção) para operações industriais e técnicas em geral.\n\n' +
      '🏭 *Aplicações:*\n' +
      '• Manutenção industrial\n' +
      '• Manutenção predial\n' +
      '• HVAC e facilities\n' +
      '• Frotas e ativos técnicos\n\n' +
      '🔧 *Funcionalidades:*\n' +
      '• Gestão de Ordens de Serviço\n' +
      '• Histórico de equipamentos\n' +
      '• Controle de peças utilizadas\n' +
      '• Assistente IA para diagnósticos\n' +
      '• Indicadores MTTR e MTBF\n' +
      '• Relatórios de manutenção\n\n' +
      '📱 Versão: 3.0\n' +
      '🌐 kraflo.com.br',
    mainMenuKeyboard,
    'Markdown'
  );
}
