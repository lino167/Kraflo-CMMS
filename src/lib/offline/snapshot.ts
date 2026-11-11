import { supabase } from '@/integrations/supabase/client'
import type { KVStore } from '@/lib/offline/store'

/*
 * Dados de apoio guardados no aparelho para o modo campo funcionar sem conexão:
 * máquinas, categorias de parada e de causa, técnicos e as OS abertas da empresa.
 */

export interface MaquinaRef {
  id: string
  tag: string | null
  nome: string
  setor_nome: string | null
  criticidade: string
}

export interface CategoriaRef {
  id: string
  nome: string
}

export interface SubcategoriaRef extends CategoriaRef {
  categoria_id: string
  tipo_categoria: string
}

export interface TecnicoRef {
  id_telegram: number
  nome_completo: string
}

export interface OSAbertaRef {
  id: number
  client_uuid: string | null
  equipamento_nome: string
  equipamento_tag: string | null
  tipo_manutencao: string | null
  prioridade: string | null
  status_os: string
  data_abertura: string
}

export interface RefSnapshot {
  saved_at: string
  empresa_id: string
  maquinas: MaquinaRef[]
  categorias_parada: CategoriaRef[]
  categorias_problema: CategoriaRef[]
  subcategorias: SubcategoriaRef[]
  tecnicos: TecnicoRef[]
  os_abertas: OSAbertaRef[]
}

const SNAPSHOT_KEY = 'offline:snapshot:v1'

/** Baixa os dados de apoio do servidor. Lança erro se algo falhar (o cache anterior é mantido). */
export async function refreshSnapshot(store: KVStore, empresaId: string): Promise<RefSnapshot> {
  const [maq, cp, cpr, sub, tec, os] = await Promise.all([
    supabase
      .from('maquinas')
      .select('id, tag, nome, criticidade, setores(nome)')
      .eq('empresa_id', empresaId)
      .order('tag'),
    supabase.from('categorias_parada').select('id, nome').eq('ativo', true).order('ordem'),
    supabase.from('categorias_problema').select('id, nome').eq('ativo', true).order('ordem'),
    supabase
      .from('subcategorias')
      .select('id, nome, categoria_id, tipo_categoria')
      .eq('ativo', true)
      .order('ordem'),
    supabase
      .from('tecnicos')
      .select('id_telegram, nome_completo')
      .eq('empresa_id', empresaId)
      .order('nome_completo'),
    supabase
      .from('ordens_de_servico')
      .select('id, client_uuid, equipamento_nome, equipamento_tag, tipo_manutencao, prioridade, status_os, data_abertura')
      .eq('empresa_id', empresaId)
      .in('status_os', ['Aberta', 'Em manutenção'])
      .order('data_abertura', { ascending: false })
      .limit(200),
  ])

  for (const r of [maq, cp, cpr, sub, tec, os]) {
    if (r.error) throw r.error
  }

  const snapshot: RefSnapshot = {
    saved_at: new Date().toISOString(),
    empresa_id: empresaId,
    maquinas: (maq.data ?? []).map((m) => ({
      id: m.id,
      tag: m.tag,
      nome: m.nome,
      criticidade: m.criticidade,
      setor_nome: (m.setores as { nome: string } | null)?.nome ?? null,
    })),
    categorias_parada: cp.data ?? [],
    categorias_problema: cpr.data ?? [],
    subcategorias: (sub.data ?? []).map((s) => ({
      id: s.id,
      nome: s.nome,
      categoria_id: s.categoria_id,
      tipo_categoria: s.tipo_categoria,
    })),
    tecnicos: tec.data ?? [],
    os_abertas: os.data ?? [],
  }

  await store.set(SNAPSHOT_KEY, snapshot)
  return snapshot
}

/** Lê o último snapshot salvo no aparelho (pode ser de outra empresa, então confira). */
export async function readSnapshot(store: KVStore, empresaId: string): Promise<RefSnapshot | null> {
  const snap = await store.get<RefSnapshot>(SNAPSHOT_KEY)
  return snap && snap.empresa_id === empresaId ? snap : null
}
