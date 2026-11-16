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
| Ordens de Serviço | ✅ abre, edita, fecha e **exclui as que ele criou** | ✅ + reabre e exclui qualquer uma |
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
| `ordens_de_servico` | lê, abre e atualiza (fechar inclusive); exclui **só as que criou** (`criado_por`) | tudo |
| `execucoes_preventivas` | lê e atualiza (iniciar/concluir); não cria nem exclui | tudo |
| `planos_manutencao`, `tarefas_preventivas` | só lê | tudo |
| `categorias_parada`, `categorias_problema`, `subcategorias` | só lê | tudo |
| `maquinas`, `setores`, `links_acesso_convidado`, `templates_checklist`, `orcamentos_manutencao` | só lê | tudo (migration `...120400`) |
| `manuais` | lê | envia, edita, exclui |
| `pecas_estoque`, `movimentacoes_estoque` | lê | tudo |
| `user_roles` | — | só admin Kraflo |

O que o técnico faz no campo (abrir, fechar, enviar pelo Modo Campo, iniciar preventiva) continua funcionando.

## Estado do banco de produção

**Aplicado em 16/11/2026** no projeto Kraflo, nesta ordem, cada uma conferida antes de seguir:

1. `seguranca_funcoes_e_policies` (`20261111120400`): remove as políticas antigas que davam escrita a qualquer membro da empresa em máquinas, setores, links, checklists e orçamentos; funções de consulta passam a respeitar o acesso de quem chama; visitante anônimo perde acesso às funções internas.
2. `fechar_os_idempotencia_por_operacao` (`20261116120000`): fechamento offline reconhece reenvio pelo id da operação.
3. `separacao_admin_tecnico` (`20261116130000`): técnico não exclui OS nem escreve em planos, tarefas e categorias.

Antes de aplicar havia a migration `permissoes_ilimitadas_tecnicos` (maio de 2026), que não está no repositório e deu escrita total a qualquer membro da empresa. As políticas dela foram substituídas.

No banco, as migrations aparecem com o horário em que foram aplicadas (por exemplo `20261116031...`), não com o prefixo dos arquivos do repositório. O conteúdo é o mesmo.

### Teste de comportamento feito depois de aplicar

Um técnico real e um administrador real tentaram cada ação, dentro de uma transação que se desfaz sozinha (nada foi gravado):

| Ação | Técnico | Admin |
|---|---|---|
| Abrir OS | permitido | permitido |
| Atualizar a própria OS | permitido | permitido |
| Fechar OS (`fn_campo_fechar_os`), reenvio da mesma operação e conflito | ok / ok / conflito | |
| Excluir OS | **bloqueado** | permitido |
| Criar plano preventivo | **bloqueado** | permitido |
| Criar categoria de parada | **bloqueado** | permitido |
| Cadastrar máquina | **bloqueado** | permitido |
| Ler ou excluir OS de **outra empresa** | 0 linhas | 0 linhas |

Os gatilhos do banco (histórico, fila de indexação, estoque) continuaram funcionando para o técnico depois da `120400`.

### Como desfazer

`supabase/rollbacks/20261116_desfazer_seguranca_e_separacao_admin_tecnico.sql` recria as políticas e o estado das funções anteriores, na ordem inversa. Não roda sozinho (fica fora de `supabase/migrations`).

### Pendências no painel do Supabase (não dá para fazer pelo código)

- Ativar a **proteção contra senhas vazadas** (Authentication → Policies). Está desligada.
- Configurar as URLs de redirecionamento e o SMTP da recuperação de senha (ver `requisitos.md`, seção 6).
- O relatório de segurança ainda lista funções auxiliares (`has_role`, `is_admin_kraflo`, `is_company_admin`, `get_user_empresa_id`) executáveis sem login. Elas são usadas dentro das políticas e aceitam um id de usuário como parâmetro; restringi-las pede teste cuidadoso, então ficou para depois.

## Exclusão de OS pelo técnico (migration `20261116140000`)

O técnico pode excluir as OS que ele mesmo criou; as dos outros, só a administração.

- O banco passa a guardar o criador em `ordens_de_servico.criado_por` (usuário que abriu a OS). Um gatilho o preenche na abertura **ignorando o que o navegador enviar**, e só a administração pode alterá-lo depois. Assim não dá para "forjar" nem "adotar" a OS de outra pessoa.
- `tecnico_id` não serve para isso: é o responsável, e a administração pode abrir uma OS em nome de um técnico.
- OS abertas pelo bot e as que já existiam não têm criador (`NULL`): só a administração as exclui. Não há preenchimento retroativo, porque seria um palpite.
- A exclusão passa a ser: administração da empresa **ou** o criador, sempre dentro da empresa.
- **Estado: escrita e testada em transação que se desfaz, mas ainda NÃO aplicada em produção.** Até ser aplicada, o técnico não vê "Excluir" em nenhuma OS (a coluna ainda não existe).

Cuidados que a exclusão tem, para quem decidir ampliar ou restringir:
- Excluir apaga também as peças usadas, o histórico e os orçamentos ligados à OS. O **estoque já baixado não volta**.
- Uma OS gerada por um agendamento preventivo **não pode ser excluída** por ninguém: o banco recusa (a ligação com a execução preventiva é `NO ACTION`). A tela avisa o motivo.

## Limites conhecidos

- "Reabrir OS" é restrito só na interface: o banco permite a qualquer membro atualizar uma OS, porque fechar e reabrir são o mesmo `UPDATE`. Fechar essa brecha exige um gatilho que compare o status antigo e o novo.
- Um técnico enxerga as OS de toda a empresa, não só as suas (a leitura é por empresa). Restringir a leitura por técnico é uma decisão de produto.
- Medições (`medicoes_ativos`) e solicitações de manutenção podem ser gravadas por qualquer membro da empresa, de propósito: o técnico registra leituras e atende chamados.
