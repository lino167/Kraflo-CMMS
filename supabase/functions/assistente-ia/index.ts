import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildCorsHeaders,
  getServiceClient,
  extractAuthToken,
  isServiceRoleToken,
  getUserFromToken,
  getClientIp,
} from "../_shared/auth.ts";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateMap = new Map<string, { count: number; start: number }>();

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const USE_EMBEDDINGS = (Deno.env.get("USE_EMBEDDINGS") || "false").toLowerCase() === "true";

const SYSTEM_PROMPT = `Você é o Assistente de Manutenção Kraflo, um especialista técnico em manutenção industrial de teares.

Seu objetivo é ajudar técnicos a diagnosticar e resolver problemas em equipamentos industriais.

REGRAS:
1. Seja técnico e direto - os usuários são profissionais de manutenção
2. Quando citar informações dos manuais, mencione a página e o documento
3. Quando citar OS anteriores similares, mencione o equipamento e a solução aplicada
4. Se não tiver informação suficiente, peça mais detalhes sobre o problema
5. Priorize segurança - sempre mencione EPIs e procedimentos seguros quando relevante
6. Use linguagem técnica apropriada para manutenção industrial

FORMATO DE RESPOSTA:
- Use markdown para formatação
- Para procedimentos, use listas numeradas
- Para peças/ferramentas, use listas com bullet points
- Destaque avisos de segurança em negrito`;

const REPORT_SYSTEM_PROMPT = `Você é um especialista em manutenção industrial e análise de dados. Seu objetivo é analisar dados de manutenção e fornecer insights acionáveis.

IMPORTANTE: Você DEVE retornar APENAS um JSON válido, sem markdown, sem código, sem explicações adicionais.

O JSON deve seguir EXATAMENTE este schema:
{
  "executiveSummary": "string - resumo executivo de 2-3 parágrafos",
  "urgentRisks": [
    {
      "id": "string - ID único",
      "title": "string - título curto",
      "description": "string - descrição do risco",
      "equipamento": "string ou null",
      "severity": "critical | high | medium"
    }
  ],
  "recommendations": [
    {
      "id": "string - ID único",
      "title": "string - título da recomendação",
      "rationale": "string - justificativa baseada nos dados",
      "targetScope": "equipment | tag | model",
      "targetId": "string ou null",
      "targetValue": "string - nome do equipamento/tag/modelo",
      "suggestedIntervalDays": "number - intervalo sugerido para manutenção preventiva",
      "checklistSteps": ["string - passos do checklist"],
      "expectedImpact": {
        "mttrDown": "number ou null - % redução esperada no MTTR",
        "mtbfUp": "number ou null - % aumento esperado no MTBF"
      },
      "priority": "alta | media | baixa"
    }
  ],
  "nextPeriodForecast": "string - previsão para o próximo período",
  "benchmarkComparison": {
    "mttrVsAlvo": "number - % diferença vs alvo (negativo = melhor)",
    "mtbfVsAlvo": "number - % diferença vs alvo (positivo = melhor)",
    "taxaVsAlvo": "number - % diferença vs alvo (positivo = melhor)",
    "mttrVsPeriodoAnterior": "number ou null",
    "mtbfVsPeriodoAnterior": "number ou null"
  }
}

REGRAS:
1. Gere 3-5 recomendações ordenadas por prioridade
2. Cada recomendação deve ter 3-8 passos de checklist práticos
3. Baseie as recomendações nos dados fornecidos, não invente equipamentos
4. Seja específico nos impactos esperados (valores realistas: 5-30%)
5. Para urgentRisks, liste apenas problemas que requerem ação imediata
6. Compare com benchmarks apenas se valores de alvo forem fornecidos
7. NUNCA inclua markdown ou texto fora do JSON`;

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text, dimensions: 768 }),
  });
  if (!response.ok) {
    const err = await response.text();
    console.error("Embedding error:", response.status, err);
    throw new Error("Embedding API error");
  }
  const data = await response.json();
  return data.data[0].embedding;
}

