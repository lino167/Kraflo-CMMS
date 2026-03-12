/**
 * Supabase client initialization for the Telegram bot
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './config.ts';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get the Supabase service client (uses service role key)
 * This client bypasses RLS - use with caution
 */
export function getServiceClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseClient;
}

/**
 * Create a fresh client for each request if needed
 */
export function createServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}
