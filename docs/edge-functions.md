# Edge Functions - Kraflo CMMS

Documentacao detalhada das Supabase Edge Functions do projeto.

Todas as functions rodam em **Deno** e estao localizadas em `supabase/functions/`.

---

## Configuracao

As configuracoes de JWT para cada function estao em `supabase/config.toml`:

```toml
[functions.assistente-ia]
verify_jwt = true

[functions.index-os]
verify_jwt = true

[functions.upload-manual]
verify_jwt = true

[functions.telegram-webhook]
verify_jwt = false          # Webhook publico

[functions.health]
verify_jwt = false           # Healthcheck publico

[functions.process-os-index-queue]
verify_jwt = true

[functions.backfill-os-index]
verify_jwt = true

[functions.reports-summary]
verify_jwt = true

[functions.admin-roles]
verify_jwt = true
```

---

## Variaveis de Ambiente

| Variavel | Obrigatoria | Descricao |
|---|---|---|
| `SUPABASE_URL` | Sim | URL do projeto Supabase (automatica) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave de servico (automatica) |
| `LOVABLE_API_KEY` | Sim | Chave do gateway Lovable AI para embeddings e chat |
| `TELEGRAM_BOT_TOKEN` | Sim* | Token do bot Telegram (*obrigatorio apenas para `telegram-webhook`) |
| `ALLOWED_ORIGINS` | Nao | Lista de origens CORS separadas por virgula (default: `*`) |
| `USE_EMBEDDINGS` | Nao | `true`/`false` para habilitar busca vetorial na `assistente-ia` |

---

## Modulo Compartilhado (`_shared/`)

### `auth.ts`

Modulo centralizado de autenticacao e CORS usado por todas as functions.

**Funcoes exportadas:**

| Funcao | Descricao |
|---|---|
| `buildCorsHeaders(req)` | Gera headers CORS dinamicos baseados em `ALLOWED_ORIGINS` |
| `getServiceClient()` | Retorna um cliente Supabase com `service_role` (ignora RLS) |
| `extractAuthToken(req)` | Extrai o token Bearer do header Authorization |
| `isServiceRoleToken(token)` | Verifica se o token e o `service_role` |
| `getUserFromToken(token)` | Retorna o usuario autenticado a partir do token JWT |
| `assertAdmin(userId)` | Verifica se o usuario e admin (`admin_kraflo` ou `admin_empresa`) |
| `getClientIp(req)` | Extrai o IP do cliente (para rate limiting) |

### `ai.ts`

Modulo para geracao de embeddings vetoriais.

**Funcoes exportadas:**

| Funcao | Descricao |
|---|---|
| `generateEmbedding(text)` | Gera um embedding vetorial de 768 dimensoes usando o modelo `text-embedding-3-small` via Lovable AI Gateway |

**Detalhes:**
- Endpoint: `https://ai.gateway.lovable.dev/v1/embeddings`
- Modelo: `text-embedding-3-small`
- Dimensoes: 768
- Autenticacao: Bearer token com `LOVABLE_API_KEY`

---

## Functions

### `assistente-ia`

Assistente IA com contexto de manutencao industrial.

**Metodo:** POST
**JWT:** Obrigatorio
**Body:**

```json
{
  "mensagem": "Como resolver vibração excessiva no motor X?",
  "empresa_id": "uuid",
  "conversa_id": "uuid (opcional, cria nova se ausente)",
  "tecnico_id": 294152778
}
```

**Fluxo:**
1. Valida autenticacao (token JWT ou service_role).
2. Aplica rate limiting por IP do chamador.
3. Busca contexto relevante:
   - Se `USE_EMBEDDINGS=true`: busca vetorial em `manual_chunks` e `os_embeddings`.
   - Fallback: busca textual com `ilike` em manuais e OS.
4. Monta prompt com contexto e envia para IA.
5. Persiste conversa em `ia_conversas` e mensagens em `ia_mensagens`.
6. Retorna resposta com fontes citadas e `correlation_id`.

**Resposta:**

