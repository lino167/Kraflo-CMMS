-- Add new columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS funcao text,
ADD COLUMN IF NOT EXISTS setor text,
ADD COLUMN IF NOT EXISTS codigo_empresa text,
ADD COLUMN IF NOT EXISTS id_telegram bigint;

-- Update the handle_new_user function to include new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, email, funcao, setor, codigo_empresa, id_telegram, empresa_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome_completo', NEW.raw_user_meta_data ->> 'full_name'),
    NEW.email,
    NEW.raw_user_meta_data ->> 'funcao',
    NEW.raw_user_meta_data ->> 'setor',
    NEW.raw_user_meta_data ->> 'codigo_empresa',
    (NEW.raw_user_meta_data ->> 'id_telegram')::bigint,
    (NEW.raw_user_meta_data ->> 'empresa_id')::uuid
  );
  RETURN NEW;
END;
$$;

-- Update the profile for zaca793@gmail.com
UPDATE public.profiles 
SET 
  nome_completo = 'Zacarias Lino ramos filho',
  funcao = 'Mecânico de produção I',
  setor = 'Tecelagem',
  codigo_empresa = '33111',
  id_telegram = 294152778,
  empresa_id = 'a8e8ee94-1594-4826-83d4-43d1b5d6a988'
WHERE email = 'zaca793@gmail.com';