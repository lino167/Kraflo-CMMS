import { supabase } from '@/integrations/supabase/client'
import { getErrorMessage } from '@/lib/error-handler'
import type { Json } from '@/integrations/supabase/types'
import type { OfflineOp, SendResult } from '@/lib/offline/queue'

const ACTIVE_STATUSES: readonly string[] = ['Aberta', 'Em manutenção']
const BUCKET = 'anexos-os'

/**
 * Erros devolvidos pelo PostgREST/Postgres têm `code` (regra de negócio ou permissão).
 * Sem `code` é falha de transporte ou gateway: vale tentar de novo mais tarde.
 */
function classify(error: { code?: string; message?: string }): SendResult {
  if (error.code) return { kind: 'error', message: getErrorMessage(error) }
  return { kind: 'network' }
}

/** Envia uma operação da fila para o servidor. Nunca lança exceção. */
export async function sendOp(op: OfflineOp): Promise<SendResult> {
  try {
    return op.kind === 'open_os' ? await sendOpen(op) : await sendClose(op)
  } catch {
    return { kind: 'network' }
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = /data:(.*?);/.exec(head)?.[1] ?? 'image/jpeg'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

type UploadResult = { kind: 'ok'; url: string | null } | { kind: 'network' }

/**
 * Sobe a foto com caminho fixo por operação (reenvio sobrescreve, não duplica).
 * Falha de rede interrompe o envio para tentar depois. Se o servidor recusar a foto,
 * a OS segue sem ela: o registro da manutenção vale mais que o anexo.
 */
async function uploadFoto(dataUrl: string | null, path: string): Promise<UploadResult> {
  if (!dataUrl) return { kind: 'ok', url: null }
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, dataUrlToBlob(dataUrl), { upsert: true, contentType: 'image/jpeg' })
  if (error) {
    const status = (error as { statusCode?: string | number; status?: number }).statusCode ?? (error as { status?: number }).status
    if (status === undefined || status === null) return { kind: 'network' }
    console.warn('Foto recusada pelo servidor; OS enviada sem anexo:', error.message)
    return { kind: 'ok', url: null }
  }
  return { kind: 'ok', url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }
}

async function sendOpen(op: Extract<OfflineOp, { kind: 'open_os' }>): Promise<SendResult> {
  const o = op.open

  // Já chegou numa tentativa anterior (a resposta se perdeu)? Então não cria de novo.
  const { data: existing, error: selErr } = await supabase
    .from('ordens_de_servico')
    .select('id')
    .eq('client_uuid', o.client_uuid)
    .limit(1)
  if (selErr) return classify(selErr)
  if (existing && existing.length > 0) return { kind: 'ok' }

  const foto = await uploadFoto(o.foto, `${o.empresa_id}/campo_abertura_${o.client_uuid}.jpg`)
  if (foto.kind === 'network') return foto

  const { error } = await supabase.from('ordens_de_servico').insert({
    client_uuid: o.client_uuid,
    empresa_id: o.empresa_id,
    tecnico_id: o.tecnico_id,
    equipamento_nome: o.equipamento_nome,
    equipamento_tag: o.equipamento_tag,
    localizacao: o.localizacao,
    tipo_manutencao: o.tipo_manutencao,
    prioridade: o.prioridade,
    descricao_problema: o.descricao_problema,
    categoria_parada_id: o.categoria_parada_id,
    subcategoria_parada_id: o.subcategoria_parada_id,
    status_os: 'Aberta',
    origem: 'campo',
    data_abertura: o.opened_at,
    url_foto: foto.url,
  })
  if (error) {
    // Corrida com outra tentativa: a OS já existe, o resultado desejado foi atingido.
    if (error.code === '23505') return { kind: 'ok' }
    return classify(error)
  }
  return { kind: 'ok' }
}

async function sendClose(op: Extract<OfflineOp, { kind: 'close_os' }>): Promise<SendResult> {
  const c = op.close

  const foto = await uploadFoto(op.foto, `${op.empresa_id}/campo_fechamento_${op.id}.jpg`)
  if (foto.kind === 'network') return foto

  // Caminho principal: uma transação no servidor grava peças e fechamento juntos.
  const { data, error } = await supabase.rpc('fn_campo_fechar_os', {
    p_os_id: op.os_id,
    p_client_uuid: op.os_client_uuid,
    p_status: c.status_os,
    p_diagnostico: c.diagnostico_solucao,
    p_notas: c.notas_finais,
    p_categoria_problema_id: c.categoria_problema_id,
    p_subcategoria_problema_id: c.subcategoria_problema_id,
    p_closed_at: c.closed_at,
    p_pecas: op.pecas as unknown as Json,
    p_url_arquivo: foto.url,
  })

  if (!error) {
    const r = data as { result: 'ok' | 'conflict' | 'not_found'; id?: number; status?: string }
    if (r.result === 'ok') return { kind: 'ok' }
    if (r.result === 'conflict') {
      return { kind: 'conflict', message: `OS #${r.id} já está "${r.status}" no servidor` }
    }
    return {
      kind: 'error',
      message: op.os_id ? `OS #${op.os_id} não existe mais` : 'A OS aberta offline ainda não chegou ao servidor',
    }
  }

  // Banco ainda sem a função (migration não aplicada): usa o envio em etapas.
  if (error.code === 'PGRST202' || error.code === '42883') {
    return sendCloseLegacy(op, foto.url)
  }
  return classify(error)
}

async function sendCloseLegacy(
  op: Extract<OfflineOp, { kind: 'close_os' }>,
  urlArquivo: string | null,
): Promise<SendResult> {
  const c = op.close

  let osId = op.os_id
  if (osId == null) {
    if (!op.os_client_uuid) return { kind: 'error', message: 'OS sem identificação' }
    const { data, error } = await supabase
      .from('ordens_de_servico')
      .select('id')
      .eq('client_uuid', op.os_client_uuid)
      .limit(1)
    if (error) return classify(error)
    if (!data || data.length === 0) {
      return { kind: 'error', message: 'A OS aberta offline ainda não chegou ao servidor' }
    }
    osId = data[0].id
  }

  const { data: rows, error: readErr } = await supabase
    .from('ordens_de_servico')
    .select('status_os, diagnostico_solucao')
    .eq('id', osId)
    .limit(1)
  if (readErr) return classify(readErr)
  if (!rows || rows.length === 0) return { kind: 'error', message: `OS #${osId} não existe mais` }
  const current = rows[0]

  if (current.status_os === c.status_os && current.diagnostico_solucao === c.diagnostico_solucao) {
    return { kind: 'ok' }
  }
  if (!ACTIVE_STATUSES.includes(current.status_os)) {
    return { kind: 'conflict', message: `OS #${osId} já está "${current.status_os}" no servidor` }
  }

  // Peças precisam ser gravadas com a OS ainda ativa (regra de RLS), antes do fechamento.
  if (op.pecas.length > 0 && !op.parts_sent) {
    const { error } = await supabase.from('pecas_utilizadas').insert(
      op.pecas.map((p) => ({
        ordem_id: osId as number,
        nome_peca: p.nome_peca,
        tag_peca: p.tag_peca,
        quantidade: p.quantidade,
        ...(p.peca_estoque_id ? { peca_estoque_id: p.peca_estoque_id } : {}),
      })),
    )
    if (error) return classify(error)
  }

  const { data: updated, error: updErr } = await supabase
    .from('ordens_de_servico')
    .update({
      status_os: c.status_os,
      diagnostico_solucao: c.diagnostico_solucao,
      notas_finais: c.notas_finais,
      categoria_problema_id: c.categoria_problema_id,
      subcategoria_problema_id: c.subcategoria_problema_id,
      data_fechamento: c.closed_at,
      ...(urlArquivo ? { url_arquivo_fechamento: urlArquivo } : {}),
    })
    .eq('id', osId as number)
    .in('status_os', ACTIVE_STATUSES as ('Aberta' | 'Em manutenção')[])
    .select('id')
  // Peças já gravadas: se cair aqui por rede, não repetir na próxima tentativa
  if (updErr) return updErr.code ? classify(updErr) : { kind: 'network', patch: { parts_sent: true } }
  if (!updated || updated.length === 0) {
    return { kind: 'conflict', message: `OS #${osId} foi alterada no servidor enquanto estava offline` }
  }
  return { kind: 'ok' }
}