```json
{
  "resposta": "Texto da resposta do assistente...",
  "fontes": [...],
  "correlation_id": "uuid"
}
```

---

### `index-os`

Indexa OS finalizadas gerando embeddings vetoriais.

**Metodo:** POST
**JWT:** Obrigatorio (admin)
**Body:**

```json
{
  "index_all": true
}
```

**Fluxo:**
1. Verifica que o chamador e admin.
2. Busca OS com status `Fechada` ou `Liberado para producao` que ainda nao possuem embedding.
3. Para cada OS, combina `descricao_problema + diagnostico_solucao + notas_finais`.
4. Gera embedding via `generateEmbedding()`.
5. Insere/atualiza em `os_embeddings`.
6. Atualiza `index_status` na OS.

**Resposta:**

```json
{
  "indexed": 42,
  "errors": 0
}
```

---

### `upload-manual`

Processa upload de manuais tecnicos.

**Metodo:** POST
**JWT:** Obrigatorio
**Body:** Metadados do manual (nome, tipo, categoria, fabricante, etc.) + referencia ao arquivo no Storage.

**Fluxo:**
1. Grava metadados na tabela `manuais`.
2. Extrai texto do arquivo.
3. Divide texto em chunks.
4. Para cada chunk, gera embedding vetorial.
5. Insere chunks em `manual_chunks` com embeddings.
6. Marca manual como `processado = true`.

---

### `telegram-webhook`

Webhook para integracao com Telegram.

**Metodo:** POST
**JWT:** Nao requerido (webhook publico)
**Body:** Update do Telegram Bot API.

**Funcionalidades:**
- Criacao de OS via chat do Telegram.
- Atualizacao de status de OS.
- Consulta de relatorios.
- Chat com assistente IA (redireciona para `assistente-ia`).
- Gerenciamento de estado de conversa via `bot_user_states`.

---

### `health`

Healthcheck simples do ambiente.

**Metodo:** GET
**JWT:** Nao requerido

**Resposta:**

```json
{
  "status": "ok",
  "timestamp": "2026-01-15T10:30:00Z"
}
```

---

### `process-os-index-queue`

Processa a fila de indexacao de OS em background.

**Metodo:** POST
**JWT:** Obrigatorio

**Fluxo:**
1. Busca jobs pendentes em `os_index_jobs` onde `next_run_at <= now`.
2. Para cada job, tenta gerar embedding.
3. Em caso de sucesso, atualiza status para `done`.
4. Em caso de erro, incrementa `attempts` e agenda `next_run_at` com backoff.

---

### `backfill-os-index`

Classificacao e indexacao retroativa de OS existentes.

**Metodo:** POST
**JWT:** Obrigatorio (admin)
**Body:**

```json
{
  "empresa_id": "uuid"
}
```

**Fluxo:**
1. Busca todas as OS da empresa que precisam ser reprocessadas.
2. Cria jobs de indexacao em `os_index_jobs`.

---

### `reports-summary`

Gera relatorios consolidados por periodo.

**Metodo:** POST
**JWT:** Obrigatorio
**Body:**

```json
{
  "period": "7d" | "30d" | "90d" | "365d"
}
```

**Resposta:** Dados consolidados incluindo metricas operacionais, distribuicao por categoria, desempenho de tecnicos, etc.

---

### `admin-roles`

Gerenciamento de papeis de usuarios.

**Metodo:** POST
**JWT:** Obrigatorio (admin)

**Funcionalidades:**
- Atribuir roles a usuarios.
- Remover roles de usuarios.
- Listar usuarios e seus papeis.

---

## Deploy de Functions

Para fazer deploy de todas as functions:

```bash
chmod +x scripts/setup-supabase.sh
./scripts/setup-supabase.sh
```

Ou individualmente:

```bash
supabase functions deploy assistente-ia --no-verify-jwt
supabase functions deploy index-os
```

Para configurar secrets:

```bash
supabase secrets set LOVABLE_API_KEY=sua-chave
supabase secrets set TELEGRAM_BOT_TOKEN=seu-token
supabase secrets set ALLOWED_ORIGINS=https://seudominio.com
```
