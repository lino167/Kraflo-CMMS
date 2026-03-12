-- ==========================================
-- FIX 1: ia_conversas - Remove public access, add proper RLS
-- ==========================================
DROP POLICY IF EXISTS "Allow all access to ia_conversas" ON public.ia_conversas;

-- Admin Kraflo can manage all conversations
CREATE POLICY "Admin Kraflo can manage ia_conversas"
ON public.ia_conversas
FOR ALL
USING (is_admin_kraflo(auth.uid()));

-- Admin Empresa can view conversations from their company
CREATE POLICY "Admin Empresa can view their ia_conversas"
ON public.ia_conversas
FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Service role (Edge Functions/bot) bypasses RLS, so no additional policy needed

-- ==========================================
-- FIX 2: ia_mensagens - Remove public access, add proper RLS
-- ==========================================
DROP POLICY IF EXISTS "Allow all access to ia_mensagens" ON public.ia_mensagens;

-- Admin Kraflo can manage all messages
CREATE POLICY "Admin Kraflo can manage ia_mensagens"
ON public.ia_mensagens
FOR ALL
USING (is_admin_kraflo(auth.uid()));

-- Users can view messages from conversations in their company
CREATE POLICY "Users can view messages from their company conversations"
ON public.ia_mensagens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ia_conversas c
    WHERE c.id = ia_mensagens.conversa_id
    AND c.empresa_id = get_user_empresa_id(auth.uid())
  )
);

-- ==========================================
-- FIX 3: manuais - Remove public access, add proper RLS
-- ==========================================
DROP POLICY IF EXISTS "Allow all access to manuais" ON public.manuais;

-- Admin Kraflo can manage all manuals
CREATE POLICY "Admin Kraflo can manage manuais"
ON public.manuais
FOR ALL
USING (is_admin_kraflo(auth.uid()));

-- Admin Empresa can view manuals from their company
CREATE POLICY "Admin Empresa can view their manuais"
ON public.manuais
FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- ==========================================
-- FIX 4: manual_chunks - Remove public access, add proper RLS
-- ==========================================
DROP POLICY IF EXISTS "Allow all access to manual_chunks" ON public.manual_chunks;

-- Admin Kraflo can manage all chunks
CREATE POLICY "Admin Kraflo can manage manual_chunks"
ON public.manual_chunks
FOR ALL
USING (is_admin_kraflo(auth.uid()));

-- Users can view chunks from manuals in their company
CREATE POLICY "Users can view chunks from their company manuals"
ON public.manual_chunks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.manuais m
    WHERE m.id = manual_chunks.manual_id
    AND m.empresa_id = get_user_empresa_id(auth.uid())
  )
);

-- ==========================================
-- FIX 5: os_embeddings - Remove public access, add proper RLS
-- ==========================================
DROP POLICY IF EXISTS "Allow all access to os_embeddings" ON public.os_embeddings;

-- Admin Kraflo can manage all embeddings
CREATE POLICY "Admin Kraflo can manage os_embeddings"
ON public.os_embeddings
FOR ALL
USING (is_admin_kraflo(auth.uid()));

-- Users can view embeddings from OS in their company
CREATE POLICY "Users can view embeddings from their company OS"
ON public.os_embeddings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ordens_de_servico os
    WHERE os.id = os_embeddings.ordem_id
    AND os.empresa_id = get_user_empresa_id(auth.uid())
  )
);