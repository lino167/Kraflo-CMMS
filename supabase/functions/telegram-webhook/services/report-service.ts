/**
 * Report generation service
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Database } from '../../../src/integrations/supabase/types.ts';
import { OrdemDeServico } from '../telegram-types.ts';
import { logger } from '../infra/logger.ts';

export interface ReportStats {
  total: number;
  abertas: number;
  fechadas: number;
  corretivas: number;
  preventivas: number;
  urgentes: number;
  avgResolutionHours?: number;
}

export interface EquipmentStats {
  name: string;
  count: number;
}

/**
 * Get general report stats for a company
 */
export async function getGeneralStats(
  supabase: SupabaseClient<Database>,
  empresaId: string
): Promise<ReportStats | null> {
  const { data: allOS, error } = await supabase
    .from('ordens_de_servico')
    .select('*')
    .eq('empresa_id', empresaId);

  if (error || !allOS) {
    logger.error('Error fetching general stats', error, { empresaId });
    return null;
  }

  return {
    total: allOS.length,
    abertas: allOS.filter((os: OrdemDeServico) => os.status_os === 'Aberta' || os.status_os === 'Em manutenção').length,
    fechadas: allOS.filter((os: OrdemDeServico) => os.status_os === 'Fechada' || os.status_os === 'Liberado para produção' || os.status_os === 'Não liberado').length,
    corretivas: allOS.filter((os: OrdemDeServico) => os.tipo_manutencao === 'Corretiva').length,
    preventivas: allOS.filter((os: OrdemDeServico) => os.tipo_manutencao === 'Preventiva').length,
    urgentes: allOS.filter((os: OrdemDeServico) => os.prioridade === 'Urgente').length,
  };
}

/**
 * Get personal stats for a technician
 */
export async function getPersonalStats(
  supabase: SupabaseClient<Database>,
  tecnicoId: number
): Promise<ReportStats | null> {
  const { data: myOS, error } = await supabase
    .from('ordens_de_servico')
    .select('*')
    .eq('tecnico_id', tecnicoId);

  if (error || !myOS) {
    logger.error('Error fetching personal stats', error, { tecnicoId });
    return null;
  }

  const total = myOS.length;
  const abertas = myOS.filter((os: OrdemDeServico) => os.status_os === 'Aberta' || os.status_os === 'Em manutenção').length;
  const fechadas = total - abertas;

  // Calculate average resolution time
  const closedWithTime = myOS.filter((os: OrdemDeServico) => os.data_fechamento);
  let avgResolutionHours: number | undefined;
  
  if (closedWithTime.length > 0) {
    const totalHours = closedWithTime.reduce((acc: number, os: OrdemDeServico) => {
      const open = new Date(os.data_abertura).getTime();
      const close = new Date(os.data_fechamento!).getTime();
      return acc + (close - open) / (1000 * 60 * 60);
    }, 0);
    avgResolutionHours = Math.round(totalHours / closedWithTime.length);
  }

  return {
    total,
    abertas,
    fechadas,
    corretivas: myOS.filter((os: OrdemDeServico) => os.tipo_manutencao === 'Corretiva').length,
    preventivas: myOS.filter((os: OrdemDeServico) => os.tipo_manutencao === 'Preventiva').length,
    urgentes: myOS.filter((os: OrdemDeServico) => os.prioridade === 'Urgente').length,
    avgResolutionHours,
  };
}

/**
 * Get OS by equipment name search
 */
export async function getOSByEquipment(
  supabase: SupabaseClient<Database>,
  empresaId: string,
  equipmentName: string,
  limit = 15
): Promise<OrdemDeServico[]> {
  const { data, error } = await supabase
    .from('ordens_de_servico')
    .select('*')
    .eq('empresa_id', empresaId)
    .ilike('equipamento_nome', `%${equipmentName}%`)
    .order('data_abertura', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Error fetching OS by equipment', error, { empresaId, equipmentName });
    return [];
  }

  return data || [];
}

/**
 * Get stats for the last 30 days
 */
export async function getLast30DaysStats(
  supabase: SupabaseClient<Database>,
  empresaId: string
): Promise<{ stats: ReportStats; topEquipments: EquipmentStats[] } | null> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentOS, error } = await supabase
    .from('ordens_de_servico')
    .select('*')
    .eq('empresa_id', empresaId)
    .gte('data_abertura', thirtyDaysAgo.toISOString());

  if (error || !recentOS) {
    logger.error('Error fetching 30 days stats', error, { empresaId });
    return null;
  }

  const total = recentOS.length;
  const abertas = recentOS.filter((os: OrdemDeServico) => os.status_os === 'Aberta' || os.status_os === 'Em manutenção').length;

  // Most common equipment
  const equipCount: Record<string, number> = {};
  for (const os of recentOS) {
    equipCount[os.equipamento_nome] = (equipCount[os.equipamento_nome] || 0) + 1;
  }
  
  const topEquipments: EquipmentStats[] = Object.entries(equipCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    stats: {
      total,
      abertas,
      fechadas: total - abertas,
      corretivas: recentOS.filter((os: OrdemDeServico) => os.tipo_manutencao === 'Corretiva').length,
      preventivas: recentOS.filter((os: OrdemDeServico) => os.tipo_manutencao === 'Preventiva').length,
      urgentes: recentOS.filter((os: OrdemDeServico) => os.prioridade === 'Urgente').length,
    },
    topEquipments,
  };
}

/**
 * Get OS for a date range (for PDF report)
 */
export async function getOSByDateRange(
  supabase: SupabaseClient<Database>,
  empresaId: string,
  startDate: Date,
  endDate: Date
): Promise<OrdemDeServico[]> {
  const startIso = new Date(startDate.setHours(0, 0, 0, 0)).toISOString();
  const endIso = new Date(endDate.setHours(23, 59, 59, 999)).toISOString();

  const { data, error } = await supabase
    .from('ordens_de_servico')
    .select('*')
    .eq('empresa_id', empresaId)
    .gte('data_abertura', startIso)
    .lte('data_abertura', endIso)
    .order('data_abertura', { ascending: true });

  if (error) {
    logger.error('Error fetching OS by date range', error, { empresaId });
    return [];
  }

  return data || [];
}

/**
 * Search parts history by company
 */
export async function searchPartsHistory(
  supabase: SupabaseClient<Database>,
  empresaId: string,
  searchQuery: string
): Promise<
  Database['public']['Functions']['get_parts_history_by_company']['Returns'] | null
> {
  const { data, error } = await supabase.rpc('get_parts_history_by_company', {
    id_empresa: empresaId,
    search_query: searchQuery,
  });

  if (error) {
    logger.error('Error searching parts', error, { empresaId, searchQuery });
    return [];
  }

  return data || [];
}
