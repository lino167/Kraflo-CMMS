/**
 * Mapeamento entre IDs hardcoded do categories.ts e UUIDs do banco
 *
 * PROBLEMA: O sistema antigo usa IDs texto ('parada_trama') mas o banco usa UUIDs
 * SOLUÇÃO: Mapear pelo NOME da categoria
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Cache de mapeamentos para evitar múltiplas queries
const categoryIdCache = new Map<string, string>();

/**
 * Converte ID texto hardcoded para UUID do banco
 * Busca pelo nome da categoria
 */
export async function resolveStopCategoryId(
  supabase: SupabaseClient,
  empresaId: string,
  hardcodedId: string
): Promise<string | null> {
  const cacheKey = `stop_${empresaId}_${hardcodedId}`;

  if (categoryIdCache.has(cacheKey)) {
    return categoryIdCache.get(cacheKey)!;
  }

  // Mapear ID hardcoded para nome
  const nameMap: Record<string, string> = {
    'parada_trama': 'Parada de Trama',
    'parada_urdume': 'Parada de Urdume',
    'falha_mecanica': 'Falha Mecânica',
    'qualidade_tecido': 'Qualidade/Tecido',
    'eletrica_eletronica': 'Elétrica/Eletrônica',
    'utilidades': 'Utilidades',
  };

  const nome = nameMap[hardcodedId];
  if (!nome) return null;

  const { data } = await supabase
    .from('categorias_parada')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('nome', nome)
    .eq('ativo', true)
    .single();

  if (data?.id) {
    categoryIdCache.set(cacheKey, data.id);
    return data.id;
  }

  return null;
}

/**
 * Converte ID texto hardcoded para UUID do banco (causa raiz)
 */
export async function resolveRootCauseId(
  supabase: SupabaseClient,
  empresaId: string,
  hardcodedId: string
): Promise<string | null> {
  const cacheKey = `cause_${empresaId}_${hardcodedId}`;

  if (categoryIdCache.has(cacheKey)) {
    return categoryIdCache.get(cacheKey)!;
  }

  const nameMap: Record<string, string> = {
    'ajuste_regulagem': 'Ajuste/Regulagem',
    'desgaste_quebra': 'Desgaste/Quebra',
    'limpeza_higiene': 'Limpeza/Higiene',
    'falha_operacional': 'Falha Operacional',
    'eletrico_sensor': 'Elétrico/Sensor',
    'materia_prima': 'Matéria-Prima',
  };

  const nome = nameMap[hardcodedId];
  if (!nome) return null;

  const { data } = await supabase
    .from('categorias_problema')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('nome', nome)
    .eq('ativo', true)
    .single();

  if (data?.id) {
    categoryIdCache.set(cacheKey, data.id);
    return data.id;
  }

  return null;
}
