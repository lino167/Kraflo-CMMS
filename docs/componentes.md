# Componentes - Kraflo CMMS

Documentacao dos principais componentes React do sistema.

---

## Paginas

### `Auth.tsx`

Pagina de autenticacao com login e cadastro.

**Rota:** `/auth`

**Funcionalidades:**
- Login com email e senha (validacao via Zod).
- Cadastro com nome completo, email, senha, funcao, setor, codigo da empresa, ID Telegram e nome da empresa.
- Verificacao de email apos cadastro (`EmailVerificationDialog`).
- Redirecionamento automatico para `/` se ja autenticado.

---

### `Index.tsx`

Pagina principal do sistema. Funciona como hub central com quatro abas.

**Rota:** `/`

**Abas:**

| Aba | Componente | Descricao |
|---|---|---|
| Dashboard | `Dashboard` | Metricas operacionais, MTTR, distribuicao de OS |
| Assistente | `AIChat` | Chat com assistente IA |
| Relatorios | `AIReport` | Relatorios gerados por IA por periodo |
| Manuais | `ManualUpload` | Upload de manuais tecnicos |

**Recursos adicionais:**
- Navegacao rapida para Raio-X, Meu Desempenho e Biblioteca.
- Badge de role (Admin Kraflo / Admin Empresa).
- Menu do usuario com logout.
- Painel de status do sistema (OS indexadas, manuais, chunks).
- Botao para indexar OS pendentes (admin).

---

### `OrdensServico.tsx`

Pagina de gerenciamento de Ordens de Servico.

**Rota:** `/ordens-servico`

**Funcionalidades:**
- Listagem paginada de OS (50 por pagina).
- Filtros: periodo (data), status, prioridade, categoria de parada, causa raiz.
- Busca por texto em equipamento, TAG e descricao.
- Criacao e edicao de OS via `OSForm` (dialog).
- Visualizacao detalhada via `OSViewDialog`.
- Exportacao em PDF da lista filtrada (`OSListPdfExport`).
- Isolamento de dados por `empresa_id` (exceto admin Kraflo).

---

### `Biblioteca.tsx`

Biblioteca de Conhecimento com duas abas: manuais e wiki de reparos.

**Rota:** `/biblioteca`

**Aba Manuais:**
- Tabela de manuais com filtros por tipo, categoria, industria e status de indexacao.
- Busca por nome, fabricante e modelo.
- Acoes: reindexar, deletar.
- Paginacao (10 por pagina).

**Aba Wiki (Historico de Reparos):**
- Lista de OS fechadas como base de conhecimento.
- Busca por equipamento, TAG, problema, diagnostico e notas.
- Filtros por periodo (7 dias, mes, trimestre, customizado).
- Cards expansiveis com problema, solucao e observacoes.

---

### `EquipamentoRaioX.tsx`

Analise mensal de manutencoes com foco em sucesso vs. reincidencia.

**Rota:** `/equipamento`, `/equipamento/:tag`

**Metricas:**
- OS fechadas no mes.
- Casos de sucesso (sem reincidencia).
- Reincidencias.
- Taxa de sucesso.

**Abas:**
- Casos de Sucesso: OS fechadas sem reincidencia.
- Reincidencias: OS fechadas que geraram nova falha.

---

### `PerfilTecnico.tsx`

Dashboard de desempenho individual do tecnico.

**Rota:** `/meu-desempenho`

**Metricas:**
- Performance individual via `TechnicianPerformanceCard`.
- Comparacao de MTTR com a media da equipe.
- Quality Score (baseado em nao-reincidencia).
- Ranking da equipe (top 5 por quality score).
- Posicao individual no ranking.

---

### `IndexacaoAdmin.tsx`

Painel administrativo para gerenciamento de indexacao de OS.

**Rota:** `/admin/indexacao`
**Acesso:** Admin apenas.

---

## Componentes de Dashboard

### `Dashboard.tsx`

Dashboard operacional principal com layout Bento Box.

**Props:**
- `onAskAI(question: string)`: Callback para enviar pergunta ao chat IA.

**Secoes:**
- Metricas resumidas (total OS, abertas, MTTR, etc.).
- Grafico de tendencia MTTR.
- Distribuicao por tipo de servico.
- Tabela de saude de equipamentos.
- Cards de problemas frequentes e analise Pareto.

---

### `DashboardSkeleton.tsx`

Skeleton de carregamento para o Dashboard.

---

### `DateRangeFilter.tsx`

Filtro de periodo com seletor de data.

**Props:**
- `value: DateRange` - Periodo selecionado `{ from: Date, to: Date }`.
- `onChange(range: DateRange)`: Callback de alteracao.

---

## Componentes de OS

### `OSForm.tsx`

Formulario para criacao e edicao de Ordens de Servico (exibido como dialog).

**Props:**
- `open: boolean` - Controle de visibilidade.
- `onClose()`: Callback de fechamento.
- `onSuccess()`: Callback de sucesso (recarregar dados).
- `editingOS?: OS` - OS para edicao (undefined = criacao).

---

### `OSList.tsx`

Lista/tabela de Ordens de Servico.

**Props:**
- `osList: OS[]` - Lista de OS.
- `tecnicos: Tecnico[]` - Lista de tecnicos (para exibir nomes).
- `isLoading: boolean` - Estado de carregamento.
- `onView(os)`: Callback para visualizar OS.
- `onEdit(os)`: Callback para editar OS.
- `onDelete(os)`: Callback para deletar OS.
- `onRefresh()`: Callback para recarregar dados.

---

### `OSViewDialog.tsx`

Dialog para visualizacao detalhada de uma OS.

