-- ==========================================
-- HARDENING: Revoke excessive grants across all tables
-- Priority: CRITICAL security fix
-- ==========================================

-- ========== 1) CRITICAL: user_roles (privilege escalation risk) ==========
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.user_roles FROM authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
-- INSERT/UPDATE/DELETE via service_role only
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

-- ========== 2) CRITICAL: profiles (PII) ==========
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
-- INSERT handled by trigger on auth.users
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- ========== 3) CRITICAL: bot_user_states (internal) ==========
REVOKE ALL ON public.bot_user_states FROM anon;
REVOKE ALL ON public.bot_user_states FROM authenticated;
-- Only service_role (Edge Functions) should access
ALTER TABLE public.bot_user_states FORCE ROW LEVEL SECURITY;

-- ========== 4) HIGH: ordens_de_servico (business data) ==========
REVOKE ALL ON public.ordens_de_servico FROM anon;
REVOKE ALL ON public.ordens_de_servico FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_de_servico TO authenticated;
ALTER TABLE public.ordens_de_servico FORCE ROW LEVEL SECURITY;

-- ========== 5) HIGH: pecas_utilizadas ==========
REVOKE ALL ON public.pecas_utilizadas FROM anon;
REVOKE ALL ON public.pecas_utilizadas FROM authenticated;
GRANT SELECT ON public.pecas_utilizadas TO authenticated;
-- INSERT/UPDATE/DELETE via service_role (Telegram bot)
ALTER TABLE public.pecas_utilizadas FORCE ROW LEVEL SECURITY;

-- ========== 6) HIGH: tecnicos ==========
REVOKE ALL ON public.tecnicos FROM anon;
REVOKE ALL ON public.tecnicos FROM authenticated;
GRANT SELECT ON public.tecnicos TO authenticated;
-- INSERT/UPDATE/DELETE via service_role
ALTER TABLE public.tecnicos FORCE ROW LEVEL SECURITY;

-- ========== 7) MEDIUM: ia_conversas ==========
REVOKE ALL ON public.ia_conversas FROM anon;
REVOKE ALL ON public.ia_conversas FROM authenticated;
GRANT SELECT ON public.ia_conversas TO authenticated;
-- INSERT via Edge Function assistente-ia
ALTER TABLE public.ia_conversas FORCE ROW LEVEL SECURITY;

-- ========== 8) MEDIUM: ia_mensagens ==========
REVOKE ALL ON public.ia_mensagens FROM anon;
REVOKE ALL ON public.ia_mensagens FROM authenticated;
GRANT SELECT ON public.ia_mensagens TO authenticated;
-- INSERT via Edge Function assistente-ia
ALTER TABLE public.ia_mensagens FORCE ROW LEVEL SECURITY;

-- ========== 9) MEDIUM: manuais ==========
REVOKE ALL ON public.manuais FROM anon;
REVOKE ALL ON public.manuais FROM authenticated;
GRANT SELECT ON public.manuais TO authenticated;
-- INSERT/UPDATE via Edge Function upload-manual
ALTER TABLE public.manuais FORCE ROW LEVEL SECURITY;

-- ========== 10) MEDIUM: manual_chunks ==========
REVOKE ALL ON public.manual_chunks FROM anon;
REVOKE ALL ON public.manual_chunks FROM authenticated;
GRANT SELECT ON public.manual_chunks TO authenticated;
-- INSERT via Edge Function upload-manual
ALTER TABLE public.manual_chunks FORCE ROW LEVEL SECURITY;

-- ========== 11) MEDIUM: os_embeddings ==========
REVOKE ALL ON public.os_embeddings FROM anon;
REVOKE ALL ON public.os_embeddings FROM authenticated;
GRANT SELECT ON public.os_embeddings TO authenticated;
-- INSERT via Edge Function index-os
ALTER TABLE public.os_embeddings FORCE ROW LEVEL SECURITY;

-- ========== Ensure service_role has full access for Edge Functions ==========
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.bot_user_states TO service_role;
GRANT ALL ON public.ordens_de_servico TO service_role;
GRANT ALL ON public.pecas_utilizadas TO service_role;
GRANT ALL ON public.tecnicos TO service_role;
GRANT ALL ON public.ia_conversas TO service_role;
GRANT ALL ON public.ia_mensagens TO service_role;
GRANT ALL ON public.manuais TO service_role;
GRANT ALL ON public.manual_chunks TO service_role;
GRANT ALL ON public.os_embeddings TO service_role;