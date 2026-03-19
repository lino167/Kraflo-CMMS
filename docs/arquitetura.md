# Arquitetura do Kraflo CMMS

Este documento descreve a arquitetura geral do sistema Kraflo CMMS, incluindo frontend, backend e integrações.

---

## Visao Geral

O Kraflo CMMS segue uma arquitetura **cliente-servidor** moderna:

- **Frontend**: Single Page Application (SPA) em React + TypeScript, servida via Vite e hospedada na Vercel.
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions) como Backend-as-a-Service (BaaS).
- **Integracao com IA**: Edge Functions que consomem a API do Lovable AI Gateway para gerar embeddings e respostas contextuais.
- **Bot Telegram**: Edge Function que atua como webhook para operacoes de OS via Telegram.

```
+-----------------+       +---------------------+       +-------------------+
|   Frontend      |       |     Supabase         |       |  Servicos         |
|   (React SPA)   | <---> |  (PostgreSQL + Auth) | <---> |  Externos         |
|                 |       |  + Edge Functions    |       |  (Lovable AI,     |
|  Vercel (CDN)   |       |  + Storage           |       |   Telegram API)   |
+-----------------+       +---------------------+       +-------------------+
```

---

## Frontend

### Stack Tecnologico

| Tecnologia | Funcao |
|---|---|
| React 18 | Biblioteca de UI |
| TypeScript | Tipagem estatica |
| Vite 5 | Bundler e dev server |
| Tailwind CSS 3 | Estilizacao utility-first |
| shadcn/ui (Radix UI) | Componentes acessiveis |
| TanStack Query v5 | Cache e sincronizacao de dados |
| React Router v6 | Roteamento SPA |
| Recharts | Graficos e visualizacoes |
| Zod | Validacao de schemas |
| date-fns | Manipulacao de datas |
| jsPDF | Exportacao de relatorios em PDF |

### Estrutura de Pastas

```
src/
  App.tsx                 # Componente raiz com rotas e providers
  main.tsx                # Ponto de entrada da aplicacao
  index.css               # Estilos globais (Tailwind + tema custom)
  components/             # Componentes reutilizaveis
    ui/                   # Componentes shadcn/ui (Button, Card, Dialog, etc.)
    Dashboard.tsx         # Dashboard operacional com metricas
    AIChat.tsx            # Chat com assistente IA
    AIReport.tsx          # Relatorios gerados por IA
    OSForm.tsx            # Formulario de criacao/edicao de OS
    OSList.tsx            # Lista de Ordens de Servico
    OSViewDialog.tsx      # Dialogo de visualizacao detalhada de OS
    OSPdfExport.tsx       # Exportacao individual de OS em PDF
    OSListPdfExport.tsx   # Exportacao em lote de OS em PDF
    ManualUpload.tsx      # Upload de manuais tecnicos
    PreventivePlanWizard.tsx  # Wizard para planos de manutencao preventiva
    ...                   # Outros componentes de dashboard e analytics
  domain/                 # Servicos de dominio (logica de negocio)
    osService.ts          # Servico para categorias e classificacao de OS
    reportService.ts      # Servico para relatorios e benchmarks
  hooks/                  # Custom React hooks
    useAuth.tsx           # Autenticacao e controle de acesso
    useReportStats.ts     # Estatisticas para o dashboard
    useDeepReportStats.ts # Relatorios avancados via Edge Function
    useEquipmentHistory.ts # Historico e analise de equipamentos
    useTechnicianStats.ts # Metricas de desempenho de tecnicos
    useOSCategories.ts    # Categorias de OS (parada/problema)
    useInternalBenchmarks.ts # Benchmarks internos configuravei
    use-mobile.tsx        # Deteccao de dispositivo movel
    use-toast.ts          # Hook do sistema de notificacoes
  integrations/
    supabase/
      client.ts           # Cliente Supabase configurado
      types.ts            # Tipos gerados automaticamente (Database schema)
  lib/                    # Utilitarios e helpers
    utils.ts              # Funcoes utilitarias gerais (cn, etc.)
    error-handler.ts      # Tratamento centralizado de erros
    report-types.ts       # Tipos para relatorios
    report-utils.ts       # Utilitarios de relatorios
    manual-taxonomy.ts    # Taxonomia de manuais (categorias, tipos)
    validation-schemas.ts # Schemas Zod reutilizaveis
  pages/                  # Paginas da aplicacao (rotas)
    Auth.tsx              # Login e cadastro
    Index.tsx             # Pagina principal (Dashboard + Chat + Relatorios)
    OrdensServico.tsx     # Gerenciamento de Ordens de Servico
    Biblioteca.tsx        # Biblioteca de Conhecimento (manuais + wiki)
    EquipamentoRaioX.tsx  # Analise de manutencoes por equipamento
    PerfilTecnico.tsx     # Dashboard de desempenho do tecnico
    IndexacaoAdmin.tsx    # Painel admin para indexacao de OS
    NotFound.tsx          # Pagina 404
  tests/                  # Testes unitarios
  types/                  # Declaracoes de tipos adicionais
```

