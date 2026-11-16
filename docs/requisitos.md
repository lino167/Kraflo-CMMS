# Requisitos do Kraflo CMMS

Levantamento feito em novembro de 2026 a partir do código (cada página lida e as telas conferidas no navegador).
Serve para três coisas: saber o que o sistema faz hoje, ter requisitos claros para testar e decidir o que manter, cortar ou criar.

Convenções: **RF** = requisito funcional, **RNF** = requisito não funcional.
Situação: ✅ implementado · 🟡 parcial · 🆕 criado nesta revisão · 🗑️ removido nesta revisão · 💡 recomendado (não feito).

---

## 1. Perfis de usuário

| Perfil | Quem é | Acesso |
|---|---|---|
| Admin Kraflo | Equipe da Kraflo | Todas as empresas; indexação e papéis |
| Admin da empresa | Gestor de manutenção | A própria empresa, **operação e administração**: dashboards, ativos, equipe, estoque, indexação |
| Técnico | Quem executa as OS | Só a **operação**: abre, edita e fecha OS; Modo Campo; consulta de manuais, estoque e histórico; desempenho |

As telas e permissões de cada perfil estão em [`perfis-e-permissoes.md`](perfis-e-permissoes.md).
| Solicitante externo | Operador/cliente sem conta | Só o portal de solicitação, por link/QR |

---

## 2. Mapa de páginas

| Rota | Página | Perfil | Finalidade |
|---|---|---|---|
| `/auth` | Login e cadastro | Público | Entrar, criar conta por código de convite ou criar empresa nova |
| `/` | Dashboard | Logado | Indicadores e análises (4 abas) |
| `/assistente` | Assistente IA | Logado | Perguntas em linguagem natural sobre OS e manuais |
| `/relatorios` | Relatórios IA | Logado | Relatório de recomendações e plano preventivo |
| `/ordens-servico` | Ordens de Serviço | Logado | Ciclo completo da OS, preventivas e solicitações |
| `/campo` | Modo Campo (PWA) | Técnico | Abrir e fechar OS, inclusive offline |
| `/biblioteca` | Biblioteca | Logado | Manuais técnicos e histórico de soluções (wiki) |
| `/configuracoes` | Gestão de Ativos | Logado | Máquinas e setores |
| `/estoque` | Estoque de Peças | Logado (gestão: admin) | Saldo, entradas, saídas, ponto de reposição |
| `/equipamento[/:tag]` | Raio-X do Equipamento | Logado | Casos de sucesso e problemáticos por equipamento |
| `/meu-desempenho` | Meu Desempenho | Técnico | Qualidade, MTTR e ranking |
| `/conta` | Conta e Equipe | Logado (convite: admin) | Código de convite, equipe, vínculo do Telegram |
| `/admin/indexacao` | Indexação | Admin | Fila e reprocessamento da busca por IA |
| `/solicitar/:token` | Portal de solicitação | Público | Abrir um chamado sem conta |
| `*` | Não encontrada | Todos | Página 404 |

Sem página: o bot do Telegram (`telegram-webhook`), que será aposentado em favor do Modo Campo.

---

## 3. Requisitos funcionais por página

### 3.1 Autenticação (`/auth`)
- **RF-AUT-01** ✅ Entrar com e-mail e senha.
- **RF-AUT-02** ✅ Criar conta informando um código de convite (entra na empresa como técnico).
- **RF-AUT-03** ✅ Criar conta com empresa nova (quem cria vira admin da empresa).
- **RF-AUT-04** ✅ Código de convite inválido é recusado sem revelar dados da empresa.
- **RF-AUT-05** 🆕 **Recuperação de senha**: "Esqueci minha senha" no login envia um link por e-mail; o link abre `/redefinir-senha`, onde se cria a nova senha e já se entra no sistema. Antes não existia: quem esquecia a senha ficava sem acesso.
  - A resposta é a mesma exista ou não uma conta com o e-mail (não revela quem é cliente) e o reenvio espera 60 s.
  - Ao salvar, os outros aparelhos conectados são desconectados.
  - Link expirado, usado ou aberto sem o e-mail mostra "Link inválido ou expirado" com botão para pedir outro.
  - **Configuração obrigatória no Supabase** (ver 6).