---

### `OSPdfExport.tsx`

Exportacao individual de OS em PDF (usa jsPDF).

---

### `OSListPdfExport.tsx`

Exportacao em lote da lista de OS em PDF com tabela formatada (usa jsPDF + jspdf-autotable).

---

### `OSCloseDialog.tsx`

Dialog para fechar uma OS com diagnostico, solucao, notas finais e upload de arquivo.

---

## Componentes de IA

### `AIChat.tsx`

Chat interativo com o assistente IA.

**Props:**
- `initialQuestion?: string | null` - Pergunta inicial (vinda do dashboard).
- `onQuestionHandled()`: Callback quando a pergunta inicial foi processada.

**Funcionalidades:**
- Historico de mensagens na conversa.
- Envio de mensagens para a Edge Function `assistente-ia`.
- Exibicao de fontes citadas na resposta.
- Indicador de carregamento durante resposta da IA.

---

### `AIReport.tsx`

Gerador de relatorios via IA.

**Props:**
- `empresaId?: string` - ID da empresa.

**Funcionalidades:**
- Selecao de periodo para o relatorio.
- Chamada para Edge Function `reports-summary`.
- Exibicao de metricas e insights gerados.

---

### `DeepReport.tsx`

Relatorio aprofundado com graficos e analises detalhadas.

---

## Componentes de Graficos/Analytics

### `MTTRLineChart.tsx`

Grafico de linha mostrando evolucao do MTTR ao longo do tempo.

### `TopMachinesChart.tsx`

Grafico das maquinas com mais OS.

### `TrendChart.tsx` / `TrendCharts.tsx`

Graficos de tendencia de metricas operacionais.

### `ServiceTypeBreakdown.tsx`

Distribuicao de OS por tipo de servico.

### `FrequentProblemsCard.tsx`

Card com os problemas mais frequentes.

### `ParetoCrossAnalysisCard.tsx`

Analise Pareto cruzada de categorias e equipamentos.

### `CategoryDistributionCard.tsx`

Distribuicao de OS por categoria.

### `TagProblemsCard.tsx`

Problemas por TAG de equipamento.

### `EquipmentHealthTable.tsx`

Tabela de saude dos equipamentos (MTTR, MTBF, criticidade).

### `EquipmentStatsCards.tsx`

Cards de estatisticas por equipamento.

### `EquipmentTimeline.tsx`

Timeline de eventos de manutencao por equipamento.

### `BenchmarkComparisonCard.tsx`

Comparacao de metricas com benchmarks configurados.

### `TechnicianPerformanceCard.tsx`

Card de desempenho individual do tecnico com quality score e metricas.

### `RecommendationCards.tsx`

Cards de recomendacoes baseadas nos dados.

### `ReincidenciaAlert.tsx`

Alerta de reincidencia de falhas em equipamentos.

---

## Componentes de Upload

### `ManualUpload.tsx`

Componente para upload de manuais tecnicos para a base de conhecimento.

**Funcionalidades:**
- Upload de arquivo para Supabase Storage.
- Preenchimento de metadados (tipo, categoria, fabricante, modelo, tags).
- Envio para Edge Function `upload-manual` para indexacao.

---

## Componentes de Manutencao Preventiva

### `PreventivePlanWizard.tsx`

Wizard (passo a passo) para criacao de planos de manutencao preventiva.

**Funcionalidades:**
- Selecao de equipamento.
- Definicao de periodicidade.
- Criacao de tarefas com checklist.
- Configuracao de intervalos.

---

## Componentes de Layout/UI

### `NavLink.tsx`

Link de navegacao reutilizavel.

### `AccessDenied.tsx`

Componente exibido quando o usuario nao tem permissao para acessar um recurso.

### `EmptyState.tsx`

Estado vazio reutilizavel com icone e mensagem.

### `EmailVerificationDialog.tsx`

Dialog exibido apos cadastro pedindo verificacao de email.

### `IndexingCoverageBanner.tsx`

Banner que exibe a cobertura de indexacao de OS.

---

## Componentes UI (shadcn/ui)

O diretorio `src/components/ui/` contem todos os componentes base do shadcn/ui. Estes sao componentes primitivos acessiveis baseados no Radix UI:

| Componente | Descricao |
|---|---|
| `accordion` | Acordeao expansivel |
| `alert-dialog` | Dialog de alerta/confirmacao |
| `avatar` | Avatar de usuario |
| `badge` | Badge/etiqueta |
| `button` | Botao |
| `calendar` | Calendario (date picker) |
| `card` | Card container |
| `chart` | Wrapper para graficos |
| `checkbox` | Checkbox |
| `command` | Comando (cmdk) |
| `dialog` | Dialog modal |
| `dropdown-menu` | Menu dropdown |
| `form` | Formulario com React Hook Form |
| `input` | Campo de texto |
| `label` | Label de formulario |
| `pagination` | Controles de paginacao |
| `popover` | Popover flutuante |
| `progress` | Barra de progresso |
| `scroll-area` | Area com scroll customizado |
| `select` | Select dropdown |
| `separator` | Separador visual |
| `sheet` | Painel lateral |
| `skeleton` | Placeholder de carregamento |
| `slider` | Slider de valor |
| `sonner` | Sistema de notificacoes toast |
| `switch` | Toggle switch |
| `table` | Tabela |
| `tabs` | Abas |
| `textarea` | Area de texto |
| `toast/toaster` | Sistema de toast (Radix) |
| `tooltip` | Tooltip |

Estes componentes nao devem ser editados diretamente. Para customizar, crie wrappers ou use o sistema de variants do `class-variance-authority`.
