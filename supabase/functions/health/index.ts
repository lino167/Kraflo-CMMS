import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, getServiceClient } from "../_shared/auth.ts";

let corsHeaders: Record<string, string> = {};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
    const supabase = getServiceClient();

    const envOk = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
    let dbOk = false;
    let companies = 0;

    const { data, error, count } = await supabase
      .from("empresas")
      .select("id", { count: "exact", head: true });

    if (!error) {
      dbOk = true;
      companies = count ?? 0;
    }

    return new Response(
      JSON.stringify({
        ok: envOk && dbOk,
        envOk,
        dbOk,
        companies,
        time: new Date().toISOString(),
        correlation_id: correlationId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
