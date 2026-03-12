-- Add DELETE policy for Admin Empresa to delete OS from their company
CREATE POLICY "Admin Empresa can delete their OS"
ON public.ordens_de_servico
FOR DELETE
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Add UPDATE policy for Admin Empresa to update OS from their company
CREATE POLICY "Admin Empresa can update their OS"
ON public.ordens_de_servico
FOR UPDATE
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Add INSERT policy for Admin Empresa to create OS for their company
CREATE POLICY "Admin Empresa can insert OS"
ON public.ordens_de_servico
FOR INSERT
WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));