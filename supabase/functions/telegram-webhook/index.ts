/**
 * Telegram Webhook Edge Function - Entry Point
 * 
 * This is the main entry point for the Telegram bot webhook.
 * It handles incoming updates from Telegram and routes them to appropriate handlers.
 * 
 * Architecture:
 * - index.ts (this file): HTTP entry point, minimal orchestration
 * - telegram-router.ts: Routes updates to handlers
 * - handlers/: Individual command handlers
 * - services/: Business logic and external integrations
 * - security/: Authentication and authorization
 * - infra/: Configuration, logging, clients
 * - session-state.ts: Multi-step conversation state management
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { buildCorsHeaders } from '../_shared/auth.ts';
import { getServiceClient } from './infra/supabase-client.ts';
import { logger } from './infra/logger.ts';
import { routeMessage, routeCallback } from './telegram-router.ts';
import { TelegramUpdate } from './telegram-types.ts';

serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const body: TelegramUpdate = await req.json();
    logger.info('Webhook received', { 
      correlationId, 
      hasMessage: !!body.message, 
      hasCallback: !!body.callback_query 
    });

    const supabase = getServiceClient();

    // Route to appropriate handler
    if (body.callback_query) {
      await routeCallback(body.callback_query, supabase);
    } else if (body.message) {
      await routeMessage(body.message, supabase);
    }

    return new Response(
      JSON.stringify({ ok: true, correlation_id: correlationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Webhook error', error, { correlationId });
    
    return new Response(
      JSON.stringify({ error: 'Internal error', correlation_id: correlationId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
