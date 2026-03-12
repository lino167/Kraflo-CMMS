-- Add nome_empresa column to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome_empresa text;

-- Update the handle_new_user function to:
-- 1. Create empresa if nome_empresa is provided and empresa doesn't exist
-- 2. Link user to empresa
-- 3. Create tecnico record if id_telegram is provided
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_nome_empresa text;
  v_id_telegram bigint;
  v_nome_completo text;
  v_funcao text;
  v_setor text;
  v_codigo_empresa text;
BEGIN
  -- Extract values from metadata
  v_nome_empresa := NEW.raw_user_meta_data ->> 'nome_empresa';
  v_id_telegram := (NEW.raw_user_meta_data ->> 'id_telegram')::bigint;
  v_nome_completo := COALESCE(NEW.raw_user_meta_data ->> 'nome_completo', NEW.raw_user_meta_data ->> 'full_name');
  v_funcao := NEW.raw_user_meta_data ->> 'funcao';
  v_setor := NEW.raw_user_meta_data ->> 'setor';
  v_codigo_empresa := NEW.raw_user_meta_data ->> 'codigo_empresa';
  
  -- Try to get empresa_id from metadata first (if provided directly)
  v_empresa_id := (NEW.raw_user_meta_data ->> 'empresa_id')::uuid;
  
  -- If no empresa_id but nome_empresa is provided, look up or create empresa
  IF v_empresa_id IS NULL AND v_nome_empresa IS NOT NULL AND v_nome_empresa != '' THEN
    -- Try to find existing empresa by name (case-insensitive)
    SELECT id INTO v_empresa_id
    FROM public.empresas
    WHERE LOWER(TRIM(nome_empresa)) = LOWER(TRIM(v_nome_empresa))
    LIMIT 1;
    
    -- If not found, create new empresa
    IF v_empresa_id IS NULL THEN
      INSERT INTO public.empresas (nome_empresa)
      VALUES (TRIM(v_nome_empresa))
      RETURNING id INTO v_empresa_id;
    END IF;
  END IF;
  
  -- Create profile
  INSERT INTO public.profiles (id, nome_completo, email, funcao, setor, codigo_empresa, id_telegram, empresa_id, nome_empresa)
  VALUES (
    NEW.id,
    v_nome_completo,
    NEW.email,
    v_funcao,
    v_setor,
    v_codigo_empresa,
    v_id_telegram,
    v_empresa_id,
    v_nome_empresa
  );
  
  -- If id_telegram is provided and empresa_id exists, create tecnico record
  IF v_id_telegram IS NOT NULL AND v_empresa_id IS NOT NULL THEN
    -- Check if tecnico already exists
    IF NOT EXISTS (SELECT 1 FROM public.tecnicos WHERE id_telegram = v_id_telegram) THEN
      INSERT INTO public.tecnicos (id_telegram, empresa_id, nome_completo, funcao, setor, codigo_empresa)
      VALUES (v_id_telegram, v_empresa_id, v_nome_completo, v_funcao, v_setor, v_codigo_empresa);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;