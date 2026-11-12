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

- **PIN e criptografia**: os dados de apoio e a fila ficam cifrados no aparelho (AES-GCM) com uma chave derivada do PIN do técnico (PBKDF2, 310 mil iterações). A chave existe só na memória: ao reabrir o app, é preciso digitar o PIN. Código em `src/lib/offline/crypto.ts`, `secure-store.ts` e `pin.ts`.
- **Tentativas**: 5 erros seguidos de PIN apagam os dados offline do aparelho. PINs triviais (123456, 111111) são recusados.
- **Prazo**: o acesso offline vale até 7 dias após a última validação com o servidor.
- **Logout**: apaga PIN, dados de apoio, fila e perfil guardados. Se houver (ou puder haver) lançamentos não enviados, o app avisa antes.
- **Dono do lançamento**: cada lançamento guarda quem o criou; só a própria sessão envia.
- **O servidor continua decidindo**: toda escrita passa pelo RLS. O fechamento usa `fn_campo_fechar_os`, que grava peças e fechamento numa única transação.
- **Limite**: um PIN numérico de 6 dígitos protege contra quem pega o celular desbloqueado, não contra extração forense do armazenamento. A senha de tela do aparelho continua necessária. Esquecer o PIN exige apagar os dados offline.

## Fotos e peças

- A foto é reduzida no aparelho (até 1280 px, JPEG), entra cifrada na fila e sobe no envio. Se o servidor recusar o arquivo, a OS segue sem o anexo.
- Peças podem ser escolhidas do estoque guardado no aparelho; a baixa acontece no servidor, no envio. Se o saldo real for insuficiente, o fechamento volta como erro para revisão.

## Limites conhecidos

- Sem envio em segundo plano: a fila sai quando o app está aberto e com sinal.
- `data_abertura` usa o relógio do aparelho.
- Primeiro acesso, criação do PIN e renovação de sessão exigem internet.

## Migration necessária

- `20261111120300_os_client_uuid_campo.sql` (já aplicada em produção): identificador do aparelho.
- `20261111120500_campo_fechar_os_atomico.sql`: fechamento em transação única. Enquanto não for aplicada, o app usa o envio em etapas automaticamente.
