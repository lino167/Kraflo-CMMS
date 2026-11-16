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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();

  // O Telegram envia o token secreto cadastrado no setWebhook neste cabeçalho.
  // Sem ele, qualquer pessoa que conheça a URL poderia forjar mensagens de um técnico.
  const expectedSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
  if (expectedSecret) {
    const received = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
    if (!timingSafeEqual(received, expectedSecret)) {
      logger.warn('Webhook rejeitado: token secreto ausente ou inválido', { correlationId });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else {
    logger.warn('TELEGRAM_WEBHOOK_SECRET não configurado: webhook aceitando chamadas sem verificação', { correlationId });
  }

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
    
    // Responde 200 mesmo em erro: com 5xx o Telegram reenvia a mesma mensagem,
    // o que pode repetir a ação (ex.: criar a OS duas vezes).
    return new Response(
      JSON.stringify({ ok: false, correlation_id: correlationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
