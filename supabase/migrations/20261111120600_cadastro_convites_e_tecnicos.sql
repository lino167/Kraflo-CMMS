-- =====================================================================
-- Cadastro sem dependência do Telegram
--  * Todo usuário com empresa vira técnico, com identificador interno.
--  * Entrar numa empresa existente exige código de convite; digitar o nome
--    de uma empresa (ou enviar empresa_id) não dá mais acesso a ela.
--  * Quem cria uma empresa nova vira administrador dela.
--  * O Telegram passa a ser um vínculo opcional e verificado por código.
--
-- Obs.: a coluna tecnicos.id_telegram continua sendo a chave do técnico
-- (várias tabelas e o histórico de OS apontam para ela), mas deixa de ser
-- o ID do Telegram: para novos técnicos é um número interno. O ID real do
-- Telegram fica em tecnicos.telegram_user_id.
-- =====================================================================

-- ---------- técnicos ----------
CREATE SEQUENCE IF NOT EXISTS public.tecnicos_interno_seq START 1000;

ALTER TABLE public.tecnicos
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS telegram_user_id bigint;
ALTER TABLE public.tecnicos ALTER COLUMN id_telegram SET DEFAULT nextval('public.tecnicos_interno_seq');

CREATE UNIQUE INDEX IF NOT EXISTS idx_tecnicos_user_id ON public.tecnicos (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tecnicos_telegram_user ON public.tecnicos (telegram_user_id) WHERE telegram_user_id IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tecnico_id bigint REFERENCES public.tecnicos(id_telegram) ON DELETE SET NULL;

-- Técnicos antigos: a chave era o próprio ID do Telegram
UPDATE public.tecnicos SET telegram_user_id = id_telegram
 WHERE telegram_user_id IS NULL AND user_id IS NULL AND id_telegram >= 100000
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.tecnico_id = tecnicos.id_telegram);

-- Liga cada técnico antigo à conta que informou aquele ID (uma conta por técnico)
UPDATE public.tecnicos t SET user_id = p.id
  FROM (SELECT DISTINCT ON (id_telegram) id, id_telegram, empresa_id FROM public.profiles
         WHERE id_telegram IS NOT NULL ORDER BY id_telegram, created_at) p
 WHERE t.id_telegram = p.id_telegram AND t.empresa_id = p.empresa_id AND t.user_id IS NULL;

UPDATE public.profiles p SET tecnico_id = t.id_telegram
  FROM public.tecnicos t WHERE t.user_id = p.id AND p.tecnico_id IS NULL;

-- Contas com empresa e sem técnico passam a ter um
DO $$
DECLARE
  r record;
  v_id bigint;
BEGIN
  FOR r IN SELECT id, empresa_id, nome_completo, email, funcao, setor FROM public.profiles
            WHERE empresa_id IS NOT NULL AND tecnico_id IS NULL
  LOOP
    INSERT INTO public.tecnicos (empresa_id, nome_completo, funcao, setor, user_id)
    VALUES (r.empresa_id, coalesce(nullif(btrim(r.nome_completo), ''), r.email, 'Usuário'), r.funcao, r.setor, r.id)
    RETURNING id_telegram INTO v_id;
    UPDATE public.profiles SET tecnico_id = v_id WHERE id = r.id;
  END LOOP;
END $$;

-- ---------- código de convite da empresa ----------
CREATE OR REPLACE FUNCTION public.fn_novo_codigo_convite()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  -- sem 0/O/1/I/L para não confundir ao digitar
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v text;
BEGIN
  LOOP
    SELECT string_agg(substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1), '')
      INTO v FROM generate_series(1, 8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.empresas WHERE codigo_convite = v);
  END LOOP;
  RETURN v;
END;
$$;

ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS codigo_convite text;
UPDATE public.empresas SET codigo_convite = public.fn_novo_codigo_convite() WHERE codigo_convite IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_codigo_convite ON public.empresas (codigo_convite);

-- Tela de cadastro: confere o código e mostra o nome da empresa (sem login)
CREATE OR REPLACE FUNCTION public.fn_validar_convite(p_codigo text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object('valido', true, 'empresa_nome', e.nome_empresa)
       FROM public.empresas e
      WHERE e.codigo_convite = upper(btrim(p_codigo)) AND length(btrim(coalesce(p_codigo, ''))) = 8),
    jsonb_build_object('valido', false))
$$;

-- Admin vê o código da própria empresa
CREATE OR REPLACE FUNCTION public.fn_codigo_convite()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin_empresa') THEN
    RAISE EXCEPTION 'Apenas administradores veem o código de convite' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT codigo_convite FROM public.empresas WHERE id = public.get_user_empresa_id(auth.uid()));
END;
$$;

