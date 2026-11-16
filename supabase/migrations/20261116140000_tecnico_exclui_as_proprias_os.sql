-- =====================================================================
-- O técnico pode excluir as OS que ele mesmo criou.
--
-- Até aqui só a administração excluía OS. Para o técnico excluir "as suas", o banco
-- precisa saber quem criou cada OS. A coluna tecnico_id não serve: é o RESPONSÁVEL,
-- e a administração pode abrir uma OS em nome de um técnico (que não a criou).
--
--   criado_por  = usuário (auth.uid()) que abriu a OS
--
-- Regras:
--   * é preenchido pelo banco na abertura, ignorando o que o navegador enviar (não dá para forjar);
--   * só a administração da empresa pode alterá-lo depois;
--   * OS abertas pelo bot (service_role) e as que já existiam ficam sem criador (NULL):
--     essas só a administração exclui. Não há preenchimento retroativo: seria um palpite.
--
-- Exclusão passa a ser: administração da empresa OU o próprio criador, sempre na empresa dele.
-- Rodar DEPOIS de 20261116130000_separacao_admin_tecnico.sql.
-- =====================================================================

ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS criado_por uuid;

COMMENT ON COLUMN public.ordens_de_servico.criado_por IS
  'Usuário (auth.uid()) que abriu a OS. Preenchido pelo banco; NULL para OS do bot e anteriores à coluna. Define quem, além da administração, pode excluir a OS.';

CREATE OR REPLACE FUNCTION public.fn_os_criado_por()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Quem abre a OS pela API/app é o criador, não importa o que enviou
    IF auth.uid() IS NOT NULL THEN
      NEW.criado_por := auth.uid();
    END IF;
  ELSIF NEW.criado_por IS DISTINCT FROM OLD.criado_por THEN
    -- Só a administração da empresa muda o criador de uma OS existente
    IF auth.uid() IS NOT NULL AND NOT public.is_company_admin(auth.uid()) THEN
      NEW.criado_por := OLD.criado_por;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Função de gatilho: ninguém a chama pela API
REVOKE ALL ON FUNCTION public.fn_os_criado_por() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_os_criado_por ON public.ordens_de_servico;
CREATE TRIGGER trg_os_criado_por
  BEFORE INSERT OR UPDATE ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.fn_os_criado_por();

-- Exclusão: administração da empresa ou o criador da OS
DROP POLICY IF EXISTS "kraflo_os_admin_delete" ON public.ordens_de_servico;
DROP POLICY IF EXISTS "kraflo_os_delete_admin_ou_criador" ON public.ordens_de_servico;
CREATE POLICY "kraflo_os_delete_admin_ou_criador" ON public.ordens_de_servico
  FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id(auth.uid())
    AND (public.is_company_admin(auth.uid()) OR criado_por = auth.uid())
  );
