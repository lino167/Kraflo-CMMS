-- Corrigir o empresa_id do profile do usuário para corresponder à empresa correta
UPDATE public.profiles 
SET empresa_id = 'a8e8ee94-1594-4826-83d4-43d1b5d6a988'
WHERE id = '3a076b6b-ff06-4d6d-b08d-6ab92e8c0607';