# Hooks - Kraflo CMMS

Documentacao dos custom React hooks do projeto.

---

## `useAuth`

**Arquivo:** `src/hooks/useAuth.tsx`

Hook principal de autenticacao. Fornece estado de usuario, perfil, roles e funcoes de login/logout via React Context.

**Uso:**

```typescript
import { useAuth } from "@/hooks/useAuth";

const { user, profile, roles, isLoading, isAdminKraflo, isAdminEmpresa, signIn, signUp, signOut } = useAuth();
```

**Retorno:**

| Campo | Tipo | Descricao |
|---|---|---|
| `user` | `User \| null` | Usuario autenticado do Supabase Auth |
| `session` | `Session \| null` | Sessao ativa |
| `profile` | `UserProfile \| null` | Perfil do usuario (tabela `profiles`) |
| `roles` | `AppRole[]` | Lista de papeis (`admin_kraflo`, `admin_empresa`) |
| `isLoading` | `boolean` | Carregando estado de autenticacao |
| `isAdminKraflo` | `boolean` | Atalho: usuario e admin Kraflo |
| `isAdminEmpresa` | `boolean` | Atalho: usuario e admin da empresa |
| `signIn(email, password)` | `Promise` | Login com email/senha |
| `signUp(email, password, data)` | `Promise` | Cadastro com dados adicionais |
| `signOut()` | `Promise` | Logout |

**Interface `UserProfile`:**

```typescript
interface UserProfile {
  id: string;
  empresa_id: string | null;
  nome_completo: string | null;
  email: string | null;
  funcao: string | null;
  setor: string | null;
  codigo_empresa: string | null;
  id_telegram: number | null;
}
```

**Dados de cadastro (`SignUpData`):**

```typescript
interface SignUpData {
  nomeCompleto: string;
  funcao?: string;
  setor?: string;
  codigoEmpresa?: string;
  idTelegram?: string;
  nomeEmpresa?: string;
}
```

**Fluxo interno:**
1. Escuta mudancas de autenticacao via `onAuthStateChange`.
2. Ao detectar sessao ativa, busca perfil em `profiles` e roles em `user_roles`.
3. Disponibiliza tudo via Context para toda a arvore de componentes.

---

## `useReportStats`

**Arquivo:** `src/hooks/useReportStats.ts`

Hook para buscar estatisticas do dashboard operacional.

**Uso tipico:** Alimenta o componente `Dashboard` com metricas em tempo real.

---

## `useDeepReportStats`

**Arquivo:** `src/hooks/useDeepReportStats.ts`

Hook para buscar relatorios avancados via Edge Function `reports-summary`.

**Uso tipico:** Alimenta o componente `DeepReport` com dados consolidados por periodo.

---

## `useEquipmentHistory`

**Arquivo:** `src/hooks/useEquipmentHistory.ts`

Hook que fornece dados de historico de equipamentos para a pagina Raio-X.

**Hooks exportados:**

| Hook | Descricao |
|---|---|
| `useSuccessCases(empresaId, limit, start, end)` | Casos de sucesso (OS fechadas sem reincidencia) |
| `useProblematicCases(empresaId, limit, start, end)` | Casos problematicos (reincidencias) |
| `useMonthlyStats(empresaId, start, end)` | Estatisticas mensais (total, sucesso, taxa) |

**Interface `SuccessCase`:**

Contem dados da OS com informacoes adicionais como `tecnico_nome`, `status_reincidencia` e `dias_desde_ultima_solucao`.

---

## `useTechnicianStats`

**Arquivo:** `src/hooks/useTechnicianStats.ts`

Hooks para metricas de desempenho de tecnicos.

**Hooks exportados:**

| Hook | Descricao |
|---|---|
| `useTechnicianPerformance(empresaId, tecnicoId)` | Performance individual do tecnico |
| `useTeamPerformance(empresaId)` | Performance de toda a equipe |
| `useTeamMTTRComparison(empresaId, tecnicoId)` | Comparacao de MTTR individual vs equipe |
| `useTechnicianQualityScore(empresaId, tecnicoId)` | Quality Score baseado em nao-reincidencia |

---

## `useOSCategories`

**Arquivo:** `src/hooks/useOSCategories.ts`

Hook para buscar e gerenciar categorias de OS (parada e problema).

**Retorno:**

| Campo | Descricao |
|---|---|
| `categoriasParada` | Lista de categorias de parada |
| `categoriasProblema` | Lista de categorias de problema |
| `getCategoriaParadaNome(id)` | Retorna nome da categoria de parada pelo ID |
| `getCategoriaProblemaName(id)` | Retorna nome da categoria de problema pelo ID |
| `getSubcategoriaName(id)` | Retorna nome da subcategoria pelo ID |

Usa o servico `OSService` para buscar dados.

---

## `useInternalBenchmarks`

**Arquivo:** `src/hooks/useInternalBenchmarks.ts`

Hook para buscar configuracao de benchmarks da empresa.

**Uso tipico:** Compara metricas atuais (MTTR, MTBF, taxa de resolucao) com as metas configuradas em `config_benchmarks`.

---

## `use-mobile`

**Arquivo:** `src/hooks/use-mobile.tsx`

Hook para detectar se o usuario esta em um dispositivo movel.

**Retorno:** `boolean` - `true` se a largura da tela e menor que o breakpoint movel.

---

## `use-toast`

**Arquivo:** `src/hooks/use-toast.ts`

Hook do sistema de notificacoes toast (Radix UI).

**Uso:**

```typescript
import { useToast } from "@/hooks/use-toast";

const { toast } = useToast();
toast({ title: "Sucesso!", description: "Operacao realizada." });
```

> **Nota:** O projeto tambem usa `sonner` para toasts mais simples via `toast()` de `@/components/ui/sonner`.
