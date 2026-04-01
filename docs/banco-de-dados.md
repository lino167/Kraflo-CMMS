# Banco de Dados - Kraflo CMMS

Documentacao detalhada do schema do banco de dados PostgreSQL gerenciado pelo Supabase.

---

## Modelo Entidade-Relacionamento

```
empresas (1) ──────── (*) profiles
    |                       |
    |                       +── user_roles
    |
    +── (*) tecnicos
    |         |
    |         +── (*) ordens_de_servico
    |         |         |
    |         |         +── (*) pecas_utilizadas
    |         |         +── (1) os_embeddings
    |         |         +── categorias_parada
    |         |         +── categorias_problema
    |         |         +── subcategorias
    |         |
    |         +── (*) ia_conversas
    |         |         +── (*) ia_mensagens
    |         |
    |         +── (*) execucoes_preventivas
    |
    +── (*) manuais
    |         +── (*) manual_chunks
    |
    +── (*) planos_manutencao
    |         +── (*) tarefas_preventivas
    |
    +── (*) categorias_parada
    +── (*) categorias_problema
    +── (*) subcategorias
    +── (1) config_benchmarks
    +── (*) os_index_jobs
```

---

## Tabelas

### `empresas`

Tabela central que representa as empresas cadastradas no sistema. Todas as demais entidades sao vinculadas a uma empresa.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK, gerado automaticamente |
| `nome_empresa` | `text` | Nao | Nome da empresa |
| `created_at` | `timestamptz` | Nao | Data de criacao |

---

### `profiles`

Perfis de usuarios do sistema. Criado automaticamente via trigger quando um usuario se registra no Supabase Auth.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK, referencia `auth.users.id` |
| `empresa_id` | `uuid` | Sim | FK para `empresas` |
| `nome_completo` | `text` | Sim | Nome completo do usuario |
| `email` | `text` | Sim | Email do usuario |
| `funcao` | `text` | Sim | Funcao/cargo (ex: Mecanico) |
| `setor` | `text` | Sim | Setor de atuacao (ex: Tecelagem) |
| `codigo_empresa` | `text` | Sim | Codigo identificador da empresa |
| `nome_empresa` | `text` | Sim | Nome da empresa (denormalizado) |
| `id_telegram` | `int8` | Sim | ID do Telegram do usuario |
| `created_at` | `timestamptz` | Nao | Data de criacao |
| `updated_at` | `timestamptz` | Nao | Ultima atualizacao |

---

### `user_roles`

Papeis atribuidos aos usuarios para controle de acesso.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK |
| `user_id` | `uuid` | Nao | FK para `auth.users` |
| `role` | `app_role` | Nao | Papel: `admin_kraflo` ou `admin_empresa` |
| `created_at` | `timestamptz` | Nao | Data de criacao |

**Papeis disponiveis:**
- `admin_kraflo`: Super admin com acesso a todas as empresas.
- `admin_empresa`: Admin com acesso restrito a sua empresa.
- Usuarios sem papel: acesso basico de tecnico.

---

### `tecnicos`

