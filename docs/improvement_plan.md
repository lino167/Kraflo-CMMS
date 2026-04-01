# Plano de Melhoria: Kraflo Industrial Modernization

A análise do sistema Kraflo revelou uma base sólida com uma identidade visual moderna (Deep Space Dark), mas que apresenta fragmentação na navegação e gargalos de performance que impactam a fluidez percebida. Este plano visa elevar a experiência para um nível "Premium Industrial".

## 1. Experiência de Navegação Unificada
Atualmente, a navegação está dividida entre abas principais (Index.tsx) e links rápidos no cabeçalho (Raio-X, Desempenho). Isso cria uma carga cognitiva sobre onde encontrar cada funcionalidade.

- **Consolidação do Layout:**
  - Implementar um `AppLayout` que envolva todas as páginas.
  - Substituir o cabeçalho flutuante por uma barra lateral (Sidebar) expansível ou um menu de navegação persistente e coeso.
  - Mover "Raio-X", "Biblioteca" e "Meu Desempenho" para o menu principal.
- **Transições de Página:**
  - Adicionar o `framer-motion` para transições suaves entre rotas e troca de abas (AnimatePresence).

## 2. Otimização de Performance e Fluidez
O uso extensivo de esqueletos de carregamento indica que o usuário passa muito tempo esperando dados brutos serem processados no cliente.

- **Arquitetura de Dados (React Query):**
  - Mover as lógicas de cálculo de `Dashboard.tsx` para hooks customizados (`useDashboardStats`, `useEquipmentPerformance`).
  - Implementar **Pre-fetching:** Ao pairar o mouse sobre a aba "Assistente" ou "Relatórios", iniciar o carregamento dos dados necessários.
  - Otimizar as queries do Supabase para buscar apenas colunas necessárias e, sempre que possível, delegar agregações pesadas para o banco via RPC (Remote Procedure Calls).
- **Feedback Visual Aprimorado:**
  - Refinar o `DashboardSkeleton` para incluir animações de shimmer mais sutis e placeholders que correspondam exatamente ao layout final.

## 3. Design System & Polimento Visual
Embora os tokens de cor e glassmorphism estejam presentes, a consistência em "estados vazios" e detalhes de micro-interação podem ser melhorados.

- **Estados Vazios Acionáveis (Empty States):**
  - Padronizar o uso do componente `EmptyState` em todo o sistema.
  - Adicionar CTAs (Call to Actions) claros: "Ainda não há OS. [Criar OS]" ou "Sem manuais. [Fazer Upload]".
- **Micro-interações:**
  - Adicionar efeitos de 'hover' magnéticos ou luzes neon sutis que sigam o cursor em cards importantes.
  - Implementar feedbacks de sucesso/erro mais visuais (Sonner com ícones contextuais).
- **Tipografia Industrial:**
  - Ajustar o kerning e o peso das fontes 'Outfit' e 'JetBrains Mono' para melhorar a legibilidade técnica em densidades de dados altas.

## 4. Centralização da Inteligência Artificial
A IA (Assistente) deve ser menos um destino e mais uma ferramenta contextual.

- **Contextual AI Prompts:**
  - Adicionar botões de "Perguntar à IA" dentro de cards específicos do dashboard (ex: "Analisar por que este equipamento falha tanto").
  - Criar um painel lateral de consulta rápida acessível de qualquer página.

## Próximos Passos Sugeridos
1. **Refatoração do Layout Principal:** Criar o `AppLayout` e integrá-lo com o `App.tsx`.
2. **Migração para Hooks de Dados:** Descentralizar a lógica do Dashboard.
3. **Padronização de Componentes:** Revisar todas as páginas para garantir o uso do sistema de Glassmorphism e EmptyStates.