### 3.2 Dashboard (`/`)
- **RF-DSH-01** ✅ Filtro de período (3, 7, 15, 30 dias, semana, mês e intervalo livre) valendo para todas as abas.
- **RF-DSH-02** ✅ **Visão Operacional**: OS abertas, fechadas hoje, urgentes, MTTR, tempo na fila, atrasadas, novas quebras e consertos entregues (com variação em 7 dias), mais gráficos de evolução e MTTR por dia.
- **RF-DSH-03** ✅ **Equipamentos**: taxa de resolução, OS reincidentes, máquinas com mais OS, problemas frequentes, análise de Pareto (parada × causa raiz) e equipamentos críticos por MTBF.
- **RF-DSH-04** ✅ **Gestão & Facilities**: ver 3.3.
- **RF-DSH-05** ✅ **Análises & Histórico**: distribuição por categoria, por tipo de manutenção e histórico recente.
- **RF-DSH-06** 🆕 Cartões arrastáveis nas abas Operacional, Equipamentos e Análises; a ordem fica guardada no aparelho e há "Restaurar layout".
- **RF-DSH-07** ✅ Um problema frequente pode ser enviado como pergunta ao Assistente IA.

### 3.3 Gestão & Facilities (aba do Dashboard)
- **RF-FAC-01** 🆕 **SLA real**: percentual dentro da meta, tempo médio de resolução e OS abertas fora do prazo, por prioridade (Urgente 2 h, Alta 6 h, Média e Baixa 24 h), calculados das OS reais (só corretivas e preditivas).
- **RF-FAC-02** 🗑️ Os números de SLA que estavam escritos no código ("54 min", "96,4% OK", "3h 12m", etc.) foram removidos: não vinham de dados.
- **RF-FAC-03** ✅ Calendário mensal das OS (preventivas e corretivas) com lista do dia selecionado; o nome do mês agora acompanha a data (estava fixo em "Maio").
- **RF-FAC-04** ✅ Orçamentos de manutenção: cadastrar fornecedor, serviço e valor, e aprovar ou recusar.
- **RF-FAC-05** ✅ Checklists por categoria, com itens editáveis salvos por empresa.
- **RF-FAC-06** ✅ Solicitações recebidas pelo portal: verificar (gera OS) ou recusar.
- **RF-FAC-07** ✅ Medições de condição dos ativos (temperatura, vibração, etc.) com limites mínimo e máximo e alertas.
- **RF-FAC-08** ✅ Acesso de convidados: gerar link e QR code do portal de solicitação.
- **RF-FAC-09** 🗑️ Sub-aba "Relatórios Clientes" removida: os botões "Ver Parecer" e "Compartilhar" só exibiam uma mensagem de sucesso e não enviavam nada. A ficha em PDF da OS continua na lista de OS.
- **RF-FAC-10** 🗑️ Botão "Registrar Preventiva" do calendário removido (só mostrava um aviso).

### 3.4 Assistente IA (`/assistente`)
- **RF-ASS-01** ✅ Conversa em linguagem natural com busca nas OS fechadas e nos manuais indexados.
- **RF-ASS-02** ✅ Mostra quantas OS estão indexadas e permite indexar as pendentes.
- **RF-ASS-03** 🗑️ Duas contagens (manuais e trechos) eram buscadas e nunca exibidas; removidas.
- **RF-ASS-04** 💡 Unificar a indexação: hoje há o botão aqui, a página de Indexação, o reprocessamento por manual e a fila automática.

### 3.5 Relatórios IA (`/relatorios`)
- **RF-REL-01** ✅ Gera relatório de recomendações com base no histórico (função `reports-summary`).
- **RF-REL-02** ✅ Criar plano preventivo a partir de um equipamento ou recomendação (gera plano, tarefas e agendamentos).
- **RF-REL-03** ✅ Exportar o relatório em PDF.
- **RF-REL-04** 🗑️ Botões "Criar OS preventiva" removidos: avisavam "em desenvolvimento" e não faziam nada. O caminho real é "Criar plano".