// Text-based search fallback
async function searchByText(supabase: any, text: string, empresaId: string | null) {
  console.log("Searching by text:", text.substring(0, 100) + "...");
  
  // Extract keywords for search
  const keywords = text.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5);
  
  const searchPattern = keywords.join(" | ");
  
  // Search manuals by text content
  let manualQuery = supabase
    .from("manual_chunks")
    .select(`
      id,
      manual_id,
      conteudo,
      pagina,
      manuais!inner(nome_arquivo, equipamento_tipo, empresa_id)
    `)
    .textSearch("conteudo", searchPattern)
    .limit(5);
  
  if (empresaId) {
    manualQuery = manualQuery.eq("manuais.empresa_id", empresaId);
  }
  
  const { data: manualChunks, error: manualError } = await manualQuery;
  
  if (manualError) {
    console.error("Manual search error:", manualError);
  }
  
  // Search OS by text
  let osQuery = supabase
    .from("ordens_de_servico")
    .select("id, equipamento_nome, descricao_problema, diagnostico_solucao, notas_finais")
    .or(`descricao_problema.ilike.%${keywords[0] || ""}%,diagnostico_solucao.ilike.%${keywords[0] || ""}%`)
    .in("status_os", ["Fechada", "Liberado para produção"])
    .limit(5);
  
  if (empresaId) {
    osQuery = osQuery.eq("empresa_id", empresaId);
  }
  
  const { data: osSimilares, error: osError } = await osQuery;
  
  if (osError) {
    console.error("OS search error:", osError);
  }
  
  return {
    manualChunks: manualChunks?.map((c: any) => ({
      nome_arquivo: c.manuais?.nome_arquivo,
      equipamento_tipo: c.manuais?.equipamento_tipo,
      pagina: c.pagina,
      conteudo: c.conteudo,
    })) || [],
    osSimilares: osSimilares?.map((o: any) => ({
      ordem_id: o.id,
      equipamento_nome: o.equipamento_nome,
      descricao_problema: o.descricao_problema,
      diagnostico_solucao: o.diagnostico_solucao,
      notas_finais: o.notas_finais,
    })) || [],
  };
}

async function searchByEmbeddings(supabase: any, text: string, empresaId: string | null) {
  if (!LOVABLE_API_KEY || !USE_EMBEDDINGS) return { manualChunks: [], osSimilares: [] };
  const emb = await generateEmbedding(text);
  const embStr = JSON.stringify(emb);
  const { data: manualMatches } = await supabase.rpc("search_manual_chunks", {
    filter_empresa_id: empresaId || undefined,
    query_embedding: embStr,
    match_count: 5,
    match_threshold: 0.25,
  });
  const { data: osMatches } = await supabase.rpc("search_os_similares", {
    filter_empresa_id: empresaId || undefined,
    query_embedding: embStr,
    match_count: 5,
    match_threshold: 0.25,
  });
  return {
    manualChunks: (manualMatches || []).map((m: any) => ({
      nome_arquivo: m.nome_arquivo,
      equipamento_tipo: m.equipamento_tipo,
      pagina: m.pagina,
      conteudo: m.conteudo,
    })),
    osSimilares: (osMatches || []).map((o: any) => ({
      ordem_id: o.ordem_id,
      equipamento_nome: o.equipamento_nome,
      descricao_problema: o.descricao_problema,
      diagnostico_solucao: o.diagnostico_solucao,
      notas_finais: o.notas_finais,
    })),
  };
}

