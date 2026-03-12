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
export async function resolveAuthContext(
  telegramUserId: number,
  supabase: SupabaseClient
): Promise<AuthContext> {
  // Fetch technician record by Telegram ID
  const { data: tecnico, error } = await supabase
    .from('tecnicos')
    .select('*')
    .eq('id_telegram', telegramUserId)
    .maybeSingle();

  if (error) {
    logger.error('Error fetching tecnico', error, { userId: telegramUserId });
    return { tecnico: null, empresaId: null, isRegistered: false, role: null };
  }

  if (!tecnico) {
    return { tecnico: null, empresaId: null, isRegistered: false, role: null };
  }

  // Check for admin roles via profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id_telegram', telegramUserId)
    .maybeSingle();

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
  const { data: tecnico } = await supabase
    .from('tecnicos')
    .select('*')
    .eq('id_telegram', telegramUserId)
    .maybeSingle();

  return tecnico || null;
}