### Roteamento

| Rota | Pagina | Descricao |
|---|---|---|
| `/` | `Index` | Dashboard principal com abas: Dashboard, Chat IA, Relatorios, Manuais |
| `/auth` | `Auth` | Tela de login e cadastro |
| `/ordens-servico` | `OrdensServico` | CRUD completo de Ordens de Servico |
| `/biblioteca` | `Biblioteca` | Biblioteca de manuais e wiki de reparos |
| `/equipamento` | `EquipamentoRaioX` | Analise de manutencoes do mes |
| `/equipamento/:tag` | `EquipamentoRaioX` | Analise por tag de equipamento |
| `/meu-desempenho` | `PerfilTecnico` | Dashboard de performance individual |
| `/admin/indexacao` | `IndexacaoAdmin` | Painel de indexacao (admin) |
| `*` | `NotFound` | Pagina nao encontrada |

Todas as rotas sao carregadas com **lazy loading** (`React.lazy` + `Suspense`) para otimizar o bundle inicial.

### Padroes de UI

- **Floating Command Bridge**: Header flutuante com glassmorphism que aparece em todas as paginas.
- **Bento Box Layout**: Dashboard organizado em grid com cards de metricas.
- **Industrial Theme**: Tema escuro com estetica "Deep Tech", fontes mono e cores de alta visibilidade.

---

## Backend (Supabase)

### Banco de Dados (PostgreSQL)

#### Tabelas Principais

| Tabela | Descricao |
|---|---|
| `empresas` | Empresas cadastradas no sistema |
| `profiles` | Perfis de usuarios (vinculados ao Supabase Auth) |
| `user_roles` | Papeis dos usuarios (`admin_kraflo`, `admin_empresa`) |
| `tecnicos` | Tecnicos de manutencao (identificados pelo `id_telegram`) |
| `ordens_de_servico` | Ordens de Servico (OS) - tabela central do sistema |
| `categorias_parada` | Categorias de motivo de parada |
| `categorias_problema` | Categorias de causa raiz |
| `subcategorias` | Subcategorias vinculadas a parada ou problema |
| `pecas_utilizadas` | Pecas usadas no reparo de cada OS |
| `manuais` | Metadados de manuais tecnicos |
| `manual_chunks` | Chunks de texto dos manuais (para busca vetorial) |
| `os_embeddings` | Embeddings vetoriais de OS finalizadas |
| `os_index_jobs` | Fila de jobs de indexacao de OS |
| `ia_conversas` | Conversas com o assistente IA |
| `ia_mensagens` | Mensagens individuais das conversas IA |
| `planos_manutencao` | Planos de manutencao preventiva |
| `tarefas_preventivas` | Tarefas dentro de planos preventivos |
| `execucoes_preventivas` | Execucoes agendadas de tarefas preventivas |
| `config_benchmarks` | Configuracao de benchmarks por empresa |
| `bot_user_states` | Estado de usuarios do bot Telegram |

#### Views

| View | Descricao |
|---|---|
| `v_equipment_health` | Saude dos equipamentos (MTTR, MTBF, criticidade) |
| `v_os_analytics` | Dados analiticos de OS para dashboards |
| `v_tag_timeline` | Timeline de eventos por tag de equipamento |
| `v_technician_performance` | Metricas de desempenho dos tecnicos |

#### Enums

| Enum | Valores |
|---|---|
| `app_role` | `admin_kraflo`, `admin_empresa` |
| `os_status` | `Aberta`, `Em manutencao`, `Nao liberado`, `Fechada`, `Liberado para producao` |
| `os_index_status` | `pending`, `queued`, `indexing`, `indexed`, `error` |
| `manual_type` | `general`, `equipment` |
| `manual_category` | `eletrica`, `pneumatica`, `hidraulica`, `seguranca`, `preventiva`, `lubrificacao`, `troubleshooting`, `mecanica`, `automacao`, `instrumentacao`, `geral` |
| `periodicidade_manutencao` | `diaria`, `semanal`, `quinzenal`, `mensal`, `bimestral`, `trimestral`, `semestral`, `anual` |
| `execucao_status` | `agendada`, `em_andamento`, `concluida`, `cancelada`, `atrasada` |

### Seguranca

- **Row Level Security (RLS)**: Todas as tabelas criticas possuem politicas RLS que isolam dados por `empresa_id`.
- **Auth**: Supabase Auth com email/senha. Verificacao de email obrigatoria no cadastro.
- **Roles**: Sistema de papeis via tabela `user_roles` com funcoes RPC (`is_admin_kraflo`, `has_role`).
- **CORS**: Edge Functions utilizam `ALLOWED_ORIGINS` para restringir origens permitidas.
- **Service Role**: Usado apenas no servidor (Edge Functions). Nunca exposto no frontend.

