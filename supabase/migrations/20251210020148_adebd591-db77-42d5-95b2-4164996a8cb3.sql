-- Inserir role admin_kraflo para o usuário Zacarias
INSERT INTO public.user_roles (user_id, role)
VALUES ('3a076b6b-ff06-4d6d-b08d-6ab92e8c0607', 'admin_kraflo')
ON CONFLICT (user_id, role) DO NOTHING;