### 3.6 Ordens de Serviço (`/ordens-servico`)
- **RF-OS-01** ✅ Abrir OS: equipamento, TAG, local, técnico, tipo, prioridade, motivo de parada (obrigatório), descrição e foto. Alerta de reincidência ao informar a TAG.
- **RF-OS-02** ✅ Editar, fechar (causa raiz, diagnóstico, notas finais, peças e foto), reabrir e excluir OS.
- **RF-OS-03** ✅ Quatro visões: lista, kanban, calendário e linha do tempo.
- **RF-OS-04** ✅ Filtros: período, busca, status, prioridade, motivo de parada e causa raiz.
- **RF-OS-05** ✅ Exportar a ficha da OS e a lista em PDF.
- **RF-OS-06** ✅ Preventivas pendentes: iniciar uma OS a partir de um agendamento.
- **RF-OS-07** ✅ Solicitações: converter um chamado do portal em OS.
- **RF-OS-08** 🗑️ Selo "FORMATO AUDITÁVEL REGIONAL SE REG-9001", botão "Validar Trilha" e textos citando ISO 9001 removidos: sugeriam uma conformidade que o sistema não valida. A visão ficou como linha do tempo das OS.
- **RF-OS-09** 💡 Exigir confirmação e registro de quem excluiu uma OS (hoje a exclusão é definitiva).
- **RF-OS-10** 🆕 O técnico exclui as OS que ele mesmo criou; a administração exclui qualquer uma (migration `20261116140000`, ainda a aplicar). Ver `perfis-e-permissoes.md`.

### 3.7 Modo Campo (`/campo`)
- **RF-CAM-01** ✅ Instalável como app; abre sem internet depois da primeira visita.
- **RF-CAM-02** ✅ Abrir OS offline: máquina da lista ou digitada, TAG obrigatória, motivo de parada, tipo, prioridade, local, descrição e foto.
- **RF-CAM-03** ✅ Fechar OS offline: causa raiz, diagnóstico, status final, peças (do estoque do aparelho ou avulsas), notas finais obrigatórias e foto.
- **RF-CAM-04** ✅ Fila de envio automática, sem duplicar OS; conflitos e erros ficam para revisão (reenviar ou descartar).
- **RF-CAM-05** ✅ PIN de 6 dígitos ou mais protege os dados guardados; 5 erros apagam os dados offline.
- **RF-CAM-06** ✅ Alerta de reincidência quando há conexão.
- **RF-CAM-07** ✅ Aviso antes de sair da conta se houver lançamentos não enviados.
- **RF-CAM-08** 🆕 Modo sol (tema claro de alto contraste) e alvos de toque de 48 px.
- **RF-CAM-09** 🆕 Aviso para instalar o app na tela inicial (um toque no Android; passos do Safari no iPhone) e ícones PNG para Android e iPhone.
- **RF-CAM-10** 🆕 Guia do técnico para imprimir (`/guia-do-tecnico`), com o QR code do convite quando aberto por um administrador.

### 3.8 Biblioteca (`/biblioteca`)
- **RF-BIB-01** ✅ Enviar manuais (PDF), com tipo, categoria, segmento, fabricante e modelo.
- **RF-BIB-02** ✅ Listar com busca e filtros (tipo, categoria, segmento, situação da indexação) e paginação.
- **RF-BIB-03** ✅ Editar dados, reindexar e excluir um manual.
- **RF-BIB-04** ✅ Wiki: pesquisar o histórico de soluções das OS fechadas, com filtro por período.
- **RF-BIB-05** 💡 Mostrar o número de manuais públicos (compartilhados) separado dos da empresa.

### 3.9 Gestão de Ativos (`/configuracoes`)
- **RF-ATV-01** ✅ Cadastrar, editar e excluir máquinas (TAG, nome, setor, criticidade A/B/C, fabricante, modelo).
- **RF-ATV-02** ✅ Cadastrar, editar e excluir setores.
- **RF-ATV-03** ✅ Mostrar o QR code do portal de solicitação, usando o link ativo da empresa (a criação e a revogação do link ficam em Gestão & Facilities).
- **RF-ATV-04** 💡 Bloquear a exclusão de máquina ou setor que tenha OS ligadas (ou avisar o impacto).

