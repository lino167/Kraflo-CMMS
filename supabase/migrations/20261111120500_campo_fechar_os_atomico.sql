-- =====================================================================
-- Fechamento de OS em uma única transação (modo campo e reenvios).
-- Peças e fechamento são gravados juntos: ou tudo, ou nada.
-- Roda com o RLS de quem chama. Repetir a chamada não duplica nada.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_campo_fechar_os(
  p_os_id bigint,
  p_client_uuid uuid,
  p_status text,
  p_diagnostico text,
  p_notas text,
  p_categoria_problema_id uuid,
  p_subcategoria_problema_id uuid,
  p_closed_at timestamptz,
  p_pecas jsonb DEFAULT '[]'::jsonb,
  p_url_arquivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_os public.ordens_de_servico%ROWTYPE;
BEGIN
  IF p_status NOT IN ('Fechada', 'Liberado para produção', 'Não liberado') THEN
    RAISE EXCEPTION 'Status final inválido' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(coalesce(p_diagnostico, ''))) < 5 THEN
    RAISE EXCEPTION 'Informe o diagnóstico e a solução' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_os
  FROM public.ordens_de_servico
  WHERE (p_os_id IS NOT NULL AND id = p_os_id)
     OR (p_os_id IS NULL AND p_client_uuid IS NOT NULL AND client_uuid = p_client_uuid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'not_found');
  END IF;

  -- Mesma chamada repetida (resposta perdida na rede): já está aplicado
  IF v_os.status_os::text = p_status AND v_os.diagnostico_solucao = p_diagnostico THEN
    RETURN jsonb_build_object('result', 'ok', 'id', v_os.id);
  END IF;

  IF v_os.status_os NOT IN ('Aberta', 'Em manutenção') THEN
    RETURN jsonb_build_object('result', 'conflict', 'id', v_os.id, 'status', v_os.status_os::text);
  END IF;

  INSERT INTO public.pecas_utilizadas (ordem_id, nome_peca, tag_peca, quantidade, peca_estoque_id)
  SELECT v_os.id,
         btrim(x->>'nome_peca'),
         nullif(btrim(x->>'tag_peca'), ''),
         greatest((x->>'quantidade')::int, 1),
         nullif(x->>'peca_estoque_id', '')::uuid
  FROM jsonb_array_elements(coalesce(p_pecas, '[]'::jsonb)) x
  WHERE btrim(coalesce(x->>'nome_peca', '')) <> '';

  UPDATE public.ordens_de_servico
     SET status_os = p_status::public.os_status,
         diagnostico_solucao = p_diagnostico,
         notas_finais = p_notas,
         categoria_problema_id = p_categoria_problema_id,
         subcategoria_problema_id = p_subcategoria_problema_id,
         data_fechamento = coalesce(p_closed_at, now()),
         url_arquivo_fechamento = coalesce(p_url_arquivo, url_arquivo_fechamento)
   WHERE id = v_os.id;

  RETURN jsonb_build_object('result', 'ok', 'id', v_os.id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_campo_fechar_os(bigint, uuid, text, text, text, uuid, uuid, timestamptz, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_campo_fechar_os(bigint, uuid, text, text, text, uuid, uuid, timestamptz, jsonb, text) TO authenticated, service_role;
