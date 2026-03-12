-- ==========================================
-- FIX PRE-EXISTING SECURITY WARNINGS
-- ==========================================

-- ========== 1) Fix search_path for set_updated_at ==========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
begin
    new.updated_at := timezone('utc', now());
    return new;
end;
$function$;

-- ========== 2) Fix search_path for get_parts_history_by_company ==========
CREATE OR REPLACE FUNCTION public.get_parts_history_by_company(id_empresa uuid, search_query text DEFAULT NULL::text)
RETURNS TABLE(nome_peca text, tag_peca text, equipamento_nome text, data_uso timestamp with time zone)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
begin
    return query
    with ranked_parts as (
        select
            p.nome_peca,
            p.tag_peca,
            os.equipamento_nome,
            coalesce(os.data_fechamento, os.data_abertura) as data_uso,
            row_number() over (
                partition by p.nome_peca, p.tag_peca
                order by coalesce(os.data_fechamento, os.data_abertura) desc nulls last
            ) as rn
        from public.pecas_utilizadas p
        inner join public.ordens_de_servico os on os.id = p.ordem_id
        where os.empresa_id = id_empresa
          and (
              search_query is null
              or search_query = ''
              or p.nome_peca ilike '%' || search_query || '%'
              or coalesce(p.tag_peca, '') ilike '%' || search_query || '%'
          )
    )
    select
        ranked_parts.nome_peca,
        ranked_parts.tag_peca,
        ranked_parts.equipamento_nome,
        ranked_parts.data_uso
    from ranked_parts
    where rn = 1
    order by data_uso desc nulls last, ranked_parts.nome_peca;
end;
$function$;