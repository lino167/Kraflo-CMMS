# Supabase Kraflo — Automações e Integrações

## Variáveis de Ambiente
- `SUPABASE_URL`: URL do projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: chave de serviço (servidor)
- `LOVABLE_API_KEY`: chave do gateway Lovable AI
- `TELEGRAM_BOT_TOKEN`: token do bot Telegram
- `ALLOWED_ORIGINS`: lista de origens permitidas (CSV) para CORS nas Functions
- `USE_EMBEDDINGS`: `true/false` para habilitar busca vetorial na assistente-ia

## Functions
- `assistente-ia`: recebe `mensagem`, `empresa_id`, `conversa_id`, `tecnico_id`; busca contexto (manuais/OS) por embeddings (opcional) com fallback textual; gera resposta via IA e persiste conversas.
- `index-os`: gera embeddings para OS finalizadas; exige admin.
- `upload-manual`: grava metadados de manuais, divide texto em chunks e indexa embeddings.
- `telegram-webhook`: fluxo completo de OS no Telegram; integra com storage e `assistente-ia`.
- `health`: retorna status simples do ambiente e banco.

## Segurança
- Auth centralizado em `supabase/functions/_shared/auth.ts` (CORS dinâmico, extração de token, verificação de usuário/serviço, checagem de admin).
- RLS restritiva em tabelas críticas (migrations na pasta `supabase/migrations`).
- CORS restrito via `ALLOWED_ORIGINS`.
- Rate limiting simples por chamador na `assistente-ia`.

## Fluxos
- Web UI (`AIChat`) → `assistente-ia` → busca contexto → IA → persiste `ia_conversas`/`ia_mensagens`.
- Admin → `index-os` → gera embeddings para OS fechadas.
- Admin → `upload-manual` → storage + chunks + embeddings.
- Telegram → `telegram-webhook` → CRUD de OS, relatórios, IA.

## Observabilidade
- Correlação de requisições (`correlation_id`) na resposta da `assistente-ia`.
- `health` inclui timestamp atual.

## Notas
- Nunca expor `service_role` em frontend.
- Manter RLS rigorosa; funções servidoras já ignoram RLS, por isso validar papéis nelas.