// Parse structured response for reports
function parseStructuredResponse(content: string): any | null {
  try {
    // Try direct JSON parse
    return JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        console.warn("Failed to parse JSON from code block");
      }
    }
    
    // Try to find JSON object in content
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        console.warn("Failed to parse JSON object from content");
      }
    }
    
    return null;
  }
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
    // Authentication check - require valid user session or service role
    const token = extractAuthToken(req);
    if (!token) {
      return new Response(JSON.stringify({ error: "Autenticação obrigatória" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = getServiceClient();
    
    // Check service role FIRST before trying to decode as user JWT
    const isServiceCall = isServiceRoleToken(token);
    let user = null;
    let authError = null;
    
    if (!isServiceCall) {
      const result = await getUserFromToken(token);
      user = result.user;
      authError = result.error;
      
      if (authError || !user) {
        console.error("Auth error:", authError);
        return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    
    const callerId = user?.id || `service:${getClientIp(req)}`;
    // Rate limiting
    const now = Date.now();
    const entry = rateMap.get(callerId);
    if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
      rateMap.set(callerId, { count: 1, start: now });
    } else {
      entry.count += 1;
      if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      rateMap.set(callerId, entry);
    }
    console.log(`[${correlationId}] Auth ok for`, callerId);

    const { 
      mensagem, 
      empresa_id, 
      conversa_id, 
      tecnico_id,
      // New parameters for structured report
      mode = 'chat', // 'chat' | 'report'
      reportData // Structured report data when mode === 'report'
    } = await req.json();

    if (!mensagem && mode !== 'report') {
      return new Response(JSON.stringify({ error: "Mensagem é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LOVABLE_API_KEY) {
      console.warn("LOVABLE_API_KEY não configurada, usando apenas busca textual");
    }

    // === REPORT MODE: Return structured JSON ===
    if (mode === 'report' && reportData) {
      console.log(`[${correlationId}] Report mode - generating structured analysis`);
      
      const reportPrompt = `Analise os seguintes dados de manutenção e retorne um JSON estruturado com recomendações acionáveis.

## DADOS DO PERÍODO (${reportData.periodo?.label || 'N/A'}):
- Total de OS: ${reportData.metricas?.totalOS || 0}
- OS fechadas: ${reportData.metricas?.osFechadas || 0}
- OS abertas: ${reportData.metricas?.osAbertas || 0}
- MTTR (Tempo Médio de Reparo): ${reportData.metricas?.mttr?.toFixed(1) || 0} horas
- MTBF (Tempo Médio Entre Falhas): ${reportData.metricas?.mtbf?.toFixed(1) || 0} dias
- Taxa de resolução: ${reportData.metricas?.taxaResolucao?.toFixed(1) || 0}%

${reportData.benchmarks ? `## BENCHMARKS CONFIGURADOS:
- MTTR Alvo: ${reportData.benchmarks.mttrAlvoHoras}h
- MTBF Alvo: ${reportData.benchmarks.mtbfAlvoDias} dias
- Taxa Resolução Alvo: ${reportData.benchmarks.taxaResolucaoAlvo}%` : ''}

${reportData.periodoAnterior ? `## COMPARATIVO COM PERÍODO ANTERIOR:
- MTTR anterior: ${reportData.periodoAnterior.mttr?.toFixed(1)}h
- MTBF anterior: ${reportData.periodoAnterior.mtbf?.toFixed(1)} dias` : ''}

## EQUIPAMENTOS CRÍTICOS (Top 10):
${(reportData.equipamentosCriticos || []).map((eq: any, i: number) => 
  `${i + 1}. ${eq.nome}${eq.tag ? ` (${eq.tag})` : ''}: ${eq.totalFalhas} falhas, MTTR ${eq.mttr}h, MTBF ${eq.mtbf}d, Reincidência ${eq.reincidencia}%, Status: ${eq.healthStatus}`
).join('\n') || 'Nenhum equipamento com falhas'}

## PROBLEMAS POR TAG:
${(reportData.problemasPorTag || []).map((t: any) => 
  `- ${t.tag}: ${t.totalFalhas} falhas, MTTR médio ${t.mttrMedio}h, Equipamentos: ${t.equipamentos.join(', ')}`
).join('\n') || 'Sem dados de tags'}

## PROBLEMAS POR MODELO:
${(reportData.problemasPorModelo || []).map((m: any) => 
  `- ${m.fabricante} ${m.modelo}: ${m.totalFalhas} falhas, MTTR médio ${m.mttrMedio}h`
).join('\n') || 'Sem dados de modelo'}

Gere o JSON estruturado com recomendações específicas e acionáveis baseadas nestes dados.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
          "x-correlation-id": correlationId,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: REPORT_SYSTEM_PROMPT },
            { role: "user", content: reportPrompt },
          ],
          max_tokens: 4000,
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos esgotados. Entre em contato com o administrador." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errorText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errorText);
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const rawContent = aiData.choices[0].message.content;
      
      console.log(`[${correlationId}] Raw AI response length: ${rawContent.length}`);
      
      // Try to parse structured response
      const structuredResponse = parseStructuredResponse(rawContent);
      
      if (structuredResponse) {
        console.log(`[${correlationId}] Successfully parsed structured response`);
        return new Response(
          JSON.stringify({
            success: true,
            structured: true,
            analiseIA: structuredResponse,
            correlation_id: correlationId,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else {
        // Fallback to text response
        console.warn(`[${correlationId}] Failed to parse structured response, returning text`);
        return new Response(
          JSON.stringify({
            success: true,
            structured: false,
            analiseIATexto: rawContent,
            correlation_id: correlationId,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // === CHAT MODE: Original behavior ===
    console.log("Processing message:", mensagem.substring(0, 100));

    let manualChunks: any[] = [];
    let osSimilares: any[] = [];
    try {
      const byEmb = await searchByEmbeddings(supabase, mensagem, empresa_id || null);
      manualChunks = byEmb.manualChunks;
      osSimilares = byEmb.osSimilares;
    } catch (e) {
      console.warn("Embeddings search failed, falling back:", e);
    }
    if (manualChunks.length === 0 && osSimilares.length === 0) {
      const byText = await searchByText(supabase, mensagem, empresa_id || null);
      manualChunks = byText.manualChunks;
      osSimilares = byText.osSimilares;
    }

    console.log(`Found ${manualChunks?.length || 0} manual chunks and ${osSimilares?.length || 0} similar OS`);

    // Build context from search results
    let contextManual = "";
    if (manualChunks && manualChunks.length > 0) {
      contextManual = "## INFORMAÇÕES DOS MANUAIS:\n\n";
      for (const chunk of manualChunks) {
        contextManual += `### ${chunk.nome_arquivo} (${chunk.equipamento_tipo || "Geral"}) - Página ${chunk.pagina || "N/A"}\n`;
        contextManual += `${chunk.conteudo}\n\n`;
      }
    }

    let contextOS = "";
    if (osSimilares && osSimilares.length > 0) {
      contextOS = "## ORDENS DE SERVIÇO SIMILARES JÁ RESOLVIDAS:\n\n";
      for (const os of osSimilares) {
        contextOS += `### OS #${os.ordem_id} - ${os.equipamento_nome}\n`;
        contextOS += `**Problema:** ${os.descricao_problema || "N/A"}\n`;
        contextOS += `**Diagnóstico/Solução:** ${os.diagnostico_solucao || "N/A"}\n`;
        if (os.notas_finais) {
          contextOS += `**Notas:** ${os.notas_finais}\n`;
        }
        contextOS += "\n";
      }
    }

    // Get conversation history if exists
    let conversationHistory: Array<{ role: string; content: string }> = [];
    if (conversa_id) {
      const { data: mensagens } = await supabase
        .from("ia_mensagens")
        .select("role, content")
        .eq("conversa_id", conversa_id)
        .order("created_at", { ascending: true })
        .limit(10);

      if (mensagens) {
        conversationHistory = mensagens.map((m) => ({
          role: m.role,
          content: m.content,
        }));
      }
    }

    // Build the user message with context
    const userMessageWithContext = `${contextManual}${contextOS}

## PERGUNTA DO TÉCNICO:
${mensagem}`;

    // Prepare messages for AI
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversationHistory,
      { role: "user", content: userMessageWithContext },
    ];

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Entre em contato com o administrador." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const resposta = aiData.choices[0].message.content;

    // Save conversation if empresa_id provided
    let novaConversaId = conversa_id;
    if (empresa_id) {
      // Create conversation if doesn't exist
      if (!conversa_id) {
        const { data: novaConversa, error: conversaError } = await supabase
          .from("ia_conversas")
          .insert({
            empresa_id,
            tecnico_id: tecnico_id || null,
          })
          .select("id")
          .single();

        if (conversaError) {
          console.error("Error creating conversation:", conversaError);
        } else {
          novaConversaId = novaConversa.id;
        }
      }

      // Save user message
      if (novaConversaId) {
        await supabase.from("ia_mensagens").insert({
          conversa_id: novaConversaId,
          role: "user",
          content: mensagem,
        });

        // Save assistant response with sources
        const fontes = {
          manuais: manualChunks?.map((c: { nome_arquivo: string; pagina: number; equipamento_tipo: string }) => ({
            arquivo: c.nome_arquivo,
            pagina: c.pagina,
            equipamento: c.equipamento_tipo,
          })) || [],
          os: osSimilares?.map((o: { ordem_id: number; equipamento_nome: string }) => ({
            ordem_id: o.ordem_id,
            equipamento: o.equipamento_nome,
          })) || [],
        };

        await supabase.from("ia_mensagens").insert({
          conversa_id: novaConversaId,
          role: "assistant",
          content: resposta,
          fontes,
        });
      }
    }

    console.log(`[${correlationId}] Response generated successfully`);

    return new Response(
      JSON.stringify({
        resposta,
        conversa_id: novaConversaId,
        fontes: {
          manuais_consultados: manualChunks?.length || 0,
          os_similares: osSimilares?.length || 0,
        },
        correlation_id: correlationId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in assistente-ia:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
