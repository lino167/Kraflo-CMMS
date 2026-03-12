import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildCorsHeaders,
  getServiceClient,
  extractAuthToken,
  getUserFromToken,
  assertAdmin,
  getClientIp,
} from "../_shared/auth.ts";

let corsHeaders: Record<string, string> = {};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateMap = new Map<string, { count: number; start: number }>();

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 768,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Embedding error:", response.status, errorText);
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
    const token = extractAuthToken(req);
    if (!token) {
      return new Response(JSON.stringify({ error: "Autenticação obrigatória" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = getServiceClient();
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const isAdmin = await assertAdmin(user.id);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas administradores podem indexar OS." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${correlationId}] Authenticated admin user:`, user.id, getClientIp(req));

    const now = Date.now();
    const rl = rateMap.get(user.id);
    if (!rl || now - rl.start > RATE_LIMIT_WINDOW_MS) {
      rateMap.set(user.id, { count: 1, start: now });
    } else {
      rl.count += 1;
      if (rl.count > RATE_LIMIT_MAX_REQUESTS) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido", correlation_id: correlationId }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      rateMap.set(user.id, rl);
    }

    const { ordem_id, index_all } = await req.json();

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // If specific ordem_id, index just that one
    if (ordem_id) {
      console.log(`Indexing OS #${ordem_id}`);

      const { data: os, error: osError } = await supabase
        .from("ordens_de_servico")
        .select("*")
        .eq("id", ordem_id)
        .single();

      if (osError || !os) {
        throw new Error(`OS ${ordem_id} não encontrada`);
      }

      // Build text to index
      const textoIndexado = [
        `Equipamento: ${os.equipamento_nome}`,
        os.equipamento_tag ? `Tag: ${os.equipamento_tag}` : "",
        os.localizacao ? `Localização: ${os.localizacao}` : "",
        os.tipo_manutencao ? `Tipo: ${os.tipo_manutencao}` : "",
        os.descricao_problema ? `Problema: ${os.descricao_problema}` : "",
        os.diagnostico_solucao ? `Diagnóstico/Solução: ${os.diagnostico_solucao}` : "",
        os.notas_finais ? `Notas: ${os.notas_finais}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const embedding = await generateEmbedding(textoIndexado);

      // Upsert embedding
      const { error: upsertError } = await supabase
        .from("os_embeddings")
        .upsert({
          ordem_id: os.id,
          texto_indexado: textoIndexado,
          embedding,
        }, {
          onConflict: "ordem_id",
        });

      if (upsertError) {
        throw upsertError;
      }

      return new Response(
        JSON.stringify({ success: true, indexed: 1, correlation_id: correlationId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Index all closed OS that don't have embeddings yet
    if (index_all) {
      console.log("Indexing all OS without embeddings...");

      // Get OS finalizadas that don't have embeddings (status "Liberado para produção" or "Fechada")
      const { data: ordensParaIndexar, error: queryError } = await supabase
        .from("ordens_de_servico")
        .select("*")
        .in("status_os", ["Fechada", "Liberado para produção"]);

      if (queryError) {
        throw queryError;
      }

      // Get existing embeddings
      const { data: existingEmbeddings } = await supabase
        .from("os_embeddings")
        .select("ordem_id");

      const existingIds = new Set(existingEmbeddings?.map((e) => e.ordem_id) || []);

      const ordensSemEmbedding = ordensParaIndexar?.filter(
        (os) => !existingIds.has(os.id)
      ) || [];

      console.log(`Found ${ordensSemEmbedding.length} OS to index`);

      let indexed = 0;
      let errors = 0;

      for (const os of ordensSemEmbedding) {
        try {
          const textoIndexado = [
            `Equipamento: ${os.equipamento_nome}`,
            os.equipamento_tag ? `Tag: ${os.equipamento_tag}` : "",
            os.localizacao ? `Localização: ${os.localizacao}` : "",
            os.tipo_manutencao ? `Tipo: ${os.tipo_manutencao}` : "",
            os.descricao_problema ? `Problema: ${os.descricao_problema}` : "",
            os.diagnostico_solucao ? `Diagnóstico/Solução: ${os.diagnostico_solucao}` : "",
            os.notas_finais ? `Notas: ${os.notas_finais}` : "",
          ]
            .filter(Boolean)
            .join("\n");

          const embedding = await generateEmbedding(textoIndexado);

          await supabase
            .from("os_embeddings")
            .insert({
              ordem_id: os.id,
              texto_indexado: textoIndexado,
              embedding,
            });

          indexed++;
          console.log(`Indexed OS #${os.id} (${indexed}/${ordensSemEmbedding.length})`);

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (err) {
          console.error(`Error indexing OS #${os.id}:`, err);
          errors++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          total: ordensSemEmbedding.length,
          indexed,
          errors,
          correlation_id: correlationId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Informe ordem_id ou index_all=true", correlation_id: correlationId }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in index-os:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
