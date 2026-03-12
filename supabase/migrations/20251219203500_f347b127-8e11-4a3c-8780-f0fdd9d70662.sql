-- Prompt 3 & 4: RLS para manuais e chunks com suporte a "público"

-- Remover policies antigas de manuais para recriar
DROP POLICY IF EXISTS "Admin Empresa can view their manuais" ON public.manuais;
DROP POLICY IF EXISTS "Admin Kraflo can manage manuais" ON public.manuais;

-- SELECT: empresa própria OU is_public=true
CREATE POLICY "manuais_select_own_or_public" ON public.manuais
FOR SELECT USING (
  empresa_id = get_user_empresa_id(auth.uid())
  OR is_public = true
);

-- INSERT: apenas admin_empresa da própria empresa ou admin_kraflo
CREATE POLICY "manuais_insert_admin" ON public.manuais
FOR INSERT WITH CHECK (
  (has_role(auth.uid(), 'admin_empresa') AND empresa_id = get_user_empresa_id(auth.uid()))
  OR is_admin_kraflo(auth.uid())
);

-- UPDATE: apenas admin da própria empresa ou admin_kraflo
CREATE POLICY "manuais_update_admin" ON public.manuais
FOR UPDATE USING (
  (has_role(auth.uid(), 'admin_empresa') AND empresa_id = get_user_empresa_id(auth.uid()))
  OR is_admin_kraflo(auth.uid())
);

-- DELETE: apenas admin da própria empresa ou admin_kraflo
CREATE POLICY "manuais_delete_admin" ON public.manuais
FOR DELETE USING (
  (has_role(auth.uid(), 'admin_empresa') AND empresa_id = get_user_empresa_id(auth.uid()))
  OR is_admin_kraflo(auth.uid())
);

-- Prompt 4: Atualizar RLS de manual_chunks para herdar is_public

DROP POLICY IF EXISTS "Users can view chunks from their company manuals" ON public.manual_chunks;
DROP POLICY IF EXISTS "Admin Kraflo can manage manual_chunks" ON public.manual_chunks;

-- SELECT: chunks de manuais da empresa OU manuais públicos
CREATE POLICY "chunks_select_own_or_public" ON public.manual_chunks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.manuais m
    WHERE m.id = manual_chunks.manual_id
    AND (m.empresa_id = get_user_empresa_id(auth.uid()) OR m.is_public = true)
  )
);

-- INSERT/UPDATE/DELETE: apenas admin_kraflo (indexação via service role)
CREATE POLICY "chunks_manage_admin_kraflo" ON public.manual_chunks
FOR ALL USING (is_admin_kraflo(auth.uid()));