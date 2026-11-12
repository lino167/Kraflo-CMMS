/**
 * OS (Work Order) service - CRUD operations and business logic
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Database } from '../../_shared/database.types.ts';
import { OrdemDeServico, Peca } from '../telegram-types.ts';
import { logger } from '../infra/logger.ts';

export interface CreateOSData {
  tecnicoId: number;
  empresaId: string;
  equipamentoNome: string;
  equipamentoTag?: string | null;
  localizacao?: string | null;
  tipoManutencao?: string | null;
  prioridade?: string | null;
  descricaoProblema?: string | null;
  urlFoto?: string | null;
  // Categoria de parada (abertura)
  categoriaParadaId?: string | null;
  subcategoriaParadaId?: string | null;
}

export interface CloseOSData {
  osId: number;
  diagnosticoSolucao: string;
  statusOs: string;
  notasFinais?: string | null;
  urlArquivoFechamento?: string | null;
  parts?: Peca[];
  // Categoria de causa raiz (problema)
  categoriaProblemaId?: string | null;
  subcategoriaProblemaId?: string | null;
}

/**
 * Create a new work order
 */
export async function createOS(
  supabase: SupabaseClient<Database>,
  data: CreateOSData
): Promise<OrdemDeServico | null> {
  const insertData: Database['public']['Tables']['ordens_de_servico']['Insert'] = {
    tecnico_id: data.tecnicoId,
    empresa_id: data.empresaId,
    equipamento_nome: data.equipamentoNome,
    equipamento_tag: data.equipamentoTag,
    localizacao: data.localizacao,
    tipo_manutencao: data.tipoManutencao,
    prioridade: data.prioridade,
    descricao_problema: data.descricaoProblema,
    url_foto: data.urlFoto,
    status_os: 'Aberta',
    origem: 'telegram',
  };

  // Persistir categoria de parada se fornecida
  if (data.categoriaParadaId) {
    insertData.categoria_parada_id = data.categoriaParadaId;
  }
  if (data.subcategoriaParadaId) {
    insertData.subcategoria_parada_id = data.subcategoriaParadaId;
  }

  const { data: newOS, error } = await supabase
    .from('ordens_de_servico')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    logger.error('OS creation error', error);
    return null;
  }

  logger.osCreated(newOS.id, data.tecnicoId);
  return newOS;
}

/**
 * Close a work order
 */
export async function closeOS(
  supabase: SupabaseClient<Database>,
  data: CloseOSData
): Promise<boolean> {
  const updateData: Partial<Database['public']['Tables']['ordens_de_servico']['Update']> = {
    diagnostico_solucao: data.diagnosticoSolucao,
    status_os: data.statusOs,
    notas_finais: data.notasFinais || '',
    data_fechamento: new Date().toISOString(),
  };

  if (data.urlArquivoFechamento) {
    updateData.url_arquivo_fechamento = data.urlArquivoFechamento;
  }

  // Persistir categoria de causa raiz (problema)
  if (data.categoriaProblemaId) {
    updateData.categoria_problema_id = data.categoriaProblemaId;
  }
  if (data.subcategoriaProblemaId) {
    updateData.subcategoria_problema_id = data.subcategoriaProblemaId;
  }

  // Só fecha OS que ainda está ativa (evita sobrescrever um fechamento já feito)
  const { data: closed, error: osError } = await supabase
    .from('ordens_de_servico')
    .update(updateData)
    .eq('id', data.osId)
    .in('status_os', ['Aberta', 'Em manutenção'])
    .select('id');

  if (osError) {
    logger.error('Close OS error', osError, { osId: data.osId });
    return false;
  }
  if (!closed || closed.length === 0) {
    logger.warn('Close OS ignorado: OS não está mais ativa', { osId: data.osId });
    return false;
  }

  if (data.parts && data.parts.length > 0) {
    const { error: partsError } = await supabase.from('pecas_utilizadas').insert(
      data.parts.map((part) => ({
        ordem_id: data.osId,
        nome_peca: part.nome_peca,
        tag_peca: part.tag_peca,
        quantidade: part.quantidade,
      }))
    );
    if (partsError) {
      logger.error('Erro ao gravar peças do fechamento', partsError, { osId: data.osId });
    }
  }

  logger.osClosed(data.osId, 0); // TODO: pass userId
  return true;
}

/**
 * Update an OS field
 */
export async function updateOSField(
  supabase: SupabaseClient<Database>,
  osId: number,
  field: string,
  value: string
): Promise<boolean> {
  const { error } = await supabase
    .from('ordens_de_servico')
    .update({ [field]: value })
    .eq('id', osId);

  if (error) {
    logger.error('Update OS field error', error, { osId, field });
    return false;
  }
  return true;
}

/**
 * Delete an OS and its related parts
 */
export async function deleteOS(
  supabase: SupabaseClient<Database>,
  osId: number
): Promise<boolean> {
  // Delete related parts and pending index jobs first
  await supabase.from('pecas_utilizadas').delete().eq('ordem_id', osId);
  await supabase.from('os_index_jobs').delete().eq('os_id', osId);

  // Delete OS
  const { error } = await supabase
    .from('ordens_de_servico')
    .delete()
    .eq('id', osId);

  if (error) {
    logger.error('Delete OS error', error, { osId });
    return false;
  }

  logger.info('OS deleted', { osId });
  return true;
}

/**
 * Get open OS for a technician
 */
export async function getOpenOSByTechnician(
  supabase: SupabaseClient<Database>,
  tecnicoId: number,
  limit = 10
): Promise<OrdemDeServico[]> {
  const { data } = await supabase
    .from('ordens_de_servico')
    .select('*')
    .eq('tecnico_id', tecnicoId)
    .in('status_os', ['Aberta', 'Em manutenção'])
    .order('data_abertura', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Get OS list for a technician (all statuses)
 */
export async function getOSByTechnician(
  supabase: SupabaseClient<Database>,
  tecnicoId: number,
  limit = 10
): Promise<OrdemDeServico[]> {
  const { data } = await supabase
    .from('ordens_de_servico')
    .select('*')
    .eq('tecnico_id', tecnicoId)
    .order('data_abertura', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Get open OS for a company
 */
export async function getOpenOSByCompany(
  supabase: SupabaseClient<Database>,
  empresaId: string,
  limit = 20
): Promise<OrdemDeServico[]> {
  const { data } = await supabase
    .from('ordens_de_servico')
    .select('*')
    .eq('empresa_id', empresaId)
    .in('status_os', ['Aberta', 'Em manutenção'])
    .order('data_abertura', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Get closed OS for a company
 */
export async function getClosedOSByCompany(
  supabase: SupabaseClient<Database>,
  empresaId: string,
  limit = 20
): Promise<OrdemDeServico[]> {
  const { data } = await supabase
    .from('ordens_de_servico')
    .select('*')
    .eq('empresa_id', empresaId)
    .in('status_os', ['Fechada', 'Liberado para produção'])
    .order('data_fechamento', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Get a single OS by ID
 */
export async function getOSById(
  supabase: SupabaseClient<Database>,
  osId: number
): Promise<OrdemDeServico | null> {
  const { data } = await supabase
    .from('ordens_de_servico')
    .select('*')
    .eq('id', osId)
    .maybeSingle();

  return data;
}