Tecnicos de manutencao registrados no sistema.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id_telegram` | `int8` | Nao | PK, ID do Telegram |
| `empresa_id` | `uuid` | Nao | FK para `empresas` |
| `nome_completo` | `text` | Nao | Nome do tecnico |
| `funcao` | `text` | Sim | Funcao |
| `setor` | `text` | Sim | Setor |
| `codigo_empresa` | `text` | Sim | Codigo da empresa |
| `created_at` | `timestamptz` | Nao | Data de criacao |

---

### `ordens_de_servico`

Tabela principal do sistema. Armazena todas as Ordens de Servico (OS).

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `int8` | Nao | PK, autoincremento |
| `empresa_id` | `uuid` | Nao | FK para `empresas` |
| `tecnico_id` | `int8` | Nao | FK para `tecnicos.id_telegram` |
| `equipamento_nome` | `text` | Nao | Nome do equipamento |
| `equipamento_tag` | `text` | Sim | TAG identificadora do equipamento |
| `status_os` | `os_status` | Nao | Status atual da OS |
| `prioridade` | `text` | Sim | Prioridade: Baixa, Media, Alta, Urgente |
| `tipo_manutencao` | `text` | Sim | Tipo de manutencao (corretiva, preventiva, etc.) |
| `descricao_problema` | `text` | Sim | Descricao do problema reportado |
| `diagnostico_solucao` | `text` | Sim | Diagnostico e solucao aplicada |
| `notas_finais` | `text` | Sim | Observacoes finais |
| `localizacao` | `text` | Sim | Localizacao do equipamento |
| `origem` | `text` | Sim | Origem da OS (web, telegram, preventiva) |
| `data_abertura` | `timestamptz` | Nao | Data de abertura |
| `data_fechamento` | `timestamptz` | Sim | Data de fechamento |
| `url_foto` | `text` | Sim | URL da foto do problema |
| `url_arquivo_fechamento` | `text` | Sim | URL do arquivo de fechamento |
| `categoria_parada_id` | `uuid` | Sim | FK para `categorias_parada` |
| `subcategoria_parada_id` | `uuid` | Sim | FK para `subcategorias` |
| `categoria_problema_id` | `uuid` | Sim | FK para `categorias_problema` |
| `subcategoria_problema_id` | `uuid` | Sim | FK para `subcategorias` |
| `plano_origem_id` | `uuid` | Sim | FK para `planos_manutencao` (se veio de preventiva) |
| `execucao_origem_id` | `uuid` | Sim | FK para `execucoes_preventivas` |
| `index_status` | `os_index_status` | Sim | Status de indexacao vetorial |
| `index_error` | `text` | Sim | Erro de indexacao (se houver) |
| `last_indexed_at` | `timestamptz` | Sim | Ultima indexacao |
| `embedding_version` | `int4` | Sim | Versao do embedding |
| `created_at` | `timestamptz` | Nao | Data de criacao |
| `updated_at` | `timestamptz` | Nao | Ultima atualizacao |

**Status da OS (`os_status`):**

| Status | Descricao |
|---|---|
| `Aberta` | OS criada, aguardando inicio |
| `Em manutencao` | Tecnico esta trabalhando na OS |
| `Nao liberado` | Manutencao feita, mas equipamento nao liberado |
| `Fechada` | OS finalizada com solucao |
| `Liberado para producao` | Equipamento liberado para operacao |

---

### `pecas_utilizadas`

Pecas consumidas durante o reparo de uma OS.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `int8` | Nao | PK |
| `ordem_id` | `int8` | Nao | FK para `ordens_de_servico` |
| `nome_peca` | `text` | Nao | Nome da peca |
| `quantidade` | `int4` | Nao | Quantidade utilizada |
| `tag_peca` | `text` | Sim | TAG da peca no estoque |
| `created_at` | `timestamptz` | Nao | Data de criacao |

---

### `categorias_parada`

Categorias de motivo de parada de equipamento.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK |
| `empresa_id` | `uuid` | Nao | FK para `empresas` |
| `nome` | `text` | Nao | Nome da categoria |
| `descricao` | `text` | Nao | Descricao |
| `exemplos` | `text[]` | Sim | Lista de exemplos |
| `ordem` | `int4` | Nao | Ordem de exibicao |
| `ativo` | `bool` | Sim | Categoria ativa? |
| `created_at` | `timestamptz` | Sim | Data de criacao |
| `updated_at` | `timestamptz` | Sim | Ultima atualizacao |

---

### `categorias_problema`

Categorias de causa raiz do problema.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK |
| `empresa_id` | `uuid` | Nao | FK para `empresas` |
| `nome` | `text` | Nao | Nome da categoria |
| `descricao` | `text` | Nao | Descricao |
| `exemplos` | `text[]` | Sim | Lista de exemplos |
| `frequencia` | `text` | Sim | Frequencia do problema |
| `ordem` | `int4` | Nao | Ordem de exibicao |
| `ativo` | `bool` | Sim | Categoria ativa? |
| `created_at` | `timestamptz` | Sim | Data de criacao |
| `updated_at` | `timestamptz` | Sim | Ultima atualizacao |

---

### `subcategorias`

Subcategorias vinculadas a categorias de parada ou problema.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK |
| `empresa_id` | `uuid` | Nao | FK para `empresas` |
| `categoria_id` | `uuid` | Nao | FK para a categoria pai |
| `tipo_categoria` | `text` | Nao | Tipo: `parada` ou `problema` |
| `nome` | `text` | Nao | Nome da subcategoria |
| `descricao` | `text` | Nao | Descricao |
| `exemplos` | `text[]` | Sim | Lista de exemplos |
| `ordem` | `int4` | Nao | Ordem de exibicao |
| `ativo` | `bool` | Sim | Subcategoria ativa? |
| `created_at` | `timestamptz` | Sim | Data de criacao |
| `updated_at` | `timestamptz` | Sim | Ultima atualizacao |

---

### `manuais`

Metadados de manuais tecnicos enviados para a base de conhecimento.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK |
| `empresa_id` | `uuid` | Sim | FK para `empresas` |
| `nome_arquivo` | `text` | Nao | Nome do arquivo |
| `url_arquivo` | `text` | Nao | URL no Supabase Storage |
| `manual_type` | `manual_type` | Nao | Tipo: `general` ou `equipment` |
| `category` | `manual_category` | Sim | Categoria tecnica |
| `industry` | `text` | Sim | Industria |
| `fabricante` | `text` | Sim | Fabricante do equipamento |
| `modelo` | `text` | Sim | Modelo do equipamento |
| `equipamento_tipo` | `text` | Sim | Tipo de equipamento |
| `equipamento_id` | `text` | Sim | ID do equipamento |
| `tags` | `text[]` | Sim | Tags para busca |
| `is_public` | `bool` | Nao | Manual publico? |
| `processado` | `bool` | Sim | Manual ja indexado? |
| `total_paginas` | `int4` | Sim | Total de paginas |
| `created_at` | `timestamptz` | Sim | Data de criacao |

---

### `manual_chunks`

Chunks de texto extraidos dos manuais para busca vetorial.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK |
| `manual_id` | `uuid` | Nao | FK para `manuais` |
| `conteudo` | `text` | Nao | Conteudo do chunk |
| `pagina` | `int4` | Sim | Numero da pagina de origem |
| `embedding` | `vector` | Sim | Embedding vetorial (768 dimensoes) |
| `created_at` | `timestamptz` | Sim | Data de criacao |

---

### `os_embeddings`

Embeddings vetoriais de Ordens de Servico finalizadas.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK |
| `ordem_id` | `int8` | Nao | FK para `ordens_de_servico` (unico) |
| `empresa_id` | `uuid` | Sim | FK para `empresas` |
| `texto_indexado` | `text` | Nao | Texto combinado usado para gerar o embedding |
| `embedding` | `vector` | Sim | Embedding vetorial (768 dimensoes) |
| `embedding_version` | `int4` | Sim | Versao do modelo de embedding |
| `created_at` | `timestamptz` | Sim | Data de criacao |

---

### `os_index_jobs`

Fila de jobs para indexacao assincrona de OS.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK |
| `os_id` | `int8` | Nao | ID da OS a indexar |
| `empresa_id` | `uuid` | Nao | FK para `empresas` |
| `status` | `text` | Nao | Status do job (pending, processing, done, error) |
| `attempts` | `int4` | Nao | Numero de tentativas |
| `last_error` | `text` | Sim | Ultimo erro |
| `next_run_at` | `timestamptz` | Nao | Proxima execucao |
| `embedding_version` | `int4` | Nao | Versao do embedding |
| `created_at` | `timestamptz` | Nao | Data de criacao |
| `updated_at` | `timestamptz` | Nao | Ultima atualizacao |

---

### `ia_conversas`

Conversas com o assistente IA.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK |
| `empresa_id` | `uuid` | Nao | FK para `empresas` |
| `tecnico_id` | `int8` | Sim | FK para `tecnicos.id_telegram` |
| `created_at` | `timestamptz` | Sim | Data de criacao |

---

### `ia_mensagens`

Mensagens individuais dentro de uma conversa IA.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK |
| `conversa_id` | `uuid` | Nao | FK para `ia_conversas` |
| `role` | `text` | Nao | Papel: `user` ou `assistant` |
| `content` | `text` | Nao | Conteudo da mensagem |
| `fontes` | `jsonb` | Sim | Fontes citadas na resposta |
| `created_at` | `timestamptz` | Sim | Data de criacao |

---

### `planos_manutencao`

Planos de manutencao preventiva.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK |
| `empresa_id` | `uuid` | Nao | FK para `empresas` |
| `titulo` | `text` | Nao | Titulo do plano |
| `objetivo` | `text` | Sim | Objetivo do plano |
| `equipamento_nome` | `text` | Sim | Nome do equipamento |
| `equipamento_tag` | `text` | Sim | TAG do equipamento |
| `fabricante` | `text` | Sim | Fabricante |
| `modelo` | `text` | Sim | Modelo |
| `periodicidade` | `periodicidade_manutencao` | Nao | Frequencia (diaria a anual) |
| `ativo` | `bool` | Nao | Plano ativo? |
| `created_by` | `uuid` | Sim | Usuario que criou |
| `created_at` | `timestamptz` | Nao | Data de criacao |
| `updated_at` | `timestamptz` | Nao | Ultima atualizacao |

---

### `tarefas_preventivas`

Tarefas dentro de um plano de manutencao preventiva.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK |
| `plano_id` | `uuid` | Nao | FK para `planos_manutencao` |
| `titulo` | `text` | Nao | Titulo da tarefa |
| `descricao` | `text` | Sim | Descricao detalhada |
| `intervalo_dias` | `int4` | Nao | Intervalo em dias entre execucoes |
| `tempo_estimado_minutos` | `int4` | Sim | Tempo estimado de execucao |
| `checklist` | `jsonb` | Sim | Checklist de verificacao |
| `tags` | `text[]` | Sim | Tags |
| `ordem` | `int4` | Sim | Ordem de exibicao |
| `ativo` | `bool` | Nao | Tarefa ativa? |
| `created_at` | `timestamptz` | Nao | Data de criacao |
| `updated_at` | `timestamptz` | Nao | Ultima atualizacao |

---

### `execucoes_preventivas`

Registros de execucao de tarefas preventivas.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK |
| `tarefa_id` | `uuid` | Nao | FK para `tarefas_preventivas` |
| `empresa_id` | `uuid` | Nao | FK para `empresas` |
| `tecnico_id` | `int8` | Sim | FK para `tecnicos.id_telegram` |
| `status` | `execucao_status` | Nao | Status da execucao |
| `agendado_para` | `timestamptz` | Nao | Data agendada |
| `executado_em` | `timestamptz` | Sim | Data de execucao real |
| `checklist_resultado` | `jsonb` | Sim | Resultados do checklist |
| `notas` | `text` | Sim | Notas da execucao |
| `os_gerada_id` | `int8` | Sim | FK para OS gerada (se houve) |
| `created_at` | `timestamptz` | Nao | Data de criacao |
| `updated_at` | `timestamptz` | Nao | Ultima atualizacao |

---

### `config_benchmarks`

Configuracao de benchmarks por empresa.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id` | `uuid` | Nao | PK |
| `empresa_id` | `uuid` | Nao | FK para `empresas` (unico) |
| `mttr_alvo_horas` | `float8` | Sim | MTTR alvo em horas |
| `mtbf_alvo_dias` | `float8` | Sim | MTBF alvo em dias |
| `taxa_resolucao_alvo` | `float8` | Sim | Taxa de resolucao alvo (%) |
| `peso_mttr` | `float8` | Sim | Peso do MTTR no score |
| `peso_falhas` | `float8` | Sim | Peso das falhas no score |
| `peso_reincidencia` | `float8` | Sim | Peso da reincidencia no score |
| `created_at` | `timestamptz` | Nao | Data de criacao |
| `updated_at` | `timestamptz` | Nao | Ultima atualizacao |

