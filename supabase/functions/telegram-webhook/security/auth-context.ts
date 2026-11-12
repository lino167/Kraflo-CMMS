/**
 * Authentication context resolution for Telegram users
 * Resolves user identity and company association from Telegram ID
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Tecnico } from '../telegram-types.ts';
import { logger } from '../infra/logger.ts';

export interface AuthContext {
  tecnico: Tecnico | null;
  empresaId: string | null;
  isRegistered: boolean;
  role: 'tecnico' | 'admin_empresa' | 'admin_kraflo' | null;
}

/**
 * Resolve authentication context from Telegram user ID
 */
/**
 * Encontra o técnico vinculado a esta conta do Telegram.
 * A chave do técnico (id_telegram) é um número interno; o vínculo com o Telegram
 * fica em telegram_user_id e só é gravado pelo comando /vincular, com código gerado no app.
 * Enquanto a migration do vínculo não estiver aplicada, usa a chave antiga.
 */
async function findTecnicoByTelegram(
  telegramUserId: number,
  supabase: SupabaseClient
): Promise<{ tecnico: Tecnico | null; error: unknown }> {
  const linked = await supabase
    .from('tecnicos')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();
  if (!linked.error) return { tecnico: linked.data, error: null };
  if (linked.error.code !== '42703') return { tecnico: null, error: linked.error };

  const legacy = await supabase
    .from('tecnicos')
    .select('*')
    .eq('id_telegram', telegramUserId)
    .maybeSingle();
  return { tecnico: legacy.data, error: legacy.error };
}

export async function resolveAuthContext(
  telegramUserId: number,
  supabase: SupabaseClient
): Promise<AuthContext> {
  const { tecnico, error } = await findTecnicoByTelegram(telegramUserId, supabase);

  if (error) {
    logger.error('Error fetching tecnico', error, { userId: telegramUserId });
    return { tecnico: null, empresaId: null, isRegistered: false, role: null };
  }

  if (!tecnico) {
    return { tecnico: null, empresaId: null, isRegistered: false, role: null };
  }

  // Papel de admin vem da conta ligada ao técnico (não de um ID digitado no perfil)
  const linkedUserId = (tecnico as Tecnico & { user_id?: string | null }).user_id ?? null;
  const profile = linkedUserId ? { id: linkedUserId } : null;

  let role: AuthContext['role'] = 'tecnico';

  if (profile?.id) {
    // Check admin_kraflo role
    const { data: isAdminKraflo } = await supabase.rpc('is_admin_kraflo', {
      _user_id: profile.id,
    });

    if (isAdminKraflo) {
      role = 'admin_kraflo';
    } else {
      // Check admin_empresa role
      const { data: hasAdminRole } = await supabase.rpc('has_role', {
        _user_id: profile.id,
        _role: 'admin_empresa',
      });
      if (hasAdminRole) {
        role = 'admin_empresa';
      }
    }
  }

  return {
    tecnico,
    empresaId: tecnico.empresa_id,
    isRegistered: true,
    role,
  };
}

/**
 * Quick check if a user is registered as a technician
 */
export async function isRegistered(
  telegramUserId: number,
  supabase: SupabaseClient
): Promise<Tecnico | null> {
  const { tecnico } = await findTecnicoByTelegram(telegramUserId, supabase);
  return tecnico || null;
}
