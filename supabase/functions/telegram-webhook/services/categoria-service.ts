import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface Categoria {
  id: string
  nome: string
  descricao: string
  exemplos: string[]
  ordem: number
  ativo: boolean
}

export interface Subcategoria {
  id: string
  categoria_id: string
  tipo_categoria: 'parada' | 'problema'
  nome: string
  descricao: string
  exemplos: string[]
  ordem: number
  ativo: boolean
}

export async function getCategoriasParada(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from('categorias_parada')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .order('ordem')

  if (error) {
    console.error('Erro ao buscar categorias de parada:', error)
    return []
  }

  return data || []
}

export async function getCategoriasProblema(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from('categorias_problema')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .order('ordem')

  if (error) {
    console.error('Erro ao buscar categorias de problema:', error)
    return []
  }

  return data || []
}

export async function getSubcategorias(
  supabase: SupabaseClient,
  categoriaId: string,
  tipo: 'parada' | 'problema',
): Promise<Subcategoria[]> {
  const { data, error } = await supabase
    .from('subcategorias')
    .select('*')
    .eq('categoria_id', categoriaId)
    .eq('tipo_categoria', tipo)
    .eq('ativo', true)
    .order('ordem')

  if (error) {
    console.error('Erro ao buscar subcategorias:', error)
    return []
  }

  return data || []
}

export async function getCategoriaParadaNome(
  supabase: SupabaseClient,
  categoriaId: string,
): Promise<string> {
  const { data } = await supabase
    .from('categorias_parada')
    .select('nome')
    .eq('id', categoriaId)
    .single()

  return data?.nome || ''
}

export async function getCategoriaProblemaNome(
  supabase: SupabaseClient,
  categoriaId: string,
): Promise<string> {
  const { data } = await supabase
    .from('categorias_problema')
    .select('nome')
    .eq('id', categoriaId)
    .single()

  return data?.nome || ''
}

export async function getSubcategoriaNome(
  supabase: SupabaseClient,
  subcategoriaId: string,
): Promise<string> {
  const { data } = await supabase
    .from('subcategorias')
    .select('nome')
    .eq('id', subcategoriaId)
    .single()

  return data?.nome || ''
}
