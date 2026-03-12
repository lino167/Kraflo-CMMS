-- Enable RLS on tables that don't have it
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_de_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pecas_utilizadas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for empresas
CREATE POLICY "Admin Kraflo can view all empresas"
ON public.empresas
FOR SELECT
USING (public.is_admin_kraflo(auth.uid()));

CREATE POLICY "Admin Empresa can view their empresa"
ON public.empresas
FOR SELECT
USING (id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "Admin Kraflo can manage empresas"
ON public.empresas
FOR ALL
USING (public.is_admin_kraflo(auth.uid()));

-- RLS Policies for tecnicos
CREATE POLICY "Admin Kraflo can view all tecnicos"
ON public.tecnicos
FOR SELECT
USING (public.is_admin_kraflo(auth.uid()));

CREATE POLICY "Admin Empresa can view their tecnicos"
ON public.tecnicos
FOR SELECT
USING (empresa_id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "Admin Kraflo can manage tecnicos"
ON public.tecnicos
FOR ALL
USING (public.is_admin_kraflo(auth.uid()));

-- RLS Policies for ordens_de_servico
CREATE POLICY "Admin Kraflo can view all OS"
ON public.ordens_de_servico
FOR SELECT
USING (public.is_admin_kraflo(auth.uid()));

CREATE POLICY "Admin Empresa can view their OS"
ON public.ordens_de_servico
FOR SELECT
USING (empresa_id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "Admin Kraflo can manage all OS"
ON public.ordens_de_servico
FOR ALL
USING (public.is_admin_kraflo(auth.uid()));

-- RLS Policies for pecas_utilizadas
CREATE POLICY "Admin Kraflo can view all pecas"
ON public.pecas_utilizadas
FOR SELECT
USING (public.is_admin_kraflo(auth.uid()));

CREATE POLICY "Admin Empresa can view pecas from their OS"
ON public.pecas_utilizadas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ordens_de_servico os
    WHERE os.id = ordem_id
    AND os.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "Admin Kraflo can manage pecas"
ON public.pecas_utilizadas
FOR ALL
USING (public.is_admin_kraflo(auth.uid()));