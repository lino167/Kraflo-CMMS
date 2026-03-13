import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TimelineEvent {
  os_id: number;
  data_abertura: string;
  data_fechamento: string | null;
  descricao_problema: string | null;
  diagnostico_solucao: string | null;
  notas_finais: string | null;
  tecnico_nome: string | null;
  tipo_manutencao: string | null;
  status_os: string;
  horas_reparo: number | null;
  dias_desde_ultima_solucao: number | null;
  status_reincidencia: string;
}

export interface TagStats {
  tag: string;
  equipamento_nome: string | null;
  localizacao: string | null;
  total_os: number;
  os_abertas: number;
  os_fechadas: number;
  mttr_medio_horas: number | null;
  total_reincidencias_criticas: number;
  total_reincidencias_alerta: number;
  primeira_os: string | null;
  ultima_os: string | null;
  tipos_manutencao: Record<string, number> | null;
  tecnicos_frequentes: Array<{ nome: string; total: number }> | null;
}

export function useEquipmentHistory(empresaId: string | undefined, tag: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ["equipment-history", empresaId, tag, limit],
    queryFn: async (): Promise<TimelineEvent[]> => {
      if (!empresaId || !tag) return [];

      const { data, error } = await supabase.rpc("fn_get_tag_history", {
        p_empresa_id: empresaId,
        p_tag: tag,
        p_limit: limit,
      });

      if (error) {
        console.error("Error fetching equipment history:", error);
        throw error;
      }

      return (data as TimelineEvent[]) || [];
    },
    enabled: !!empresaId && !!tag,
  });
}

export function useEquipmentStats(empresaId: string | undefined, tag: string | undefined) {
  return useQuery({
    queryKey: ["equipment-stats", empresaId, tag],
    queryFn: async (): Promise<TagStats | null> => {
      if (!empresaId || !tag) return null;

      const { data, error } = await supabase.rpc("fn_get_tag_stats", {
        p_empresa_id: empresaId,
        p_tag: tag,
      });

      if (error) {
        console.error("Error fetching equipment stats:", error);
        throw error;
      }

      return data as unknown as TagStats;
    },
    enabled: !!empresaId && !!tag,
  });
}

export interface SuccessCase {
  os_id: number;
  equipamento_tag: string;
  equipamento_nome: string;
  descricao_problema: string;
  diagnostico_solucao: string;
  notas_finais: string | null;
  tecnico_nome: string;
  data_fechamento: string;
  horas_reparo: number | null;
  status_reincidencia?: string | null;
  dias_desde_ultima_solucao?: number | null;
}

