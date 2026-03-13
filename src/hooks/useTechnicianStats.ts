import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TechnicianPerformance {
  tecnico_id: number;
  nome_completo: string;
  empresa_id: string;
  funcao: string | null;
  setor: string | null;
  total_os_fechadas: number;
  mttr_medio_horas: number;
  quality_score: number;
  total_retrabalhos: number;
  os_por_tipo: Record<string, number>;
  os_heroi: Array<{
    os_id: number;
    equipamento_tag: string;
    horas_aberto: number;
    data_fechamento: string;
  }>;
  primeira_os: string | null;
  ultima_os: string | null;
}

export interface TeamMTTRComparison {
  tipo: string;
  meu_mttr: number;
  media_equipe: number;
  diferenca_percentual: number;
}

export function useTechnicianPerformance(empresaId: string | undefined, tecnicoId?: number) {
  return useQuery({
    queryKey: ["technician-performance", empresaId, tecnicoId],
    queryFn: async (): Promise<TechnicianPerformance | null> => {
      if (!empresaId) return null;

      // Query the view directly
      let query = supabase
        .from("v_technician_performance")
        .select("*")
        .eq("empresa_id", empresaId);

      if (tecnicoId) {
        query = query.eq("tecnico_id", tecnicoId);
      }

      const { data, error } = await query.limit(1).single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows returned
          return null;
        }
        console.error("Error fetching technician performance:", error);
        throw error;
      }

      return {
        ...data,
        os_por_tipo: (data.os_por_tipo as Record<string, number>) || {},
        os_heroi: (data.os_heroi as unknown as TechnicianPerformance["os_heroi"]) || [],
      } as TechnicianPerformance;
    },
    enabled: !!empresaId,
  });
}

export function useTeamPerformance(empresaId: string | undefined) {
  return useQuery({
    queryKey: ["team-performance", empresaId],
    queryFn: async (): Promise<TechnicianPerformance[]> => {
      if (!empresaId) return [];

      const { data, error } = await supabase
        .from("v_technician_performance")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("quality_score", { ascending: false });

      if (error) {
        console.error("Error fetching team performance:", error);
        throw error;
      }

      return (data || []).map((d) => ({
        ...d,
        os_por_tipo: (d.os_por_tipo as Record<string, number>) || {},
        os_heroi: (d.os_heroi as unknown as TechnicianPerformance["os_heroi"]) || [],
      })) as TechnicianPerformance[];
    },
    enabled: !!empresaId,
  });
}

export function useTeamMTTRComparison(
  empresaId: string | undefined,
  tecnicoId: number | undefined
) {
  return useQuery({
    queryKey: ["team-mttr-comparison", empresaId, tecnicoId],
    queryFn: async (): Promise<TeamMTTRComparison[]> => {
      if (!empresaId || !tecnicoId) return [];

      // Busca OS fechadas do técnico e da equipe
      const { data: osData, error } = await supabase
        .from("ordens_de_servico")
        .select("tecnico_id, tipo_manutencao, data_abertura, data_fechamento")
        .eq("empresa_id", empresaId)
        .in("status_os", ["Fechada", "Liberado para produção"])
        .not("data_fechamento", "is", null);

      if (error) {
        console.error("Error fetching MTTR comparison:", error);
        throw error;
      }

      // Calcula MTTR por tipo para o técnico e equipe
      const tipoMap = new Map<
        string,
        { meuTotal: number; meuCount: number; equipeTotal: number; equipeCount: number }
      >();

      (osData || []).forEach((os) => {
        if (!os.data_abertura || !os.data_fechamento) return;

        const tipo = os.tipo_manutencao || "Não especificado";
        const fecham = os.data_fechamento as string;
        const abertur = os.data_abertura as string;
        const horas =
          (new Date(fecham).getTime() - new Date(abertur).getTime()) /
          (1000 * 60 * 60);

        const existing = tipoMap.get(tipo) || {
          meuTotal: 0,
          meuCount: 0,
          equipeTotal: 0,
          equipeCount: 0,
        };

        if (os.tecnico_id === tecnicoId) {
          existing.meuTotal += horas;
          existing.meuCount++;
        }
        existing.equipeTotal += horas;
        existing.equipeCount++;

        tipoMap.set(tipo, existing);
      });

      return Array.from(tipoMap.entries())
        .filter(([_, v]) => v.meuCount > 0)
        .map(([tipo, v]) => {
          const meu_mttr = v.meuTotal / v.meuCount;
          const media_equipe = v.equipeTotal / v.equipeCount;
          return {
            tipo,
            meu_mttr: Math.round(meu_mttr * 10) / 10,
            media_equipe: Math.round(media_equipe * 10) / 10,
            diferenca_percentual: Math.round(((meu_mttr - media_equipe) / media_equipe) * 100),
          };
        })
        .sort((a, b) => a.diferenca_percentual - b.diferenca_percentual);
    },
    enabled: !!empresaId && !!tecnicoId,
  });
}

// Calcula Quality Score do técnico baseado em 5 dias de não-reincidência
export function useTechnicianQualityScore(
  empresaId: string | undefined,
  tecnicoId: number | undefined
) {
  return useQuery({
    queryKey: ["technician-quality-score", empresaId, tecnicoId],
    queryFn: async (): Promise<{ qualityScore: number; totalOS: number; successOS: number }> => {
      if (!empresaId || !tecnicoId) return { qualityScore: 0, totalOS: 0, successOS: 0 };

      // Busca todas as OS fechadas do técnico
      const { data, error } = await supabase
        .from("v_tag_timeline")
        .select("id, dias_desde_ultima_solucao")
        .eq("empresa_id", empresaId)
        .eq("tecnico_id", tecnicoId)
        .eq("status_os", "Fechada");

      if (error) {
        console.error("Error fetching quality score:", error);
        throw error;
      }

      const totalOS = data?.length || 0;
      // Sucesso = sem reincidência OU reincidência > 5 dias
      const successOS = (data || []).filter(
        (os) => os.dias_desde_ultima_solucao === null || os.dias_desde_ultima_solucao > 5
      ).length;

      const qualityScore = totalOS > 0 ? (successOS / totalOS) * 100 : 0;

      return {
        qualityScore: Math.round(qualityScore * 10) / 10,
        totalOS,
        successOS,
      };
    },
    enabled: !!empresaId && !!tecnicoId,
  });
}