### 3.10 Estoque de Peças (`/estoque`)
- **RF-EST-01** ✅ Cadastrar e editar peças (nome, código, unidade, estoque mínimo, saldo inicial, local, fornecedor).
- **RF-EST-02** ✅ Movimentar: entrada, saída e ajuste de inventário, com observação.
- **RF-EST-03** ✅ Histórico de movimentações por peça.
- **RF-EST-04** ✅ Indicadores: total de itens, valor em estoque e itens críticos (abaixo do mínimo); filtro "só críticos".
- **RF-EST-05** ✅ Baixa automática ao fechar uma OS com peça do estoque.
- **RF-EST-06** ✅ Só admin da empresa ou da Kraflo gerencia; os demais consultam.

### 3.11 Raio-X do Equipamento (`/equipamento`)
- **RF-RAI-01** ✅ Estatísticas do mês (casos fechados, casos de sucesso, problemáticos e taxa de sucesso).
- **RF-RAI-02** ✅ Lista de casos de sucesso e de casos problemáticos, com abertura do detalhe por TAG.
- **RF-RAI-03** 💡 Sobrepõe-se à aba Equipamentos do Dashboard; manter as duas só se o Raio-X ganhar histórico por máquina.

### 3.12 Meu Desempenho (`/meu-desempenho`)
- **RF-DES-01** ✅ Quality score (OS sem reincidência em 5 dias), OS fechadas, MTTR médio e OS heroicas.
- **RF-DES-02** ✅ MTTR por tipo contra a média da equipe.
- **RF-DES-03** ✅ Ranking ("Elite da Equipe").
- **RF-DES-04** 🆕 Corrigido: contas criadas por convite viam o desempenho da empresa inteira (usava `id_telegram` em vez de `tecnico_id`).

### 3.13 Conta e Equipe (`/conta`)
- **RF-CON-01** ✅ Admin vê e troca o código de convite (o anterior deixa de valer).
- **RF-CON-02** ✅ Lista da equipe.
- **RF-CON-03** ✅ Vincular e desvincular o Telegram por código.
- **RF-CON-04** 💡 Remover o cartão do Telegram quando o bot for desligado.
- **RF-CON-05** 💡 Permitir ao admin remover ou desativar um membro da equipe.

### 3.14 Indexação (`/admin/indexacao`)
- **RF-IDX-01** ✅ Contadores (total, indexadas, pendentes, falhas) e tabela de jobs com filtro por situação.
- **RF-IDX-02** ✅ Indexar pendentes, reindexar tudo e reprocessar uma OS.
- **RF-IDX-03** ✅ Acesso só para admin.

### 3.15 Portal de solicitação (`/solicitar/:token`)
- **RF-POR-01** ✅ Qualquer pessoa com o link/QR envia um chamado (equipamento, urgência, local, nome e contato opcional) sem criar conta.
- **RF-POR-02** ✅ Link inválido ou desativado mostra mensagem clara.
- **RF-POR-03** ✅ Limite de envios por hora no servidor para evitar abuso.

### 3.16 Bot do Telegram (fora das páginas)
- **RF-BOT-01** ✅ Abrir e fechar OS, listar, editar, excluir, consultar peças e relatórios. Como será aposentado, não recebeu o alinhamento de regras com a web (notas finais obrigatórias, categorias do banco, alerta de reincidência): isso só existe no Modo Campo e na web.
- **RF-BOT-02** 💡 **Aposentar**: o Modo Campo cobre abrir e fechar OS com mais segurança (PIN, offline, fila). Desligar o webhook, apagar a função e o cartão do Telegram em Conta.

---

## 4. Requisitos não funcionais

