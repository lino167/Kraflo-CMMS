/**
 * Telegram-related types and interfaces
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Telegram Update types
export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramPhoto {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: TelegramPhoto[];
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message: TelegramMessage;
  data: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

// Bot context for handlers
export interface BotContext {
  chatId: number;
  userId: number;
  text: string;
  photo?: TelegramPhoto[];
  supabase: SupabaseClient;
  correlationId: string;
}

// Technician data from database
export interface Tecnico {
  id_telegram: number;
  empresa_id: string;
  nome_completo: string;
  funcao?: string;
  setor?: string;
  codigo_empresa?: string;
}

// User state for multi-step flows
export interface UserState {
  state: string;
  data: Record<string, any>;
}

// OS (Work Order) data
export interface OrdemDeServico {
  id: number;
  tecnico_id: number;
  empresa_id: string;
  equipamento_nome: string;
  equipamento_tag?: string;
  localizacao?: string;
  tipo_manutencao?: string;
  prioridade?: string;
  descricao_problema?: string;
  diagnostico_solucao?: string;
  notas_finais?: string;
  status_os: string;
  data_abertura: string;
  data_fechamento?: string;
  url_foto?: string;
  url_arquivo_fechamento?: string;
}

// Part/Piece data
export interface Peca {
  nome_peca: string;
  tag_peca?: string;
  quantidade: number;
}