-- Admin troca o código (o anterior deixa de valer)
CREATE OR REPLACE FUNCTION public.fn_regenerar_codigo_convite()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v text := public.fn_novo_codigo_convite();
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin_empresa') THEN
    RAISE EXCEPTION 'Apenas administradores trocam o código de convite' USING ERRCODE = '42501';
  END IF;
  UPDATE public.empresas SET codigo_convite = v WHERE id = public.get_user_empresa_id(auth.uid());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada' USING ERRCODE = '22023';
  END IF;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_novo_codigo_convite() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_validar_convite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_codigo_convite() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_regenerar_codigo_convite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_validar_convite(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_codigo_convite() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_regenerar_codigo_convite() TO authenticated;

-- ---------- gatilho de cadastro ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_nome text := nullif(btrim(coalesce(v_meta ->> 'nome_completo', v_meta ->> 'full_name', '')), '');
  v_funcao text := nullif(btrim(v_meta ->> 'funcao'), '');
  v_setor text := nullif(btrim(v_meta ->> 'setor'), '');
  v_convite text := nullif(upper(btrim(v_meta ->> 'codigo_convite')), '');
  v_nome_empresa text := nullif(btrim(v_meta ->> 'nome_empresa'), '');
  v_empresa_id uuid;
  v_criou_empresa boolean := false;
  v_tecnico_id bigint;
BEGIN
  -- O que vem em raw_user_meta_data é escolhido por quem se cadastra: nunca
  -- confiar em empresa_id nem em id_telegram vindos dali.
  IF v_convite IS NOT NULL THEN
    SELECT id, nome_empresa INTO v_empresa_id, v_nome_empresa
      FROM public.empresas WHERE codigo_convite = v_convite;
    IF v_empresa_id IS NULL THEN
      RAISE EXCEPTION 'Código de convite inválido' USING ERRCODE = '22023';
    END IF;
  ELSIF v_nome_empresa IS NOT NULL THEN
    -- Sempre uma empresa nova: nome igual ao de outra não dá acesso à outra
    INSERT INTO public.empresas (nome_empresa, codigo_convite)
    VALUES (left(v_nome_empresa, 150), public.fn_novo_codigo_convite())
    RETURNING id INTO v_empresa_id;
    v_criou_empresa := true;
  END IF;

  INSERT INTO public.profiles (id, nome_completo, email, funcao, setor, empresa_id, nome_empresa)
  VALUES (NEW.id, v_nome, NEW.email, v_funcao, v_setor, v_empresa_id, v_nome_empresa);

  IF v_empresa_id IS NOT NULL THEN
    INSERT INTO public.tecnicos (empresa_id, nome_completo, funcao, setor, user_id)
    VALUES (v_empresa_id, coalesce(v_nome, NEW.email, 'Usuário'), v_funcao, v_setor, NEW.id)
    RETURNING id_telegram INTO v_tecnico_id;
    UPDATE public.profiles SET tecnico_id = v_tecnico_id WHERE id = NEW.id;
  END IF;

  IF v_criou_empresa THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin_empresa');
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ---------- vínculo opcional com o Telegram ----------
CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  code text PRIMARY KEY,
  tecnico_id bigint NOT NULL REFERENCES public.tecnicos(id_telegram) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
-- Sem policies: só o servidor (funções e bot) lê esta tabela
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

-- Gera um código de uso único (10 min) para o usuário enviar ao bot: /vincular CODIGO
CREATE OR REPLACE FUNCTION public.fn_gerar_codigo_telegram()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tecnico bigint;
  v_code text;
BEGIN
  SELECT id_telegram INTO v_tecnico FROM public.tecnicos WHERE user_id = auth.uid();
  IF v_tecnico IS NULL THEN
    RAISE EXCEPTION 'Sua conta não está vinculada a uma empresa' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.telegram_link_codes WHERE tecnico_id = v_tecnico OR expires_at < now();
  v_code := public.fn_novo_codigo_convite();
  INSERT INTO public.telegram_link_codes (code, tecnico_id, expires_at)
  VALUES (v_code, v_tecnico, now() + interval '10 minutes');
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_desvincular_telegram()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tecnicos SET telegram_user_id = NULL WHERE user_id = auth.uid()
$$;

-- Chamada pelo bot (service_role): confere o código e grava o vínculo
CREATE OR REPLACE FUNCTION public.fn_vincular_telegram(p_code text, p_telegram_user_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tecnico bigint;
  v_nome text;
BEGIN
  DELETE FROM public.telegram_link_codes
   WHERE code = upper(btrim(p_code)) AND expires_at > now()
  RETURNING tecnico_id INTO v_tecnico;
  IF v_tecnico IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'codigo_invalido');
  END IF;
  IF EXISTS (SELECT 1 FROM public.tecnicos WHERE telegram_user_id = p_telegram_user_id AND id_telegram <> v_tecnico) THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'telegram_em_uso');
  END IF;
  UPDATE public.tecnicos SET telegram_user_id = p_telegram_user_id WHERE id_telegram = v_tecnico
  RETURNING nome_completo INTO v_nome;
  RETURN jsonb_build_object('ok', true, 'nome', v_nome);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_gerar_codigo_telegram() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_desvincular_telegram() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_vincular_telegram(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_gerar_codigo_telegram() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_desvincular_telegram() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_vincular_telegram(text, bigint) TO service_role;
