import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Types for the reports-summary response
export interface WindowStats {
  totalOs: number;
  osFechadas: number;
  osAbertas: number;
  mttrHours: number;
  resolutionRate: number;
}

export interface ServiceTypeBreakdown {
  tipo_servico: string;
  total_os: number;
  os_fechadas: number;
  mttr_avg: number;
  percentual: number;
}

export interface CriticalEquipment {
  equipamento_nome: string;
  equipamento_tag: string | null;
  setor: string | null;
  total_falhas: number;
  mttr_hours: number;
  mtbf_days: number;
  reincidencia_30d: number;
  score_criticidade: number;
}

export interface TagAnalysis {
  tag: string;
  total_os: number;
  mttr_avg: number;
  equipamentos: string[];
}

export interface TrendDataPoint {
  year: number;
  month?: number;
  quarter?: number;
  label: string;
  totalOs: number;
  osFechadas: number;
  mttrHours: number;
  resolutionRate: number;
}

export interface Trends {
  monthly: TrendDataPoint[];
  quarterly: TrendDataPoint[];
  yearly: TrendDataPoint[];
}

export interface IndexingCoverage {
  total: number;
  indexed: number;
  percentage: number;
}

export interface Benchmarks {
  id: string;
  empresa_id: string;
  mttr_alvo_horas: number | null;
  mtbf_alvo_dias: number | null;
  taxa_resolucao_alvo: number | null;
  peso_falhas: number | null;
  peso_reincidencia: number | null;
  peso_mttr: number | null;
}

export interface DeepReportData {
  period: {
    type: string;
    days: number;
    startDate: string;
    endDate: string;
  };
  windowStats: WindowStats;
  serviceTypeBreakdown: ServiceTypeBreakdown[];
  criticalEquipment: CriticalEquipment[];
  tagAnalysis: TagAnalysis[];
  trends: Trends;
  indexingCoverage: IndexingCoverage;
  benchmarks: Benchmarks | null;
  generatedAt: string;
}

export type DeepPeriodType = '7d' | '14d' | '1m' | '3m' | '6m';

export const DEEP_PERIOD_OPTIONS: { value: DeepPeriodType; label: string; days: number }[] = [
  { value: '7d', label: '7 Dias', days: 7 },
  { value: '14d', label: '2 Semanas', days: 14 },
  { value: '1m', label: '1 Mês', days: 30 },
  { value: '3m', label: '3 Meses', days: 90 },
  { value: '6m', label: '6 Meses', days: 180 },
];

interface UseDeepReportStatsOptions {
  period: DeepPeriodType;
  enabled?: boolean;
}

export function useDeepReportStats({ period, enabled = true }: UseDeepReportStatsOptions) {
  return useQuery({
    queryKey: ['deep-report-stats', period],
    queryFn: async (): Promise<DeepReportData> => {
      const { data, error } = await supabase.functions.invoke('reports-summary', {
        body: { period },
      });

      if (error) throw error;
      return data as DeepReportData;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (was cacheTime)
  });
}
