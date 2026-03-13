import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../../../src/integrations/supabase/types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Period configurations
const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '14d': 14,
  '1m': 30,
  '3m': 90,
  '6m': 180,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user and empresa_id
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get empresa_id from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('id', user.id)
      .single();

    if (!profile?.empresa_id) {
      return new Response(JSON.stringify({ error: 'No empresa_id found for user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const empresaId = profile.empresa_id;

    // Parse request body
    const { period = '1m' } = await req.json().catch(() => ({}));
    const days = PERIOD_DAYS[period] || 30;
    
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const endDate = now;

    console.log(`[reports-summary] Generating report for empresa ${empresaId}, period: ${period} (${days} days)`);

    // Execute all queries in parallel for performance
    const [
      windowStatsResult,
      serviceTypeResult,
      criticalEquipmentResult,
      tagAnalysisResult,
      monthlyTrendResult,
      quarterlyTrendResult,
      yearlyTrendResult,
      benchmarksResult,
      indexingCoverageResult,
    ] = await Promise.all([
      // Window stats - aggregate from ordens_de_servico for the period
      supabase
        .from('ordens_de_servico')
        .select('id, status_os, data_abertura, data_fechamento, tipo_manutencao')
        .eq('empresa_id', empresaId)
        .gte('data_abertura', startDate.toISOString())
        .lte('data_abertura', endDate.toISOString()),

      // Service type breakdown
      supabase.rpc('get_service_type_breakdown', {
        p_empresa_id: empresaId,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      }),

      // Critical equipment (Top 10)
      supabase.rpc('get_critical_equipment', {
        p_empresa_id: empresaId,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
        p_limit: 10,
      }),

      // Tag analysis
      supabase.rpc('get_tag_analysis', {
        p_empresa_id: empresaId,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      }),

      // Monthly trend (12 months)
      supabase.rpc('get_monthly_trend', {
        p_empresa_id: empresaId,
        p_months: 12,
      }),

      // Quarterly trend (8 quarters)
      supabase.rpc('get_quarterly_trend', {
        p_empresa_id: empresaId,
        p_quarters: 8,
      }),

      // Yearly trend (3 years)
      supabase.rpc('get_yearly_trend', {
        p_empresa_id: empresaId,
        p_years: 3,
      }),

      // Benchmarks config
      supabase
        .from('config_benchmarks')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle(),

      // Indexing coverage
      supabase
        .from('ordens_de_servico')
        .select('id, index_status, embedding_version')
        .eq('empresa_id', empresaId)
        .gte('data_abertura', startDate.toISOString())
        .lte('data_abertura', endDate.toISOString()),
    ]);

    // Calculate window stats
    const osList = (windowStatsResult.data ?? []) as Database['public']['Tables']['ordens_de_servico']['Row'][];
    const totalOs = osList.length;
    const osFechadas = osList.filter((os) => os.status_os === 'Fechada').length;
    const osAbertas = totalOs - osFechadas;

    // Calculate MTTR (average repair time in hours)
    const closedWithDates = osList.filter(
      (os) => os.status_os === 'Fechada' && os.data_fechamento && os.data_abertura
    );
    
    let mttrHours = 0;
    if (closedWithDates.length > 0) {
      const totalRepairHours = closedWithDates.reduce((sum: number, os) => {
        const opened = new Date(os.data_abertura).getTime();
        const closed = new Date(os.data_fechamento).getTime();
        return sum + (closed - opened) / (1000 * 60 * 60);
      }, 0);
      mttrHours = totalRepairHours / closedWithDates.length;
    }

    // Resolution rate
    const resolutionRate = totalOs > 0 ? (osFechadas / totalOs) * 100 : 0;

    // Calculate indexing coverage
    const indexingList = (indexingCoverageResult.data ?? []) as Pick<
      Database['public']['Tables']['ordens_de_servico']['Row'],
      'id' | 'index_status' | 'embedding_version'
    >[];
    const totalForIndexing = indexingList.length;
    const indexed = indexingList.filter(
      (os) => os.index_status === 'indexed' && (os.embedding_version ?? 0) >= 1
    ).length;
    const indexingPercentage = totalForIndexing > 0 ? (indexed / totalForIndexing) * 100 : 0;

    // Build response
    const response = {
      period: {
        type: period,
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      windowStats: {
        totalOs,
        osFechadas,
        osAbertas,
        mttrHours: Math.round(mttrHours * 100) / 100,
        resolutionRate: Math.round(resolutionRate * 100) / 100,
      },
      serviceTypeBreakdown: serviceTypeResult.data || [],
      criticalEquipment: (criticalEquipmentResult.data || []).map((eq) => ({
        ...eq,
        total_falhas: Number(eq.total_falhas),
        mttr_hours: Math.round((Number(eq.mttr_hours) || 0) * 100) / 100,
        mtbf_days: Math.round((Number(eq.mtbf_days) || 0) * 100) / 100,
        reincidencia_30d: Math.round((Number(eq.reincidencia_30d) || 0) * 100) / 100,
        score_criticidade: Math.round((Number(eq.score_criticidade) || 0) * 100) / 100,
      })),
      tagAnalysis: (tagAnalysisResult.data || []).map((tag) => ({
        ...tag,
        total_os: Number(tag.total_os),
        mttr_avg: Math.round((Number(tag.mttr_avg) || 0) * 100) / 100,
      })),
      trends: {
        monthly: (monthlyTrendResult.data || []).map((m) => ({
          year: m.year,
          month: m.month,
          label: `${m.month}/${m.year}`,
          totalOs: Number(m.total_os),
          osFechadas: Number(m.os_fechadas),
          mttrHours: Math.round((Number(m.mttr_hours) || 0) * 100) / 100,
          resolutionRate: Math.round((Number(m.resolution_rate) || 0) * 100) / 100,
        })).reverse(),
        quarterly: (quarterlyTrendResult.data || []).map((q) => ({
          year: q.year,
          quarter: q.quarter,
          label: `T${q.quarter}/${q.year}`,
          totalOs: Number(q.total_os),
          osFechadas: Number(q.os_fechadas),
          mttrHours: Math.round((Number(q.mttr_hours) || 0) * 100) / 100,
          resolutionRate: Math.round((Number(q.resolution_rate) || 0) * 100) / 100,
        })).reverse(),
        yearly: (yearlyTrendResult.data || []).map((y) => ({
          year: y.year,
          label: String(y.year),
          totalOs: Number(y.total_os),
          osFechadas: Number(y.os_fechadas),
          mttrHours: Math.round((Number(y.mttr_hours) || 0) * 100) / 100,
          resolutionRate: Math.round((Number(y.resolution_rate) || 0) * 100) / 100,
        })).reverse(),
      },
      indexingCoverage: {
        total: totalForIndexing,
        indexed,
        percentage: Math.round(indexingPercentage * 100) / 100,
      },
      benchmarks: benchmarksResult.data || null,
      generatedAt: new Date().toISOString(),
    };

    console.log(`[reports-summary] Report generated successfully. Total OS: ${totalOs}, Critical equipment: ${response.criticalEquipment.length}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[reports-summary] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
