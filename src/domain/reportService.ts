import { supabase } from "@/integrations/supabase/client";
import { DeepReportData, DeepPeriodType } from "@/lib/report-types";

export class ReportService {
  static async getDeepReport(period: DeepPeriodType): Promise<DeepReportData> {
    const { data, error } = await supabase.functions.invoke('reports-summary', {
      body: { period },
    });

    if (error) throw error;
    if (!data) throw new Error("Nenhum dado retornado do relatório");
    
    return data as DeepReportData;
  }

  static async getBenchmarkConfig(empresaId: string) {
    const { data, error } = await supabase
      .from('config_benchmarks')
      .select('*')
      .eq('empresa_id', empresaId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }
}
