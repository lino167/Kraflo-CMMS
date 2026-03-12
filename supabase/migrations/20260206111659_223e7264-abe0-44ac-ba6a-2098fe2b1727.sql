
-- Função para classificar retroativamente OSs por pattern matching
CREATE OR REPLACE FUNCTION public.classificar_os_retroativo(p_empresa_id uuid)
RETURNS TABLE(os_id bigint, cat_parada_nome text, cat_problema_nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cat_parada RECORD;
  v_cat_problema RECORD;
  v_os RECORD;
  v_matched_parada_id uuid;
  v_matched_problema_id uuid;
  v_matched_parada_nome text;
  v_matched_problema_nome text;
  v_count int := 0;
BEGIN
  -- Classificar OSs sem categoria de parada
  FOR v_os IN 
    SELECT o.id, LOWER(COALESCE(o.descricao_problema, '')) as desc_lower, 
           LOWER(COALESCE(o.diagnostico_solucao, '')) as sol_lower
    FROM ordens_de_servico o
    WHERE o.empresa_id = p_empresa_id
  LOOP
    v_matched_parada_id := NULL;
    v_matched_problema_id := NULL;
    v_matched_parada_nome := NULL;
    v_matched_problema_nome := NULL;
    
    -- === CLASSIFICAÇÃO DE PARADA (abertura) ===
    IF v_os.desc_lower != '' THEN
      -- 1. Parada de Trama (mais específico primeiro)
      IF v_os.desc_lower ~ '(parada.*(de )?trama|ruptura.*(de )?trama|trama.*romp|trama.*paran|acumulador|bico.*inserção|inserção.*trama)' THEN
        SELECT id INTO v_matched_parada_id FROM categorias_parada 
        WHERE empresa_id = p_empresa_id AND nome = 'Parada de Trama' AND ativo = true;
        v_matched_parada_nome := 'Parada de Trama';
      
      -- 2. Parada de Urdume
      ELSIF v_os.desc_lower ~ '(lamela|urdume|baixando.*lamela|fio.*partido|fio.*rompendo|parada falsa)' THEN
        SELECT id INTO v_matched_parada_id FROM categorias_parada 
        WHERE empresa_id = p_empresa_id AND nome = 'Parada de Urdume' AND ativo = true;
        v_matched_parada_nome := 'Parada de Urdume';
      
      -- 3. Qualidade / Tecido
      ELSIF v_os.desc_lower ~ '(auréola|felpa|buraco|fio.*puxado|contaminação|listra|laço|barra.*decorativa|qualidade|tecido.*rasg|defeito.*tecido|densidade)' THEN
        SELECT id INTO v_matched_parada_id FROM categorias_parada 
        WHERE empresa_id = p_empresa_id AND nome ILIKE 'Qualidade%' AND ativo = true;
        v_matched_parada_nome := 'Qualidade / Tecido';
      
      -- 4. Falha Mecânica
      ELSIF v_os.desc_lower ~ '(liço.*quebr|correia.*romp|balança|giro.*não|sola.*desgast|pinça.*desgast|cilindro.*espinho|parafuso.*quebr|tesoura.*sem.*corte|puxador|mola.*quebr|engrenagem|rolamento)' THEN
        SELECT id INTO v_matched_parada_id FROM categorias_parada 
        WHERE empresa_id = p_empresa_id AND nome = 'Falha Mecânica' AND ativo = true;
        v_matched_parada_nome := 'Falha Mecânica';

      -- 5. Elétrica / Eletrônica
      ELSIF v_os.desc_lower ~ '(sensor|placa|módulo|jacquard|painel|erro.*jm|elétric|eletrônic|display|programação)' THEN
        SELECT id INTO v_matched_parada_id FROM categorias_parada 
        WHERE empresa_id = p_empresa_id AND nome ILIKE 'Elétrica%' AND ativo = true;
        v_matched_parada_nome := 'Elétrica / Eletrônica';

      -- 6. Utilidades
      ELSIF v_os.desc_lower ~ '(ar.*comprimido|pneumátic|óleo|vácuo|vazamento|utilidad)' THEN
        SELECT id INTO v_matched_parada_id FROM categorias_parada 
        WHERE empresa_id = p_empresa_id AND nome = 'Utilidades' AND ativo = true;
        v_matched_parada_nome := 'Utilidades';

      -- 7. Fallback: Tesoura sem qualificação = Qualidade
      ELSIF v_os.desc_lower ~ '(tesoura)' THEN
        SELECT id INTO v_matched_parada_id FROM categorias_parada 
        WHERE empresa_id = p_empresa_id AND nome ILIKE 'Qualidade%' AND ativo = true;
        v_matched_parada_nome := 'Qualidade / Tecido';
      END IF;
    END IF;

    -- === CLASSIFICAÇÃO DE PROBLEMA (causa raiz / fechamento) ===
    IF v_os.sol_lower != '' THEN
      -- 1. Limpeza / Higiene (verificar antes de ajuste pois "limpeza" é mais específico)
      IF v_os.sol_lower ~ '(limpeza|resíduo|sujeir|mouse|rato|borra|fibra.*acumul|poeira)' 
         AND NOT v_os.sol_lower ~ '(troca|substitu)' THEN
        SELECT id INTO v_matched_problema_id FROM categorias_problema 
        WHERE empresa_id = p_empresa_id AND nome ILIKE 'Limpeza%' AND ativo = true;
        v_matched_problema_nome := 'Limpeza / Higiene';
      
      -- 2. Desgaste / Quebra (troca de peças)
      ELSIF v_os.sol_lower ~ '(troca|substitu|desgast|quebr|rompid|trocado|substituí|recolocad)' THEN
        SELECT id INTO v_matched_problema_id FROM categorias_problema 
        WHERE empresa_id = p_empresa_id AND nome ILIKE 'Desgaste%' AND ativo = true;
        v_matched_problema_nome := 'Desgaste / Quebra';
      
      -- 3. Falha Operacional (erro humano)
      ELSIF v_os.sol_lower ~ '(cruzado|passamento|invertid|incorret|operador|errado|não viu)' THEN
        SELECT id INTO v_matched_problema_id FROM categorias_problema 
        WHERE empresa_id = p_empresa_id AND nome = 'Falha Operacional' AND ativo = true;
        v_matched_problema_nome := 'Falha Operacional';
      
      -- 4. Elétrico / Sensor
      ELSIF v_os.sol_lower ~ '(placa|sensor.*defeito|conector|cabo.*rompid|reset.*erro|módulo.*substitu)' THEN
        SELECT id INTO v_matched_problema_id FROM categorias_problema 
        WHERE empresa_id = p_empresa_id AND nome ILIKE 'Elétrico%' AND ativo = true;
        v_matched_problema_nome := 'Elétrico / Sensor';
      
      -- 5. Matéria-Prima
      ELSIF v_os.sol_lower ~ '(fio.*podre|bobina.*defeito|matéria|fora.*especificação|emenda.*mal)' THEN
        SELECT id INTO v_matched_problema_id FROM categorias_problema 
        WHERE empresa_id = p_empresa_id AND nome ILIKE 'Matéria%' AND ativo = true;
        v_matched_problema_nome := 'Matéria-Prima';
      
      -- 6. Ajuste / Regulagem (fallback - mais genérico)
      ELSIF v_os.sol_lower ~ '(ajust|regulag|parâmetro|calibr|reposicion|sincronism|regulado|fixado|emenda|corrigid|conferid|reparo)' THEN
        SELECT id INTO v_matched_problema_id FROM categorias_problema 
        WHERE empresa_id = p_empresa_id AND nome ILIKE 'Ajuste%' AND ativo = true;
        v_matched_problema_nome := 'Ajuste / Regulagem';
      END IF;
    END IF;

    -- Atualizar OS se encontrou match
    IF v_matched_parada_id IS NOT NULL OR v_matched_problema_id IS NOT NULL THEN
      UPDATE ordens_de_servico SET
        categoria_parada_id = COALESCE(v_matched_parada_id, categoria_parada_id),
        categoria_problema_id = COALESCE(v_matched_problema_id, categoria_problema_id)
      WHERE id = v_os.id
        AND (
          (v_matched_parada_id IS NOT NULL AND categoria_parada_id IS NULL) OR
          (v_matched_problema_id IS NOT NULL AND categoria_problema_id IS NULL)
        );
      
      os_id := v_os.id;
      cat_parada_nome := v_matched_parada_nome;
      cat_problema_nome := v_matched_problema_nome;
      RETURN NEXT;
      v_count := v_count + 1;
    END IF;
  END LOOP;
END;
$function$;
