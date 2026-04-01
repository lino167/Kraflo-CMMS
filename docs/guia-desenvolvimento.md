# Guia de Desenvolvimento - Kraflo CMMS

Este guia cobre tudo o que um desenvolvedor precisa saber para contribuir com o projeto.

---

## Pre-requisitos

- **Node.js** v20 ou superior
- **npm** (incluido com Node.js) ou **Bun** (opcional, recomendado)
- **Supabase CLI** (para desenvolvimento do backend)
- **Git**

---

## Configuracao do Ambiente

### 1. Clonar e Instalar Dependencias

```bash
git clone https://github.com/lino167/Kraflo-CMMS.git
cd Kraflo-CMMS
npm install
```

### 2. Configurar Variaveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-anon-key"
```

> Essas variaveis sao obtidas no painel do Supabase em **Settings > API**.

### 3. Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

O servidor sera iniciado em `http://localhost:8080`.

### 4. Configurar o Backend (Supabase)

```bash
# Instalar Supabase CLI (se necessario)
npm install -g supabase

# Executar script de setup
chmod +x scripts/setup-supabase.sh
./scripts/setup-supabase.sh
```

O script ira:
1. Linkar o projeto Supabase
2. Aplicar todas as migrations
3. Fazer deploy das Edge Functions

---

## Scripts Disponiveis

| Script | Comando | Descricao |
|---|---|---|
| `dev` | `npm run dev` | Inicia o servidor de desenvolvimento (Vite) na porta 8080 |
| `build` | `npm run build` | Gera o build de producao |
| `build:dev` | `npm run build:dev` | Gera o build em modo development |
| `preview` | `npm run preview` | Visualiza o build de producao localmente |
| `lint` | `npm run lint` | Executa o ESLint em todos os arquivos TS/TSX |
| `test` | `npm run test` | Executa os testes unitarios (Vitest) |
| `test:watch` | `npm run test:watch` | Executa testes em modo watch |
| `check:functions` | `npm run check:functions` | Verifica tipos das Edge Functions |
| `sync:types` | `npm run sync:types` | Gera tipos TypeScript a partir do schema Supabase |

---

## Estrutura do Projeto

```
Kraflo-CMMS/
  src/                    # Codigo-fonte do frontend
    components/           # Componentes React
      ui/                 # Componentes base (shadcn/ui)
    domain/               # Servicos de dominio
    hooks/                # Custom hooks
    integrations/         # Integracoes externas (Supabase)
    lib/                  # Utilitarios
    pages/                # Paginas (rotas)
    tests/                # Testes unitarios
    types/                # Declaracoes de tipos
  supabase/               # Backend Supabase
    functions/            # Edge Functions (Deno)
      _shared/            # Modulos compartilhados
    migrations/           # Migrations SQL
    config.toml           # Configuracao das functions
  docs/                   # Documentacao
  scripts/                # Scripts de automacao
  public/                 # Arquivos estaticos
```

---

## Convencoes de Codigo

### TypeScript

- Todo o codigo e escrito em **TypeScript** com tipagem estrita.
- Evitar o uso de `any`. Utilizar tipos adequados ou `unknown` quando necessario.
- Interfaces e tipos devem ser definidos proximo ao local de uso ou em arquivos dedicados.

### React

- Componentes funcionais com hooks.
- `React.lazy` + `Suspense` para code splitting de paginas.
- Estado global via React Context (`AuthProvider`).
- Cache de dados via TanStack Query.
- Formularios com React Hook Form + Zod para validacao.

### Estilizacao

- **Tailwind CSS** para estilizacao utility-first.
- Componentes base do **shadcn/ui** (baseados em Radix UI).
- Funcao `cn()` (do `lib/utils.ts`) para merge condicional de classes.
- Tema customizado com variaveis CSS definidas em `index.css`.

### Imports

- Alias `@/` aponta para `src/`.
- Imports devem estar no topo do arquivo.
- Ordem: bibliotecas externas > componentes > hooks > types > utils.

### Nomenclatura

| Tipo | Convencao | Exemplo |
|---|---|---|
| Componentes | PascalCase | `OSForm.tsx`, `AIChat.tsx` |
| Hooks | camelCase com prefixo `use` | `useAuth.tsx`, `useReportStats.ts` |
| Servicos | PascalCase | `OSService`, `ReportService` |
| Utilitarios | camelCase | `handleError`, `cn` |
| Paginas | PascalCase | `OrdensServico.tsx` |
| Variaveis de banco | snake_case | `empresa_id`, `nome_completo` |

---

## Trabalhando com o Supabase

### Cliente Supabase

O cliente e configurado em `src/integrations/supabase/client.ts` e pode ser importado em qualquer lugar:

```typescript
import { supabase } from "@/integrations/supabase/client";
```

### Tipos do Banco

Os tipos sao gerados automaticamente e estao em `src/integrations/supabase/types.ts`. Para regenerar:

```bash
npm run sync:types
```

**Uso dos tipos:**

```typescript
import type { Database } from "@/integrations/supabase/types";

type OS = Database["public"]["Tables"]["ordens_de_servico"]["Row"];
```

