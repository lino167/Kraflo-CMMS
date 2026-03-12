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
const RATE_LIMIT_MAX_REQUESTS = 20;
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

// Simple text chunker - splits by paragraphs and maintains ~500 token chunks
function chunkText(text: string, maxChunkSize: number = 1500): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;

    if (currentChunk.length + trimmedParagraph.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      // If single paragraph is too long, split it
      if (trimmedParagraph.length > maxChunkSize) {
        const sentences = trimmedParagraph.split(/(?<=[.!?])\s+/);
        currentChunk = "";
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > maxChunkSize) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
          } else {
            currentChunk += (currentChunk ? " " : "") + sentence;
          }
        }
      } else {
        currentChunk = trimmedParagraph;
      }
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmedParagraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
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
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas administradores podem fazer upload de manuais." }), {
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

    const body = await req.json();
    const { 
      filename, 
      texto_extraido, 
      equipamento_tipo, 
      total_paginas, 
      file_content,
      // Novos campos de classificação
      manual_type,
      category,
      tags,
      industry,
      fabricante,
      modelo,
      is_public,
    } = body;

    console.log(`[${correlationId}] Received request: filename=${filename}, textLength=${texto_extraido?.length || 0}, pages=${total_paginas}, type=${manual_type}, category=${category}`);

    if (!filename || !texto_extraido) {
      return new Response(
        JSON.stringify({ error: "filename e texto_extraido são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar campos obrigatórios de classificação
    if (!manual_type || !category) {
      return new Response(
        JSON.stringify({ error: "manual_type e category são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    if (texto_extraido.trim().length < 100) {
      throw new Error("Não foi possível extrair texto suficiente do PDF. O arquivo pode estar escaneado ou protegido.");
    }

    // Buscar empresa_id do usuário
    const { data: profile } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("id", user.id)
      .single();

    if (!profile?.empresa_id) {
      return new Response(
        JSON.stringify({ error: "Usuário não possui empresa associada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let url_arquivo = "";

    // Upload file to storage if provided
    if (file_content) {
      const filePath = `manuais/${Date.now()}_${filename}`;
      const binaryString = atob(file_content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from("anexos-os")
        .upload(filePath, bytes, {
          contentType: "application/pdf",
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        // Continue without file storage
      } else {
        const { data: publicUrlData } = supabase.storage
          .from("anexos-os")
          .getPublicUrl(filePath);
        url_arquivo = publicUrlData.publicUrl;
      }
    }

    // Create manual record com novos campos
    const { data: newManual, error: insertError } = await supabase
      .from("manuais")
      .insert({
        nome_arquivo: filename,
        url_arquivo: url_arquivo || `uploaded://${filename}`,
        equipamento_tipo: equipamento_tipo || null,
        total_paginas: total_paginas || null,
        processado: false,
        empresa_id: profile.empresa_id,
        // Novos campos de classificação
        manual_type: manual_type,
        category: category,
        tags: tags || [],
        industry: industry || null,
        fabricante: fabricante || null,
        modelo: modelo || null,
        is_public: is_public === true,
      })
      .select()
      .single();

    if (insertError || !newManual) {
      console.error("Insert error:", insertError);
      throw new Error("Erro ao criar registro do manual");
    }

    const manualId = newManual.id;
    console.log(`Created manual record: ${manualId}`);

    // Chunk the text
    const chunks = chunkText(texto_extraido);
    console.log(`Created ${chunks.length} chunks`);

    let processedChunks = 0;
    let errors = 0;

    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunk = chunks[i];
        const embedding = await generateEmbedding(chunk);

        await supabase.from("manual_chunks").insert({
          manual_id: manualId,
          conteudo: chunk,
          embedding,
          pagina: i + 1,
        });

        processedChunks++;
        console.log(`Processed chunk ${processedChunks}/${chunks.length}`);

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`Error processing chunk ${i}:`, err);
        errors++;
      }
    }

    // Mark manual as processed
    await supabase
      .from("manuais")
      .update({ processado: true })
      .eq("id", manualId);

    console.log(`Manual ${manualId} processed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        manual_id: manualId,
        total_chunks: chunks.length,
        chunks_created: processedChunks,
        errors,
        pages: total_paginas,
        correlation_id: correlationId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in upload-manual:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
