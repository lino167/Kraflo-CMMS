/**
 * Edge Function: backfill-os-index
 * Enfileira todas as OS existentes para indexação (idempotente)
 * REQUER AUTENTICAÇÃO DE ADMINISTRADOR
 * 
 * Chamada: POST /functions/v1/backfill-os-index
 * Body: { empresa_id?: string, force_reindex?: boolean, embedding_version?: number }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_SIZE = 500;

interface BackfillParams {
  empresa_id?: string;
  force_reindex?: boolean;
  embedding_version?: number;
  status_filter?: string[];
}

// Helper functions for auth
function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  return authHeader.replace("Bearer ", "");
}

function isServiceRoleToken(token: string | null): boolean {
  return Boolean(token && token === SUPABASE_SERVICE_ROLE_KEY);
}

async function getUserFromToken(token: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return { user: null, error };
  return { user: data.user, error: null };
}

async function assertAdmin(userId: string): Promise<boolean> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: isAdminKraflo } = await supabase.rpc("is_admin_kraflo", {
    _user_id: userId,
  });
  
  if (isAdminKraflo) return true;
  
  const { data: hasAdminRole } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin_empresa",
  });
  
  return Boolean(hasAdminRole);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const correlationId = crypto.randomUUID();
  
  try {
    console.log(`[${correlationId}] Starting backfill...`);

    // === AUTHENTICATION CHECK ===
    const token = extractAuthToken(req);
    
    if (!token) {
      console.log(`[${correlationId}] No auth token provided`);
      return new Response(
        JSON.stringify({ error: "Autenticação obrigatória" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Allow service role (for cron jobs or internal calls)
    if (!isServiceRoleToken(token)) {
      const { user, error: authError } = await getUserFromToken(token);
      
      if (authError || !user) {
        console.log(`[${correlationId}] Invalid token`);
        return new Response(
          JSON.stringify({ error: "Token inválido ou expirado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify admin permissions
      const isAdmin = await assertAdmin(user.id);
      if (!isAdmin) {
        console.log(`[${correlationId}] User ${user.id} is not admin`);
        return new Response(
          JSON.stringify({ error: "Acesso negado. Apenas administradores." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[${correlationId}] Authenticated as admin: ${user.email}`);
    } else {
      console.log(`[${correlationId}] Authenticated via service role`);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse parameters
    let params: BackfillParams = {};
    if (req.method === "POST") {
      try {
        params = await req.json();
      } catch {
        // Use defaults
      }
    }

    const targetVersion = params.embedding_version || 1;
    const forceReindex = params.force_reindex || false;
    
    // Default: index only closed OS, but allow override
    const statusFilter = params.status_filter || ["Fechada", "Liberado para produção"];

    console.log(`[${correlationId}] Params: empresa=${params.empresa_id || 'all'}, force=${forceReindex}, version=${targetVersion}`);

    let totalEnqueued = 0;
    let totalSkipped = 0;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      // Build query for OS
      let query = supabase
        .from("ordens_de_servico")
        .select("id, empresa_id, index_status, embedding_version")
        .in("status_os", statusFilter)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (params.empresa_id) {
        query = query.eq("empresa_id", params.empresa_id);
      }

      const { data: ordens, error: queryError } = await query;

      if (queryError) {
        throw new Error(`Erro ao buscar OS: ${queryError.message}`);
      }

      if (!ordens || ordens.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`[${correlationId}] Page ${page + 1}: ${ordens.length} OS found`);

      // Get existing jobs for these OS at this version
      const osIds = ordens.map((o: { id: number }) => o.id);
      const { data: existingJobs } = await supabase
        .from("os_index_jobs")
        .select("os_id, status")
        .in("os_id", osIds)
        .eq("embedding_version", targetVersion);

      const existingJobMap = new Map(
        existingJobs?.map((j: { os_id: number; status: string }) => [j.os_id, j.status]) || []
      );

      // Filter OS that need to be enqueued
      const toEnqueue = ordens.filter((os: { id: number; embedding_version: number }) => {
        const existingStatus = existingJobMap.get(os.id);
        
        // Skip if already queued/running (unless force)
        if (!forceReindex && (existingStatus === "queued" || existingStatus === "running")) {
          return false;
        }
        
        // Skip if already indexed at this version (unless force)
        if (!forceReindex && existingStatus === "done" && os.embedding_version === targetVersion) {
          return false;
        }
        
        return true;
      });

      totalSkipped += ordens.length - toEnqueue.length;

      if (toEnqueue.length > 0) {
        // Batch insert jobs
        const jobsToInsert = toEnqueue.map((os: { id: number; empresa_id: string }) => ({
          empresa_id: os.empresa_id,
          os_id: os.id,
          status: "queued",
          embedding_version: targetVersion,
          next_run_at: new Date().toISOString(),
          attempts: 0,
        }));

        // Use upsert to handle conflicts
        const { error: insertError } = await supabase
          .from("os_index_jobs")
          .upsert(jobsToInsert, {
            onConflict: "os_id,embedding_version",
            ignoreDuplicates: false,
          });

        if (insertError) {
          console.error(`[${correlationId}] Insert error:`, insertError.message);
          // Continue anyway, some may have been inserted
        }

        // Update OS status to queued
        const osIdsToUpdate = toEnqueue.map((os: { id: number }) => os.id);
        await supabase
          .from("ordens_de_servico")
          .update({ 
            index_status: "queued",
            embedding_version: targetVersion 
          })
          .in("id", osIdsToUpdate);

        totalEnqueued += toEnqueue.length;
        console.log(`[${correlationId}] Enqueued ${toEnqueue.length} OS`);
      }

      // Check if there are more pages
      hasMore = ordens.length === PAGE_SIZE;
      page++;
    }

    const duration = Date.now() - startTime;
    console.log(`[${correlationId}] Backfill completed: ${totalEnqueued} enqueued, ${totalSkipped} skipped in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        enqueued: totalEnqueued,
        skipped: totalSkipped,
        pages_processed: page,
        embedding_version: targetVersion,
        duration_ms: duration,
        correlation_id: correlationId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno";
    console.error(`[${correlationId}] Error:`, errorMsg);
    
    return new Response(
      JSON.stringify({ 
        error: errorMsg, 
        correlation_id: correlationId 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