### 4.1 Segurança
- **RNF-SEG-01** ✅ Isolamento por empresa no banco: 24 de 25 tabelas criadas nas migrations têm RLS ligado. Verificar a tabela restante. Conferido no banco de produção: ninguém lê OS de outra empresa.
- **RNF-SEG-08** 🆕 **Separação admin × técnico**: menu e telas por papel (`lib/permissoes.ts`) e escrita administrativa restrita no banco (migration `20261116130000`). Técnico não exclui OS, não cria planos, máquinas nem categorias. **Aplicado em produção em 16/11/2026** (junto com a `20261111120400` e a de idempotência do fechamento) e testado com um técnico e um administrador reais; ver `perfis-e-permissoes.md`.
- **RNF-SEG-02** ✅ Cadastro não confia em dados enviados pelo navegador (empresa vem do código de convite).
- **RNF-SEG-03** ✅ Modo Campo cifra os dados no aparelho (AES-GCM, chave derivada do PIN) e apaga após 5 erros; acesso offline vale 7 dias.
- **RNF-SEG-04** ✅ Fechamento de OS em uma transação (peças e fechamento juntos), com identificador da operação para não confundir reenvios.
- **RNF-SEG-05** ✅ Funções com `verify_jwt` ligado, exceto o webhook do Telegram e o healthcheck.
- **RNF-SEG-06** 💡 Revisar o CORS padrão das funções (`*` quando `ALLOWED_ORIGINS` não está definido).
- **RNF-SEG-07** 💡 Registrar quem excluiu OS, máquinas e peças (auditoria de exclusão).

### 4.2 Disponibilidade e offline
- **RNF-DIS-01** ✅ Modo Campo funciona sem internet; envia sozinho ao reconectar (ao voltar, ao trazer o app para a frente e a cada 30 s).
- **RNF-DIS-02** 🟡 Sem envio em segundo plano: a fila só sai com o app aberto.
- **RNF-DIS-03** 🟡 `data_abertura` offline usa o relógio do aparelho.
- **RNF-DIS-04** ✅ O service worker nunca guarda chamadas ao banco; só a casca do app e arquivos estáticos.

### 4.3 Desempenho
- **RNF-PER-01** 🟡 O pacote principal tem cerca de 830 kB (e há um pedaço de 400 kB). Meta: menos de 500 kB no carregamento inicial, com divisão por rota e carregamento sob demanda das bibliotecas de PDF e gráficos.
- **RNF-PER-02** ✅ As páginas são carregadas sob demanda (`import()` por rota).
- **RNF-PER-03** 🟡 Listas grandes de OS carregam de uma vez; meta: paginação no servidor acima de 200 registros.

### 4.4 Usabilidade
- **RNF-USO-01** 🆕 Visual único (Estilo Linear, ver `DESIGN.md`): um destaque laranja por tela, fio de 1 px no lugar de sombra, títulos em Inter.
- **RNF-USO-02** 🆕 `/campo` com alvos de toque de 48 px e texto de 16 px nos campos; modo sol para luz forte.
- **RNF-USO-03** ✅ Mobile primeiro na navegação (barra inferior) e telas responsivas.
- **RNF-USO-04** 🟡 Textos e mensagens em português do Brasil; datas no formato `dd/mm/aaaa`.

### 4.5 Acessibilidade
- **RNF-ACE-01** 🆕 Idioma do documento corrigido para `pt-BR` (estava `en`).
- **RNF-ACE-02** 🟡 Só 36 rótulos `aria-label` e 7 textos `alt` no sistema inteiro. Meta: todo botão só com ícone com nome acessível; revisar contraste do texto suave.
- **RNF-ACE-03** ✅ Os cartões arrastáveis têm alternativa pelo teclado (Alt + setas) e respeitam "reduzir movimento".

### 4.6 Compatibilidade
- **RNF-COM-01** ✅ Navegadores atuais (Chrome, Safari, Edge, Firefox) em computador e celular; instalação como PWA em Android e iOS.
- **RNF-COM-02** 💡 Testar em aparelho real: iPhone com PWA instalado (armazenamento pode ser limpo pelo sistema), Android básico e sob luz forte.

### 4.7 Manutenibilidade e qualidade
- **RNF-MAN-01** ✅ CI em cada PR: checagem de tipos, testes e build.
- **RNF-MAN-02** 🟡 48 testes unitários cobrindo regras (offline, PIN, fila, relatórios, SLA). Faltam testes das telas e dos fluxos de abrir e fechar OS.
- **RNF-MAN-03** 🟡 22 avisos de lint (`any`) herdados; meta: zero, e passar a exigir lint no CI.
- **RNF-MAN-04** 🆕 Código sem uso removido (8 arquivos, cerca de 1.360 linhas).
- **RNF-MAN-05** 🟡 Componentes muito grandes (Biblioteca 1.075 linhas, Planejamento 1.561, Dashboard e OSList acima de 770). Meta: dividir por responsabilidade quando forem mexidos.

