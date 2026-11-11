# Modo Campo (offline)

Tela `/campo`: abre e fecha OS sem internet e envia tudo automaticamente quando a conexão volta.

## Como funciona

- **Instalação**: o app é instalável pela tela inicial do celular (`public/manifest.webmanifest`).
  Um service worker (`public/sw.js`) guarda a casca do app e os arquivos estáticos, então o app abre sem sinal depois da primeira visita com internet.
- **Dados de apoio**: máquinas, categorias de parada e de causa, subcategorias, técnicos e OS abertas da empresa são guardados no aparelho (IndexedDB) a cada vez que há conexão (`src/lib/offline/snapshot.ts`).
- **Fila de envio**: cada abertura ou fechamento feito offline entra numa fila persistida (`src/lib/offline/queue.ts`).
  - A fila é enviada em ordem.
  - Cada OS aberta offline recebe um `client_uuid` gerado no aparelho; o servidor não cria a mesma OS duas vezes (índice único em `ordens_de_servico.client_uuid`).
  - Queda de conexão no meio do envio retoma de onde parou; peças já gravadas não são repetidas.
  - Conflitos (ex.: OS já fechada por outra pessoa) e erros de validação ficam na aba **Envio** para revisão; não travam o restante.
- **Quando envia**: ao voltar a conexão, ao trazer o app para frente e a cada 30 s com o app aberto.

## Segurança do acesso offline

- **Prazo**: o acesso offline vale até 7 dias após a última validação com o servidor (`src/lib/offline/access.ts`). Depois disso, o aparelho precisa de conexão para entrar de novo.
- **Logout**: apaga os dados de apoio e o perfil guardados no aparelho. Se houver lançamentos não enviados, o app avisa e só sai depois de confirmação, que descarta a fila.
- **Dono do lançamento**: cada lançamento guarda quem o criou. Só a própria sessão envia; lançamentos de outro usuário ficam na fila sem serem enviados com outra conta.
- **O servidor continua decidindo**: toda escrita passa pelas regras de acesso do banco (RLS). Um técnico desligado não consegue gravar mesmo com a fila no aparelho.
- **Risco residual**: os dados ficam no aparelho sem criptografia própria. Quem tiver o celular desbloqueado pode ver máquinas, OS abertas e lançamentos pendentes. Recomenda-se senha de tela no aparelho; um PIN do app é o próximo passo.

## Limites conhecidos

- Sem background sync: o envio só acontece com o app aberto. No iPhone e no Android, a fila é enviada na próxima vez que o técnico abrir o app com sinal.
- Fotos e baixa automática de peças do estoque ainda não funcionam offline (peça entra como texto livre).
- `data_abertura` usa o relógio do aparelho; relógio errado gera data errada.
- Primeiro acesso e renovação de sessão exigem internet.

## Migration necessária

`supabase/migrations/20261111120300_os_client_uuid_campo.sql` precisa estar aplicada no banco antes do envio funcionar.
