/**
 * Edge Function: process-os-index-queue
 * Processa a fila de indexação de OS com paralelismo controlado e backoff
 * REQUER AUTENTICAÇÃO DE ADMINISTRADOR
 *
 * Chamada: POST /functions/v1/process-os-index-queue
 * Body: { batch_size?: number, concurrency?: number }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!

const DEFAULT_BATCH_SIZE = 3
const DEFAULT_CONCURRENCY = 1
const MAX_ATTEMPTS = 5
const BACKOFF_MINUTES = [5, 30, 120, 480, 1440] // 5min, 30min, 2h, 8h, 24h

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Helper functions for auth
function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  return authHeader.replace('Bearer ', '')
}

function isInternalToken(token: string | null): boolean {
  return Boolean(token && (token === SUPABASE_SERVICE_ROLE_KEY || token === SUPABASE_ANON_KEY))
}

async function getUserFromToken(token: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data, error } = await supabase.auth.getUser(token)
  if (error) return { user: null, error }
  return { user: data.user, error: null }
}

async function assertAdmin(userId: string): Promise<boolean> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: isAdminKraflo } = await supabase.rpc('is_admin_kraflo', {
    _user_id: userId,
  })

  if (isAdminKraflo) return true

  const { data: hasAdminRole } = await supabase.rpc('has_role', {
    _user_id: userId,
    _role: 'admin_empresa',
  })

  return Boolean(hasAdminRole)
}

interface IndexJob {
  id: string
  empresa_id: string
  os_id: number
  status: string
  attempts: number
  embedding_version: number
}

interface OSData {
  id: number
  empresa_id: string
  equipamento_nome: string
  equipamento_tag: string | null
  localizacao: string | null
  tipo_manutencao: string | null
  descricao_problema: string | null
  diagnostico_solucao: string | null
  notas_finais: string | null
  status_os: string
  embedding_version: number
}

// deno-lint-ignore no-explicit-any
type SupabaseClientAny = ReturnType<typeof createClient<any>>

// Generate embedding via Lovable AI Gateway using gemini-2.5-flash-lite
// Uses tool calling to extract structured embedding representation
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    'https://ai.gateway.lovable.dev/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Você é um gerador de embeddings semânticos para busca de ordens de serviço de manutenção industrial.
Analise o texto fornecido e gere um vetor de 768 dimensões que capture o significado semântico.
Os valores devem estar normalizados entre -1 e 1.
Foque em: equipamento, problema, solução, localização, tipo de manutenção.`,
          },
          {
            role: 'user',
            content: `Gere o embedding para o seguinte texto de ordem de serviço:\n\n${text}`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'store_embedding',
              description: 'Armazena o vetor de embedding gerado',
              parameters: {
                type: 'object',
                properties: {
                  embedding: {
                    type: 'array',
                    items: { type: 'number' },
                    description:
                      'Vetor de 768 dimensões com valores entre -1 e 1',
                  },
                },
                required: ['embedding'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: 'function',
          function: { name: 'store_embedding' },
        },
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Embedding API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()

  // Extract embedding from tool call
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
  if (!toolCall || toolCall.function.name !== 'store_embedding') {
    throw new Error('Resposta inesperada do modelo - tool call não encontrada')
  }

  const args = JSON.parse(toolCall.function.arguments)
  const embedding = args.embedding

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Embedding vazio ou inválido retornado pelo modelo')
  }

  // Pad or truncate to 768 dimensions
  const targetDim = 768
  let result = embedding.slice(0, targetDim)
  while (result.length < targetDim) {
    result.push(0)
  }

  // Normalize values to [-1, 1]
  result = result.map((v: number) => Math.max(-1, Math.min(1, Number(v) || 0)))

  return result
}

// Build indexed text from OS data
function buildIndexedText(os: OSData): string {
  return [
    `Equipamento: ${os.equipamento_nome}`,
    os.equipamento_tag ? `Tag: ${os.equipamento_tag}` : '',
    os.localizacao ? `Localização: ${os.localizacao}` : '',
    os.tipo_manutencao ? `Tipo: ${os.tipo_manutencao}` : '',
    os.descricao_problema ? `Problema: ${os.descricao_problema}` : '',
    os.diagnostico_solucao
      ? `Diagnóstico/Solução: ${os.diagnostico_solucao}`
      : '',
    os.notas_finais ? `Notas: ${os.notas_finais}` : '',
    `Status: ${os.status_os}`,
  ]
    .filter(Boolean)
    .join('\n')
}

// Process a single job
async function processJob(
  supabase: SupabaseClientAny,
  job: IndexJob,
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now()

  try {
    // Mark job as running
    await supabase
      .from('os_index_jobs')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', job.id)

    // Update OS status to indexing
    await supabase
      .from('ordens_de_servico')
      .update({ index_status: 'indexing' })
      .eq('id', job.os_id)

    // Fetch OS data
    const { data: os, error: osError } = await supabase
      .from('ordens_de_servico')
      .select('*')
      .eq('id', job.os_id)
      .single()

    if (osError || !os) {
      throw new Error(`OS ${job.os_id} não encontrada: ${osError?.message}`)
    }

    // Generate embedding
    const textoIndexado = buildIndexedText(os as OSData)
    const embedding = await generateEmbedding(textoIndexado)

    // Upsert embedding with empresa_id and version
    const { error: upsertError } = await supabase.from('os_embeddings').upsert(
      {
        ordem_id: os.id,
        empresa_id: os.empresa_id,
        texto_indexado: textoIndexado,
        embedding,
        embedding_version: job.embedding_version,
      },
      {
        onConflict: 'ordem_id',
      },
    )

    if (upsertError) {
      throw new Error(`Erro ao salvar embedding: ${upsertError.message}`)
    }

    // Mark job as done
    await supabase
      .from('os_index_jobs')
      .update({
        status: 'done',
        updated_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', job.id)

    // Update OS status to indexed
    await supabase
      .from('ordens_de_servico')
      .update({
        index_status: 'indexed',
        last_indexed_at: new Date().toISOString(),
        index_error: null,
      })
      .eq('id', job.os_id)

    const duration = Date.now() - startTime
    console.log(`✓ Job ${job.id} (OS #${job.os_id}) completed in ${duration}ms`)

    return { success: true }
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : 'Erro desconhecido'
    const newAttempts = job.attempts + 1

    // Calculate backoff
    const backoffMinutes =
      BACKOFF_MINUTES[Math.min(newAttempts - 1, BACKOFF_MINUTES.length - 1)]
    const nextRunAt = new Date(Date.now() + backoffMinutes * 60 * 1000)

    const newStatus = newAttempts >= MAX_ATTEMPTS ? 'error' : 'queued'

    // Update job with error
    await supabase
      .from('os_index_jobs')
      .update({
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        next_run_at: nextRunAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    // Update OS status
    await supabase
      .from('ordens_de_servico')
      .update({
        index_status: newStatus === 'error' ? 'error' : 'queued',
        index_error: errorMsg,
      })
      .eq('id', job.os_id)

    console.error(
      `✗ Job ${job.id} (OS #${job.os_id}) failed (attempt ${newAttempts}/${MAX_ATTEMPTS}): ${errorMsg}`,
    )

    return { success: false, error: errorMsg }
  }
}

// Process jobs with concurrency limit
async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  const executing: Promise<void>[] = []

  for (const item of items) {
    const promise = (async () => {
      const result = await processor(item)
      results.push(result)
    })()

    executing.push(promise)

    if (executing.length >= concurrency) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
  return results
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  const correlationId = crypto.randomUUID()

  try {
    console.log(`[${correlationId}] Starting queue processing...`)

    // === AUTHENTICATION CHECK ===
    const token = extractAuthToken(req)

    if (!token) {
      console.log(`[${correlationId}] No auth token provided`)
      return new Response(
        JSON.stringify({ error: 'Autenticação obrigatória' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Allow service role or anon key (for cron jobs or internal calls)
    if (!isInternalToken(token)) {
      const { user, error: authError } = await getUserFromToken(token)

      if (authError || !user) {
        console.log(`[${correlationId}] Invalid token`)
        return new Response(
          JSON.stringify({ error: 'Token inválido ou expirado' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      // Verify admin permissions
      const isAdmin = await assertAdmin(user.id)
      if (!isAdmin) {
        console.log(`[${correlationId}] User ${user.id} is not admin`)
        return new Response(
          JSON.stringify({ error: 'Acesso negado. Apenas administradores.' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      console.log(`[${correlationId}] Authenticated as admin: ${user.email}`)
    } else {
      console.log(`[${correlationId}] Authenticated via internal token (cron/service)`)
    }

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Parse optional parameters
    const batchSize = DEFAULT_BATCH_SIZE
    const concurrency = DEFAULT_CONCURRENCY

    // === AUTO-RESET STUCK RECORDS ===
    // Reset jobs stuck in "running" for more than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    
    const { data: stuckJobs } = await supabase
      .from('os_index_jobs')
      .update({ status: 'queued', next_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('status', 'running')
      .lt('updated_at', tenMinutesAgo)
      .select('id')

    if (stuckJobs && stuckJobs.length > 0) {
      console.log(`[${correlationId}] Reset ${stuckJobs.length} stuck running jobs back to queued`)
      
      // Also reset corresponding OS index_status
      for (const job of stuckJobs) {
        await supabase
          .from('os_index_jobs')
          .select('os_id')
          .eq('id', job.id)
          .single()
          .then(({ data }) => {
            if (data) {
              supabase
                .from('ordens_de_servico')
                .update({ index_status: 'queued' })
                .eq('id', data.os_id)
                .eq('index_status', 'indexing')
                .then(() => {})
            }
          })
      }
    }

    // Fetch queued jobs ready to run
    const { data: jobs, error: fetchError } = await supabase
      .from('os_index_jobs')
      .select('id, empresa_id, os_id, status, attempts, embedding_version')
      .eq('status', 'queued')
      .lte('next_run_at', new Date().toISOString())
      .order('next_run_at', { ascending: true })
      .limit(batchSize)

    if (fetchError) {
      throw new Error(`Erro ao buscar jobs: ${fetchError.message}`)
    }

    if (!jobs || jobs.length === 0) {
      console.log(`[${correlationId}] No jobs to process`)
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message: 'Nenhum job na fila',
          correlation_id: correlationId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    console.log(
      `[${correlationId}] Processing ${jobs.length} jobs with concurrency ${concurrency}...`,
    )

    // Process jobs with concurrency
    const results = await processWithConcurrency(
      jobs as IndexJob[],
      concurrency,
      (job) => processJob(supabase, job),
    )

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length
    const duration = Date.now() - startTime

    console.log(
      `[${correlationId}] Completed: ${successful} success, ${failed} failed in ${duration}ms`,
    )

    return new Response(
      JSON.stringify({
        success: true,
        processed: jobs.length,
        successful,
        failed,
        duration_ms: duration,
        correlation_id: correlationId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Erro interno'
    console.error(`[${correlationId}] Error:`, errorMsg)

    return new Response(
      JSON.stringify({
        error: errorMsg,
        correlation_id: correlationId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
