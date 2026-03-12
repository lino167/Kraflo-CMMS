/**
 * Hook para calcular benchmarks internos automaticamente
 * Usa a mediana dos últimos 6 meses da empresa como referência
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subMonths } from 'date-fns';
import { OSData } from '@/lib/report-types';

export interface InternalBenchmarks {
  mttrMediana: number;  // Mediana do MTTR nos últimos 6 meses (horas)
  mtbfMediana: number;  // Mediana do MTBF nos últimos 6 meses (dias)
  taxaResolucaoMediana: number; // Mediana da taxa de resolução
  osMediaMensal: number; // Média de OS por mês
  isConfigured: boolean; // Se existem metas configuradas manualmente
  configuredBenchmarks?: {
    mttrAlvoHoras: number;
    mtbfAlvoDias: number;
    taxaResolucaoAlvo: number;
  };
}

// Calcula a mediana de um array de números
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 
    ? sorted[mid] 
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface UseInternalBenchmarksOptions {
  empresaId?: string;
  enabled?: boolean;
}

export function useInternalBenchmarks({ empresaId, enabled = true }: UseInternalBenchmarksOptions) {
  return useQuery({
    queryKey: ['internal-benchmarks', empresaId],
    queryFn: async (): Promise<InternalBenchmarks> => {
      const now = new Date();
      const sixMonthsAgo = subMonths(now, 6);

      // Buscar benchmarks configurados (se existir)
      let configuredBenchmarks: InternalBenchmarks['configuredBenchmarks'] | undefined;
      let isConfigured = false;

      if (empresaId) {
        const { data: configData } = await supabase
          .from('config_benchmarks')
          .select('mttr_alvo_horas, mtbf_alvo_dias, taxa_resolucao_alvo')
          .eq('empresa_id', empresaId)
          .maybeSingle();

        if (configData && (configData.mttr_alvo_horas || configData.mtbf_alvo_dias || configData.taxa_resolucao_alvo)) {
          isConfigured = true;
          configuredBenchmarks = {
            mttrAlvoHoras: Number(configData.mttr_alvo_horas) || 0,
            mtbfAlvoDias: Number(configData.mtbf_alvo_dias) || 0,
            taxaResolucaoAlvo: Number(configData.taxa_resolucao_alvo) || 0,
          };
        }
      }

      // Buscar OS dos últimos 6 meses para calcular benchmarks internos
      let query = supabase
        .from('ordens_de_servico')
        .select('data_abertura, data_fechamento, status_os')
        .gte('data_abertura', sixMonthsAgo.toISOString())
        .lte('data_abertura', now.toISOString())
        .order('data_abertura', { ascending: true });

      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }

      const { data: osData, error } = await query;
      if (error) throw error;

      const osList = (osData || []) as Pick<OSData, 'data_abertura' | 'data_fechamento' | 'status_os'>[];

      if (osList.length === 0) {
        return {
          mttrMediana: 0,
          mtbfMediana: 0,
          taxaResolucaoMediana: 0,
          osMediaMensal: 0,
          isConfigured,
          configuredBenchmarks,
        };
      }

      // Agrupar por mês para calcular métricas mensais
      const monthlyData: Map<string, { 
        mttrList: number[]; 
        total: number; 
        fechadas: number;
        dates: Date[];
      }> = new Map();

      osList.forEach(os => {
        const abertura = new Date(os.data_abertura);
        const monthKey = `${abertura.getFullYear()}-${String(abertura.getMonth() + 1).padStart(2, '0')}`;
        
        const current = monthlyData.get(monthKey) || { 
          mttrList: [], 
          total: 0, 
          fechadas: 0,
          dates: [],
        };

        current.total++;
        current.dates.push(abertura);

        const isFechada = os.status_os === 'Fechada' || os.status_os === 'Liberado para produção';
        if (isFechada) {
          current.fechadas++;
          
          if (os.data_fechamento) {
            const fechamento = new Date(os.data_fechamento);
            const mttrHoras = (fechamento.getTime() - abertura.getTime()) / (1000 * 60 * 60);
            if (mttrHoras > 0 && mttrHoras < 720) { // Ignorar valores extremos (> 30 dias)
              current.mttrList.push(mttrHoras);
            }
          }
        }

        monthlyData.set(monthKey, current);
      });

      // Calcular métricas por mês
      const monthlyMttr: number[] = [];
      const monthlyMtbf: number[] = [];
      const monthlyTaxaResolucao: number[] = [];
      let totalOS = 0;

      monthlyData.forEach((data, _monthKey) => {
        if (data.mttrList.length > 0) {
          monthlyMttr.push(median(data.mttrList));
        }
        
        if (data.total > 1) {
          // MTBF = dias do mês / número de falhas
          monthlyMtbf.push(30 / data.total);
        }
        
        if (data.total > 0) {
          monthlyTaxaResolucao.push((data.fechadas / data.total) * 100);
        }

        totalOS += data.total;
      });

      const numMonths = monthlyData.size || 1;

      return {
        mttrMediana: Math.round(median(monthlyMttr) * 10) / 10,
        mtbfMediana: Math.round(median(monthlyMtbf) * 10) / 10,
        taxaResolucaoMediana: Math.round(median(monthlyTaxaResolucao) * 10) / 10,
        osMediaMensal: Math.round(totalOS / numMonths),
        isConfigured,
        configuredBenchmarks,
      };
    },
    enabled: enabled,
    staleTime: 1000 * 60 * 15, // 15 minutos
  });
}

/**
 * Calcula a variação percentual entre dois valores
 * Retorna positivo se o atual for maior, negativo se for menor
 */
export function calcVariation(current: number, baseline: number): number {
  if (baseline === 0) return 0;
  return Math.round(((current - baseline) / baseline) * 100 * 10) / 10;
}

/**
 * Determina se a variação é positiva ou negativa para a métrica
 * MTTR: menor é melhor (variação negativa = bom)
 * MTBF: maior é melhor (variação positiva = bom)
 * Taxa: maior é melhor (variação positiva = bom)
 */
export function isVariationGood(metric: 'mttr' | 'mtbf' | 'taxa', variation: number): boolean {
  if (metric === 'mttr') {
    return variation < 0; // MTTR menor é melhor
  }
  return variation > 0; // MTBF e Taxa maiores são melhores
}
