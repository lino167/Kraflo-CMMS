-- =====================================================================
-- Modo campo (offline): cada OS aberta no aparelho recebe um identificador
-- gerado no próprio aparelho. Se o envio for repetido (queda de conexão
-- depois do servidor ter gravado), o insert não cria a OS em duplicata.
-- =====================================================================

ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS client_uuid uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_os_client_uuid
  ON public.ordens_de_servico (client_uuid)
  WHERE client_uuid IS NOT NULL;

COMMENT ON COLUMN public.ordens_de_servico.client_uuid IS
'Identificador gerado no aparelho (modo campo offline). Evita duplicar a OS em reenvio.';