### 4.8 Observabilidade e dados
- **RNF-OBS-01** 🟡 Há função `health`, mas sem alerta nem painel de erros em produção. Meta: registrar erros do navegador e das funções em um serviço.
- **RNF-OBS-02** 💡 Backup e restauração do banco documentados e testados.
- **RNF-OBS-03** 💡 Política de retenção e exportação de dados do cliente (LGPD).

---

## 5. Decisões desta revisão

### Removido (fingia funcionar ou não tinha uso)
| O quê | Motivo |
|---|---|
| Números de SLA escritos no código | Pareciam medições reais e não vinham de dados |
| Sub-aba "Relatórios Clientes" (Ver Parecer / Compartilhar) | Mostrava "enviado ao cliente" sem enviar nada |
| Selo "REG-9001", botão "Validar Trilha", menções a ISO 9001 | Sugeriam conformidade que ninguém valida |
| "Registrar Preventiva" no calendário | Só exibia um aviso |
| "Criar OS preventiva" nos relatórios de IA | Avisava "em desenvolvimento" |
| 8 arquivos sem uso (`DeepReport` e dependentes) | Código morto de cerca de 1.360 linhas |
| 2 consultas do Assistente nunca exibidas | Custo sem uso |

### Criado
| O quê | Motivo |
|---|---|
| Recuperação de senha (`/redefinir-senha`) | Quem esquecia a senha ficava sem acesso |
| SLA calculado das OS reais, por prioridade | Substitui o inventado por um número que o gestor pode usar |
| Cartões arrastáveis no Dashboard | Cada gestor organiza o painel do seu jeito |
| Modo sol e alvos de 48 px no `/campo` | Uso em fábrica |

### Recomendado (decisão sua, não executei)
1. **Aposentar o bot do Telegram** e o cartão de vínculo em Conta (RF-BOT-02).
2. **Unificar a indexação** em um só lugar (a página de Indexação) e deixar o resto automático.
3. **Raio-X × aba Equipamentos**: manter um só ou dar ao Raio-X um histórico por máquina.
4. **Acessibilidade** (RNF-ACE-02) e **tamanho do pacote** (RNF-PER-01).
5. **Auditoria de exclusões** e **remoção de membro da equipe** (RF-OS-09, RF-CON-05, RNF-SEG-07).
6. **Aba Gestão & Facilities**: orçamentos, checklists, medições e acesso de convidados são funcionalidades de manutenção de facilities que cabem em uma área própria; avaliar se o cliente usa antes de investir.

---

## 6. Configuração necessária para a recuperação de senha

O código está pronto, mas o e-mail só chega e o link só funciona depois destes ajustes no painel do Supabase (não dá para fazê-los pelo código):

1. **Authentication → URL Configuration → Redirect URLs**: adicionar
   - `https://kraflo.vercel.app/redefinir-senha`
   - para testar nos previews da Vercel, um endereço com curinga, por exemplo `https://kraflo-git-*-lino167s-projects.vercel.app/redefinir-senha`
   - para desenvolvimento local, `http://localhost:8080/redefinir-senha` (ajustar a porta)

   Sem isso, o link do e-mail cai na página inicial em vez de `/redefinir-senha`.
2. **Authentication → Emails → Reset Password**: conferir que o modelo contém `{{ .ConfirmationURL }}` e, de preferência, traduzir o texto para português.
3. **Authentication → SMTP Settings**: configurar um provedor de e-mail próprio para produção. O envio padrão do Supabase tem limite baixo de mensagens por hora e serve só para testes.
4. Testar uma vez de ponta a ponta com um e-mail real: pedir o link, abrir e trocar a senha.

Regra de senha atual: de 6 a 72 caracteres (a mesma do cadastro). Elevar o mínimo para 8 deve ser feito no cadastro e na recuperação juntos.