### Edge Functions

Todas as Edge Functions rodam em Deno e estao em `supabase/functions/`.

| Function | JWT? | Descricao |
|---|---|---|
| `assistente-ia` | Sim | Assistente IA com contexto de manuais e OS. Suporta busca vetorial (embeddings) e fallback textual. |
| `index-os` | Sim | Gera embeddings para OS finalizadas. Requer admin. |
| `upload-manual` | Sim | Upload de manuais: grava metadados, divide texto em chunks e indexa embeddings. |
| `telegram-webhook` | Nao | Webhook do bot Telegram para CRUD de OS, relatorios e chat IA. |
| `health` | Nao | Healthcheck simples que retorna status do ambiente. |
| `process-os-index-queue` | Sim | Processa fila de indexacao de OS em background. |
| `backfill-os-index` | Sim | Classificacao retroativa de OS existentes. |
| `reports-summary` | Sim | Gera relatorios consolidados por periodo. |
| `admin-roles` | Sim | Gerenciamento de papeis de usuarios. |

#### Modulo Compartilhado (`_shared/`)

- **`auth.ts`**: CORS dinamico, extracao de token JWT, verificacao de usuario/servico, checagem de admin.
- **`ai.ts`**: Geracao de embeddings via Lovable AI Gateway (modelo `text-embedding-3-small`, 768 dimensoes).

---

## Fluxos Principais

### 1. Autenticacao

```
Usuario -> Auth.tsx -> supabase.auth.signUp/signIn -> Supabase Auth
                                                          |
                                                    Trigger: create profile
                                                          |
                                                    profiles + user_roles
```

1. Usuario faz login ou cadastro na pagina `/auth`.
2. No cadastro, um trigger do banco cria automaticamente o perfil na tabela `profiles`.
3. O hook `useAuth` mantem o estado de autenticacao, perfil e roles em um Context.
4. Paginas protegidas redirecionam para `/auth` se nao autenticado.

### 2. Ciclo de Vida de uma OS

```
Abertura -> Em manutencao -> Fechada -> Liberado para producao
                               |
                          (ou Nao liberado)
```

1. Tecnico abre OS via Web ou Telegram com dados do equipamento e problema.
2. OS passa por estados: `Aberta` -> `Em manutencao` -> `Fechada` / `Nao liberado` -> `Liberado para producao`.
3. Ao fechar, o tecnico registra diagnostico, solucao e opcionalmente pecas utilizadas.
4. OS fechadas sao automaticamente enfileiradas para indexacao vetorial.

### 3. Assistente IA

```
AIChat.tsx -> Edge Function (assistente-ia) -> Busca contexto (embeddings/textual)
                                                      |
                                                 Lovable AI Gateway
                                                      |
                                                Resposta + fontes
                                                      |
                                              Persiste em ia_conversas/ia_mensagens
```

1. Usuario envia mensagem no chat.
2. Edge Function busca contexto relevante nos manuais e OS indexadas.
3. Se embeddings estiverem habilitados (`USE_EMBEDDINGS=true`), usa busca vetorial; caso contrario, fallback textual.
4. Gera resposta via Lovable AI Gateway com contexto.
5. Persiste conversa e mensagens para historico.

### 4. Indexacao de Documentos

```
Upload de manual -> upload-manual -> Storage + chunks + embeddings
OS fechada -> index-os / process-os-index-queue -> os_embeddings
```

- Manuais sao divididos em chunks e cada chunk recebe um embedding vetorial.
- OS finalizadas sao indexadas com embeddings do texto combinado (problema + solucao).
- A fila de indexacao (`os_index_jobs`) permite processamento assincrono com retentativas.

---

## Deploy

### Frontend

- Hospedado na **Vercel** com configuracao SPA (`vercel.json` com rewrite para `index.html`).
- Build: `npm run build` (Vite).
- Variaveis de ambiente necessarias: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

### Backend

- O script `scripts/setup-supabase.sh` automatiza:
  1. Link do projeto Supabase
  2. Push de migrations
  3. Deploy de todas as Edge Functions
- Secrets necessarios no Supabase Dashboard:
  - `LOVABLE_API_KEY` (para IA)
  - `TELEGRAM_BOT_TOKEN` (para bot Telegram)
  - `ALLOWED_ORIGINS` (lista de origens CORS)
  - `USE_EMBEDDINGS` (habilitar busca vetorial)

---

## Diagrama de Dependencias

```
Pages (rotas)
  |
  +-- hooks (useAuth, useReportStats, etc.)
  |     |
  |     +-- integrations/supabase/client.ts
  |
  +-- components (Dashboard, OSForm, AIChat, etc.)
  |     |
  |     +-- components/ui (shadcn/ui primitivos)
  |     |
  |     +-- hooks
  |
  +-- domain (osService, reportService)
  |     |
  |     +-- integrations/supabase/client.ts
  |
  +-- lib (utils, error-handler, validation-schemas)
```
