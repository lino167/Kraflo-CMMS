/**
 * Session state management for multi-step conversation flows
 * Persists state in the database since Edge Functions are stateless
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Database } from '../../../src/integrations/supabase/types.ts';
import { UserState } from './telegram-types.ts';
import { logger } from './infra/logger.ts';

// State machine states for different flows
export const States = {
  // Open OS flow
  OS_STOP_CATEGORY: 'OS_STOP_CATEGORY', // NEW: Select stop category first
  OS_STOP_SUBCATEGORY: 'OS_STOP_SUBCATEGORY', // NEW: Select stop subcategory (optional)
  OS_EQUIPMENT: 'OS_EQUIPMENT',
  OS_TAG: 'OS_TAG',
  OS_LOCATION: 'OS_LOCATION',
  OS_MAINT_TYPE: 'OS_MAINT_TYPE',
  OS_PRIORITY: 'OS_PRIORITY',
  OS_PROBLEM: 'OS_PROBLEM',
  OS_ASK_PHOTO: 'OS_ASK_PHOTO',
  OS_PHOTO: 'OS_PHOTO',

  // Close OS flow
  CLOSE_ROOT_CAUSE: 'CLOSE_ROOT_CAUSE', // NEW: Select root cause category first
  CLOSE_ROOT_SUBCATEGORY: 'CLOSE_ROOT_SUBCATEGORY', // NEW: Select root cause subcategory (optional)
  CLOSE_SOLUTION: 'CLOSE_SOLUTION',
  CLOSE_PARTS: 'CLOSE_PARTS',
  CLOSE_PART_NAME: 'CLOSE_PART_NAME',
  CLOSE_PART_TAG: 'CLOSE_PART_TAG',
  CLOSE_PART_QTY: 'CLOSE_PART_QTY',
  CLOSE_MORE_PARTS: 'CLOSE_MORE_PARTS',
  CLOSE_STATUS: 'CLOSE_STATUS',
  CLOSE_ASK_NOTES: 'CLOSE_ASK_NOTES',
  CLOSE_NOTES: 'CLOSE_NOTES',
  CLOSE_ASK_PHOTO: 'CLOSE_ASK_PHOTO',
  CLOSE_PHOTO: 'CLOSE_PHOTO',

  // Edit OS flow
  EDIT_SELECT_FIELD: 'EDIT_SELECT_FIELD',
  EDIT_VALUE: 'EDIT_VALUE',

  // Delete OS flow
  DELETE_CONFIRM: 'DELETE_CONFIRM',

  // Parts search
  PARTS_SEARCH: 'PARTS_SEARCH',

  // IA chat
  IA_QUESTION: 'IA_QUESTION',

  // Reports
  REPORT_EQUIPMENT: 'REPORT_EQUIPMENT',
  REPORT_CAL_START: 'REPORT_CAL_START',
  REPORT_CAL_END: 'REPORT_CAL_END',
} as const;

export type StateType = typeof States[keyof typeof States];

/**
 * Get the current state for a user
 */
export async function getUserState(
  userId: number,
  supabase: SupabaseClient<Database>
): Promise<UserState | null> {
  const { data, error } = await supabase
    .from('bot_user_states')
    .select('state, data')
    .eq('id_telegram', userId)
    .maybeSingle();

  if (error || !data) return null;
  return { state: data.state, data: data.data || {} };
}

/**
 * Set the state for a user (upsert)
 */
export async function setUserState(
  userId: number,
  state: string,
  stateData: Record<string, unknown>,
  supabase: SupabaseClient<Database>
): Promise<void> {
  const previousState = await getUserState(userId, supabase);

  await supabase.from('bot_user_states').upsert(
    {
      id_telegram: userId,
      state,
      data: stateData || {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id_telegram' }
  );

  logger.stateChange(userId, previousState?.state || 'none', state);
}

/**
 * Clear/delete the state for a user
 */
export async function clearUserState(
  userId: number,
  supabase: SupabaseClient<Database>
): Promise<void> {
  await supabase.from('bot_user_states').delete().eq('id_telegram', userId);
  logger.stateChange(userId, 'active', 'cleared');
}
