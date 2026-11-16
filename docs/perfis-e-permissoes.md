# Perfis e permissões

O Kraflo tem três papéis. Quem não tem papel de administrador é **técnico**.

| Papel | Quem é | Escopo |
|---|---|---|
| Técnico | Quem executa o trabalho | A própria empresa, só a área de operação |
| Admin da empresa | Gestor de manutenção | A própria empresa, operação e administração |
| Admin Kraflo | Equipe da Kraflo | Todas as empresas |

Os papéis são cumulativos: admin da empresa faz tudo que o técnico faz, e o admin Kraflo faz tudo.

## Onde cada coisa é definida

- **Interface**: `src/lib/permissoes.ts` é a única fonte da verdade. O menu, o bloqueio de telas e os botões leem dali; mudar quem pode o quê é mudar uma linha.
- **Bloqueio de telas**: `AppLayout` confere o papel a cada troca de rota. Técnico que abre uma tela de administração vê "Acesso não autorizado"; ao abrir o Dashboard (`/`), vai para o Modo Campo.
- **Banco de dados (o que protege de verdade)**: políticas RLS. Esconder um botão não impede ninguém de chamar a API; só o banco impede.

## Telas

| Tela | Técnico | Admin |
|---|---|---|
| **Operação** | | |
| Modo Campo | ✅ | ✅ |
| Ordens de Serviço | ✅ abre, edita, fecha | ✅ + reabre e exclui |
| Biblioteca | ✅ consulta | ✅ + envia, edita, reindexa, exclui manuais |
| Estoque de Peças | ✅ consulta | ✅ + cadastra peças e lança movimentações |
| Assistente IA | ✅ | ✅ + dispara a indexação das OS |
| Raio-X Equipamento | ✅ | ✅ |
| Meu Desempenho | ✅ | ✅ |
| Conta | ✅ (Telegram) | ✅ + código de convite e equipe |
| **Administração** | | |
| Dashboard (e Gestão & Facilities) | ❌ | ✅ |
| Relatórios IA | ❌ | ✅ |
| Gestão de Ativos (máquinas e setores) | ❌ | ✅ |
| Indexação de IA | ❌ | ✅ |

Ao abrir uma OS, o técnico é sempre o responsável; só a administração escolhe outro técnico.
O Raio-X ficou na operação por ser consulta de histórico por equipamento, útil na hora do reparo.

No celular, a barra de baixo do técnico é **Campo · O.S · Nova OS · Desempenho · Mais**; a do administrador é **Início · O.S · Nova OS · Campo · Mais**.

## O que o banco permite (RLS)

Migration: `supabase/migrations/20261116130000_separacao_admin_tecnico.sql`.

| Tabela | Técnico | Admin |
|---|---|---|
| `ordens_de_servico` | lê, abre e atualiza (fechar inclusive); **não exclui** | tudo |
| `execucoes_preventivas` | lê e atualiza (iniciar/concluir); não cria nem exclui | tudo |
| `planos_manutencao`, `tarefas_preventivas` | só lê | tudo |
| `categorias_parada`, `categorias_problema`, `subcategorias` | só lê | tudo |
| `maquinas`, `setores`, `links_acesso_convidado`, `templates_checklist`, `orcamentos_manutencao` | só lê | tudo (migration `...120400`) |
| `manuais` | lê | envia, edita, exclui |
| `pecas_estoque`, `movimentacoes_estoque` | lê | tudo |
| `user_roles` | — | só admin Kraflo |

O que o técnico faz no campo (abrir, fechar, enviar pelo Modo Campo, iniciar preventiva) continua funcionando.

## Estado do banco de produção e ordem de aplicação

Conferido em 16/11/2026 no projeto Kraflo:

- Já aplicadas: `...120000`, `...120100`, `...120200`, `...120300`, `...120500` e `...120600`.
- **Não aplicada: `20261111120400_seguranca_funcoes_e_policies`.** É a que remove as políticas antigas que dão a qualquer membro da empresa escrita em máquinas, setores, links, checklists e orçamentos.
- Existe em produção a migration `permissoes_ilimitadas_tecnicos` (maio de 2026), que **não está no repositório**. Ela deu escrita total a qualquer usuário da empresa em OS, planos, tarefas e execuções preventivas. A nova migration desfaz isso onde a administração precisa de controle.
- Isolamento entre empresas: **ok**. A política `Require authentication for ordens_de_servico` é restritiva (`RESTRICTIVE`), então ninguém vê OS de outra empresa.

Ordem para aplicar: `20261111120400`, depois `20261116120000` (idempotência do fechamento) e `20261116130000` (esta).

### Como conferir depois de aplicar

Como **técnico** (login de teste), estas chamadas devem ser recusadas e as de operação devem funcionar:
- recusar: excluir uma OS, criar um plano preventivo, criar uma máquina, editar uma categoria;
- funcionar: abrir uma OS, fechar uma OS, iniciar uma preventiva, enviar pelo Modo Campo.

Como **admin da empresa**, tudo deve funcionar. Rodar também o relatório de segurança do Supabase (advisors).

## Limites conhecidos

- "Reabrir OS" é restrito só na interface: o banco permite a qualquer membro atualizar uma OS, porque fechar e reabrir são o mesmo `UPDATE`. Fechar essa brecha exige um gatilho que compare o status antigo e o novo.
- Um técnico enxerga as OS de toda a empresa, não só as suas (a leitura é por empresa). Restringir a leitura por técnico é uma decisão de produto.
- Medições (`medicoes_ativos`) e solicitações de manutenção podem ser gravadas por qualquer membro da empresa, de propósito: o técnico registra leituras e atende chamados.
