# Cadastro, convites e vínculo do Telegram

O cadastro não depende mais do ID do Telegram. O login continua por e-mail e senha.

## Como alguém entra

| Caminho | O que a pessoa informa | Resultado |
|---|---|---|
| Criar empresa | Nome da empresa | Empresa nova; quem criou vira `admin_empresa` e técnico |
| Convite | Código de 8 caracteres (ou link `/auth?convite=CODIGO`) | Entra na empresa do código como técnico, sem papel de admin |

- Digitar o nome de uma empresa existente **não** dá acesso a ela: cria outra empresa, separada.
- O gatilho `handle_new_user` ignora `empresa_id` e `id_telegram` enviados no cadastro.
- O administrador vê, copia e troca o código em **Conta e Equipe** (`/conta`). Trocar invalida o código anterior.

## Técnicos

- Todo usuário com empresa tem um registro em `tecnicos`, criado no cadastro.
- `tecnicos.id_telegram` continua sendo a chave (OS, preventivas e conversas de IA apontam para ela), mas para técnicos novos é um **número interno**, não o ID do Telegram.
- `tecnicos.user_id` liga o técnico à conta; `profiles.tecnico_id` aponta para o técnico do usuário.
- `tecnicos.telegram_user_id` guarda o ID real do Telegram, só depois de verificado.

## Vínculo do Telegram (opcional)

1. No app, **Conta e Equipe → Vincular Telegram** gera um código de uso único, válido por 10 minutos.
2. O técnico envia ao bot: `/vincular CODIGO`.
3. O bot chama `fn_vincular_telegram`, que grava `telegram_user_id`. Um Telegram só pode estar ligado a um técnico.

O bot identifica o técnico por `telegram_user_id` e o papel de admin pela conta ligada ao técnico.

## Migration

`supabase/migrations/20261111120600_cadastro_convites_e_tecnicos.sql`. Ao aplicar, ela:

- cria técnico para as contas que tinham empresa e não tinham técnico;
- mantém os técnicos antigos e marca o Telegram deles como já vinculado;
- gera um código de convite para cada empresa existente.
