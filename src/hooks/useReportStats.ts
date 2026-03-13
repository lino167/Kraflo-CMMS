/**
 * Hook para estatísticas de relatório com cobertura de indexação
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, subMonths } from 'date-fns';
import { 
  PeriodType, 
  PERIOD_OPTIONS, 
  ReportData,
  OSData,
  BenchmarkConfig 
} from '@/lib/report-types';
import {
  computeEquipmentStats,
  computeTagStats,
  computeModelStats,
  computeIndexingCoverage,
  computePeriodMetrics,
} from '@/lib/report-utils';

function getDateRange(period: PeriodType): { startDate: Date; endDate: Date; days: number } {
  const now = new Date();
  const option = PERIOD_OPTIONS.find(p => p.value === period);
  const days = option?.days || 30;
  
  let startDate: Date;
  switch (period) {
    case '7dias':
      startDate = subDays(now, 7);
      break;
    case '2semanas':
      startDate = subDays(now, 14);
      break;
    case '1mes':
      startDate = subMonths(now, 1);
      break;
    case '3meses':
      startDate = subMonths(now, 3);
      break;
    case '6meses':
      startDate = subMonths(now, 6);
      break;
    default:
      startDate = subMonths(now, 1);
  }
  
  return { startDate, endDate: now, days };
}

interface UseReportStatsOptions {
  empresaId?: string;
  period: PeriodType;
  enabled?: boolean;
}

export function useReportStats({ empresaId, period, enabled = true }: UseReportStatsOptions) {
  return useQuery({
    queryKey: ['report-stats', empresaId, period],
    queryFn: async (): Promise<Omit<ReportData, 'analiseIA' | 'analiseIATexto' | 'geradoEm'>> => {
      const { startDate, endDate, days } = getDateRange(period);
      const periodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label || period;

      // Buscar OS do período
      let query = supabase
        .from('ordens_de_servico')
        .select('*')
        .gte('data_abertura', startDate.toISOString())
        .lte('data_abertura', endDate.toISOString())
        .order('data_abertura', { ascending: false });

      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }

      const { data: osData, error } = await query;
      if (error) throw error;

      const osList = (osData || []) as OSData[];

      // Buscar configuração de benchmarks
      let benchmarkConfig: BenchmarkConfig | undefined;
      if (empresaId) {
        const { data: configData } = await supabase
          .from('config_benchmarks')
          .select('*')
          .eq('empresa_id', empresaId)
          .maybeSingle();

        if (configData) {
          benchmarkConfig = {
            mttrAlvoHoras: Number(configData.mttr_alvo_horas),
            mtbfAlvoDias: Number(configData.mtbf_alvo_dias),
            taxaResolucaoAlvo: Number(configData.taxa_resolucao_alvo),
            pesoFalhas: Number(configData.peso_falhas),
            pesoReincidencia: Number(configData.peso_reincidencia),
            pesoMttr: Number(configData.peso_mttr),
          };
        }
      }

      // Calcular métricas
      const metricas = computePeriodMetrics(osList, days);
      const cobertura = computeIndexingCoverage(osList);
      const equipamentosCriticos = computeEquipmentStats(osList, days, benchmarkConfig);
      const problemasPorTag = computeTagStats(osList);
      const problemasPorModelo = computeModelStats(osList);

      return {
        periodo: {
          inicio: startDate.toLocaleDateString('pt-BR'),
          fim: endDate.toLocaleDateString('pt-BR'),
          label: periodLabel,
          startDate,
          endDate,
        },
        metricas,
        cobertura,
        equipamentosCriticos: equipamentosCriticos.slice(0, 10), // Top 10
        problemasPorTag: problemasPorTag.slice(0, 10),
        problemasPorModelo: problemasPorModelo.slice(0, 5),
      };
    },
    enabled: enabled && !!period,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

// Hook para buscar período anterior (para comparação)
export function usePreviousPeriodMetrics({ empresaId, period, enabled = true }: UseReportStatsOptions) {
  return useQuery({
    queryKey: ['report-stats-previous', empresaId, period],
    queryFn: async () => {
      const { days } = getDateRange(period);
      const now = new Date();
      const currentStart = subDays(now, days);
      const previousEnd = currentStart;
      const previousStart = subDays(previousEnd, days);

      let query = supabase
        .from('ordens_de_servico')
        .select('*')
        .gte('data_abertura', previousStart.toISOString())
        .lt('data_abertura', previousEnd.toISOString());

      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return computePeriodMetrics((data || []) as OSData[], days);
    },
    enabled: enabled && !!period,
    staleTime: 1000 * 60 * 10,
  });
}

// Hook para gerar análise IA
export function useAIAnalysis({ empresaId, enabled = true }: { empresaId?: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ['ai-analysis-config', empresaId],
    queryFn: async () => {
      // Placeholder - retorna configuração para chamada posterior
      return { ready: true };
    },
    enabled,
  });
}