---

### `bot_user_states`

Estado dos usuarios interagindo com o bot Telegram.

| Coluna | Tipo | Nullable | Descricao |
|---|---|---|---|
| `id_telegram` | `int8` | Nao | PK, ID do usuario no Telegram |
| `state` | `text` | Nao | Estado atual da interacao |
| `data` | `jsonb` | Sim | Dados temporarios do estado |
| `updated_at` | `timestamptz` | Sim | Ultima atualizacao |

---

## Views

### `v_equipment_health`

Calcula metricas de saude por equipamento.

| Coluna | Descricao |
|---|---|
| `equipamento_nome` | Nome do equipamento |
| `equipamento_tag` | TAG do equipamento |
| `empresa_id` | Empresa |
| `setor` | Setor |
| `total_falhas` | Total de falhas registradas |
| `falhas_30d` | Falhas nos ultimos 30 dias |
| `falhas_resolvidas` | Falhas resolvidas |
| `mttr_hours` | MTTR em horas |
| `mtbf_days` | MTBF em dias |
| `reincidencia_30d` | Reincidencias nos ultimos 30 dias |
| `score_criticidade` | Score de criticidade calculado |
| `ultima_falha` | Data da ultima falha |
| `tipos_servico` | Tipos de servico realizados |

### `v_os_analytics`

Dados analiticos de OS para dashboards e relatorios.

| Coluna | Descricao |
|---|---|
| `os_id` | ID da OS |
| `empresa_id` | Empresa |
| `equipamento_nome/tag` | Dados do equipamento |
| `status_os` | Status atual |
| `tipo_servico` | Tipo de manutencao |
| `prioridade` | Prioridade |
| `opened_at` / `closed_at` | Datas |
| `repair_hours` | Horas de reparo (MTTR) |
| `tecnico_id` / `setor` | Dados do tecnico |
| `index_status` | Status de indexacao |

### `v_technician_performance`

Metricas de desempenho dos tecnicos.

### `v_tag_timeline`

Timeline de eventos por tag de equipamento.

---

## Migrations

As migrations estao em `supabase/migrations/` e sao aplicadas na ordem cronologica (prefixo timestamp). Para aplicar todas as migrations em um projeto Supabase:

```bash
supabase db push
```

Para gerar os tipos TypeScript a partir do schema atual:

```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```
