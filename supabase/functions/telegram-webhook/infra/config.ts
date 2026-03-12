/**
 * Configuration and environment variables for the Telegram bot
 */

export const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
export const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
export const WEB_APP_URL = 'https://kraflo.lovable.app';

// Main menu keyboard for the bot
export const mainMenuKeyboard = {
  keyboard: [
    [{ text: '🆕 Abrir OS' }, { text: '✅ Fechar OS' }],
    [{ text: '📋 Listar Abertas' }, { text: '🗂️ Listar Fechadas' }],
    [{ text: '✏️ Editar OS' }, { text: '🗑️ Deletar OS' }],
    [{ text: '⚙️ Consultar Peças' }, { text: '📊 Relatórios' }],
    [{ text: '🤖 Assistente IA' }, { text: 'ℹ️ Sobre' }],
  ],
  resize_keyboard: true,
};

// Cancel keyboard for multi-step flows
export const cancelKeyboard = {
  keyboard: [[{ text: '❌ Cancelar' }]],
  resize_keyboard: true,
};