export function useSuccessCases(
  empresaId: string | undefined, 
  limit = 5,
  startDate?: Date,
  endDate?: Date
) {
  return useQuery({
    queryKey: ["success-cases", empresaId, limit, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<SuccessCase[]> => {
      if (!empresaId) return [];

      // Busca OS fechadas - Sucesso = sem reincidência OU reincidência > 2 dias
      let query = supabase
        .from("v_tag_timeline")
        .select(`
          id,
          equipamento_tag,
          equipamento_nome,
          descricao_problema,
          diagnostico_solucao,
          notas_finais,
          tecnico_nome,
          data_fechamento,
          status_reincidencia,
          dias_desde_ultima_solucao
        `)
        .eq("empresa_id", empresaId)
        .eq("status_os", "Fechada")
        .not("equipamento_tag", "is", null)
        .not("descricao_problema", "is", null)
        .not("diagnostico_solucao", "is", null)
        .or("dias_desde_ultima_solucao.is.null,dias_desde_ultima_solucao.gt.2");

      if (startDate) {
        query = query.gte("data_fechamento", startDate.toISOString());
      }
      if (endDate) {
        query = query.lte("data_fechamento", endDate.toISOString());
      }

      const { data, error } = await query
        .order("data_fechamento", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error fetching success cases:", error);
        throw error;
      }

      return (data || []).map((os: any): SuccessCase => ({
        os_id: os.id,
        equipamento_tag: os.equipamento_tag || "N/A",
        equipamento_nome: os.equipamento_nome || "Equipamento",
        descricao_problema: os.descricao_problema || "N/A",
        diagnostico_solucao: os.diagnostico_solucao || "N/A",
        notas_finais: os.notas_finais,
        tecnico_nome: os.tecnico_nome || "Técnico",
        data_fechamento: os.data_fechamento,
        horas_reparo: null,
      }));
    },
    enabled: !!empresaId,
  });
}

export interface MonthlyStats {
  totalClosed: number;
  successCases: number;
  successRate: number;
}

export function useMonthlyStats(
  empresaId: string | undefined,
  startDate?: Date,
  endDate?: Date
) {
  return useQuery({
    queryKey: ["monthly-stats", empresaId, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<MonthlyStats> => {
      if (!empresaId) return { totalClosed: 0, successCases: 0, successRate: 0 };

      // Total de OS fechadas no período
      let closedQuery = supabase
        .from("v_tag_timeline")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("status_os", "Fechada");

      if (startDate) {
        closedQuery = closedQuery.gte("data_fechamento", startDate.toISOString());
      }
      if (endDate) {
        closedQuery = closedQuery.lte("data_fechamento", endDate.toISOString());
      }

      const { count: totalClosed, error: closedError } = await closedQuery;

      if (closedError) {
        console.error("Error fetching closed OS count:", closedError);
        throw closedError;
      }

      // Casos de sucesso: sem reincidência OU reincidência > 2 dias
      let successQuery = supabase
        .from("v_tag_timeline")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("status_os", "Fechada")
        .or("dias_desde_ultima_solucao.is.null,dias_desde_ultima_solucao.gt.2");

      if (startDate) {
        successQuery = successQuery.gte("data_fechamento", startDate.toISOString());
      }
      if (endDate) {
        successQuery = successQuery.lte("data_fechamento", endDate.toISOString());
      }

      const { count: successCases, error: successError } = await successQuery;

      if (successError) {
        console.error("Error fetching success cases count:", successError);
        throw successError;
      }

      const total = totalClosed || 0;
      const success = successCases || 0;
      const rate = total > 0 ? (success / total) * 100 : 0;

      return {
        totalClosed: total,
        successCases: success,
        successRate: Math.round(rate * 10) / 10,
      };
    },
    enabled: !!empresaId,
  });
}

export function useProblematicCases(
  empresaId: string | undefined,
  limit = 10,
  startDate?: Date,
  endDate?: Date
) {
  return useQuery({
    queryKey: ["problematic-cases", empresaId, limit, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<SuccessCase[]> => {
      if (!empresaId) return [];

      // Busca OS fechadas COM reincidência de até 2 dias
      let query = supabase
        .from("v_tag_timeline")
        .select(`
          id,
          equipamento_tag,
          equipamento_nome,
          descricao_problema,
          diagnostico_solucao,
          notas_finais,
          tecnico_nome,
          data_fechamento,
          status_reincidencia,
          dias_desde_ultima_solucao
        `)
        .eq("empresa_id", empresaId)
        .eq("status_os", "Fechada")
        .not("equipamento_tag", "is", null)
        .not("dias_desde_ultima_solucao", "is", null)
        .lte("dias_desde_ultima_solucao", 2);

      if (startDate) {
        query = query.gte("data_fechamento", startDate.toISOString());
      }
      if (endDate) {
        query = query.lte("data_fechamento", endDate.toISOString());
      }

      const { data, error } = await query
        .order("data_fechamento", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error fetching problematic cases:", error);
        throw error;
      }

      return (data || []).map((os: any): SuccessCase => ({
        os_id: os.id,
        equipamento_tag: os.equipamento_tag || "N/A",
        equipamento_nome: os.equipamento_nome || "Equipamento",
        descricao_problema: os.descricao_problema || "Problema não especificado",
        diagnostico_solucao: os.diagnostico_solucao || "Solução não especificada",
        notas_finais: os.notas_finais,
        tecnico_nome: os.tecnico_nome || "Técnico",
        data_fechamento: os.data_fechamento,
        horas_reparo: null,
        status_reincidencia: os.status_reincidencia,
        dias_desde_ultima_solucao: os.dias_desde_ultima_solucao,
      }));
    },
    enabled: !!empresaId,
  });
}

export function useEquipmentTags(empresaId: string | undefined) {
  return useQuery({
    queryKey: ["equipment-tags", empresaId],
    queryFn: async (): Promise<Array<{ tag: string; nome: string; total: number }>> => {
      if (!empresaId) return [];

      const { data, error } = await supabase
        .from("ordens_de_servico")
        .select("equipamento_tag, equipamento_nome")
        .eq("empresa_id", empresaId)
        .not("equipamento_tag", "is", null);

      if (error) {
        console.error("Error fetching equipment tags:", error);
        throw error;
      }

      // Agrupa por TAG
      const tagMap = new Map<string, { nome: string; total: number }>();
      (data || []).forEach((os) => {
        if (os.equipamento_tag) {
          const existing = tagMap.get(os.equipamento_tag);
          if (existing) {
            existing.total++;
          } else {
            tagMap.set(os.equipamento_tag, {
              nome: os.equipamento_nome,
              total: 1,
            });
          }
        }
      });

      return Array.from(tagMap.entries())
        .map(([tag, info]) => ({ tag, ...info }))
        .sort((a, b) => b.total - a.total);
    },
    enabled: !!empresaId,
  });
}