### Queries com TanStack Query

Para dados que precisam de cache e sincronizacao, use TanStack Query:

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function useMyData() {
  return useQuery({
    queryKey: ["my-data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabela")
        .select("*");
      if (error) throw error;
      return data;
    },
  });
}
```

### Chamando Edge Functions

```typescript
const { data, error } = await supabase.functions.invoke("nome-function", {
  body: { param: "valor" },
});
```

---

## Autenticacao e Controle de Acesso

### Hook `useAuth`

O hook `useAuth()` fornece o estado de autenticacao em qualquer componente:

```typescript
import { useAuth } from "@/hooks/useAuth";

function MyComponent() {
  const {
    user,          // Usuario autenticado
    profile,       // Perfil do usuario (profiles)
    roles,         // Papeis do usuario
    isLoading,     // Carregando estado de auth?
    isAdminKraflo, // E admin Kraflo?
    isAdminEmpresa,// E admin da empresa?
    signIn,        // Funcao de login
    signUp,        // Funcao de cadastro
    signOut,       // Funcao de logout
  } = useAuth();
}
```

### Protegendo Paginas

Todas as paginas protegidas verificam autenticacao com:

```typescript
useEffect(() => {
  if (!authLoading && !user) {
    navigate("/auth");
  }
}, [user, authLoading, navigate]);
```

### Visibilidade por Role

```typescript
// Mostrar apenas para admin Kraflo
{isAdminKraflo && <AdminPanel />}

// Mostrar para qualquer admin
{(isAdminKraflo || roles.includes('admin_empresa')) && <Component />}
```

---

## Testes

### Stack de Testes

- **Vitest** como test runner
- **Testing Library** para testes de componentes React
- **MSW** (Mock Service Worker) para mocking de APIs
- **jsdom** como ambiente DOM

### Executando Testes

```bash
# Executar todos os testes
npm run test

# Modo watch (re-executa ao salvar)
npm run test:watch
```

### Estrutura de Testes

Os testes estao em:
- `src/tests/` - Testes gerais
- `src/hooks/__tests__/` - Testes de hooks
- `src/lib/__tests__/` - Testes de utilitarios

### Escrevendo Testes

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("MeuComponente", () => {
  it("deve renderizar corretamente", () => {
    render(<MeuComponente />);
    expect(screen.getByText("Texto esperado")).toBeInTheDocument();
  });
});
```

---

## Linting

O projeto usa ESLint com a configuracao flat (`eslint.config.js`):

```bash
npm run lint
```

### Regras Principais

- TypeScript ESLint (recomendado)
- React Hooks (regras recomendadas)
- React Refresh (apenas exportar componentes)
- `@typescript-eslint/no-unused-vars` desabilitado

### Excecoes

- Edge Functions (`supabase/functions/**`): `no-explicit-any` e `no-empty-object-type` desabilitados.
- Componentes UI e `useAuth`: `react-refresh/only-export-components` desabilitado.
- Arquivos de tipos (`src/types/**`): `no-explicit-any` desabilitado.

---

## Deploy

### Frontend (Vercel)

O frontend e hospedado na Vercel com configuracao SPA:

```json
// vercel.json
{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}
```

**Variaveis de ambiente na Vercel:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Backend (Supabase)

```bash
# Aplicar migrations
supabase db push

# Deploy de functions
supabase functions deploy assistente-ia
supabase functions deploy index-os
# ... etc

# Configurar secrets
supabase secrets set LOVABLE_API_KEY=...
supabase secrets set TELEGRAM_BOT_TOKEN=...
```

---

## Fluxo de Trabalho Git

1. Crie um branch a partir de `main`:
   ```bash
   git checkout -b feature/minha-feature
   ```

2. Faca suas alteracoes e garanta que o lint passa:
   ```bash
   npm run lint
   ```

3. Execute os testes:
   ```bash
   npm run test
   ```

4. Faca commit e abra um Pull Request:
   ```bash
   git add .
   git commit -m "feat: descricao da feature"
   git push origin feature/minha-feature
   ```

5. Aguarde a revisao e aprovacao do PR.

### Convencao de Commits

Recomendado usar [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Nova funcionalidade
- `fix:` Correcao de bug
- `docs:` Documentacao
- `refactor:` Refatoracao
- `test:` Testes
- `chore:` Tarefas de manutencao

---

## Resolucao de Problemas

### O servidor nao inicia

1. Verifique se o Node.js v20+ esta instalado: `node --version`
2. Delete `node_modules` e reinstale: `rm -rf node_modules && npm install`
3. Verifique se o arquivo `.env` existe com as variaveis corretas.

### Erro de tipos do Supabase

Regenere os tipos:
```bash
npm run sync:types
```

### Edge Functions nao funcionam

1. Verifique se o Supabase CLI esta instalado: `supabase --version`
2. Verifique se os secrets estao configurados: `supabase secrets list`
3. Verifique os logs: `supabase functions logs nome-function`

### Erro de CORS

Verifique a variavel `ALLOWED_ORIGINS` nas secrets do Supabase. Deve conter o dominio do frontend.
