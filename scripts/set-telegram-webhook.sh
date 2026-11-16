#!/bin/bash
# Registra o webhook do bot no Telegram com token secreto.
# Uso:
#   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... SUPABASE_PROJECT_REF=... ./scripts/set-telegram-webhook.sh
# Antes, grave o mesmo segredo na função:
#   supabase secrets set TELEGRAM_WEBHOOK_SECRET=...
set -euo pipefail
: "${TELEGRAM_BOT_TOKEN:?defina TELEGRAM_BOT_TOKEN}"
: "${TELEGRAM_WEBHOOK_SECRET:?defina TELEGRAM_WEBHOOK_SECRET (1-256 caracteres: letras, números, _ e -)}"
: "${SUPABASE_PROJECT_REF:?defina SUPABASE_PROJECT_REF}"

curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/telegram-webhook" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message","callback_query"]'
echo
