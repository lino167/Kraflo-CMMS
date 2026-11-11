import { supabase } from '@/integrations/supabase/client'
import { getErrorMessage } from '@/lib/error-handler'
import type { OfflineOp, SendResult } from '@/lib/offline/queue'

const ACTIVE_STATUSES: readonly string[] = ['Aberta', 'Em manutenção']

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

  // Identifica a OS no servidor: direto pelo número, ou pelo identificador do aparelho
  // quando ela foi aberta offline e ainda não tinha número.
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

  // Já aplicado numa tentativa anterior: não repete.
  if (current.status_os === c.status_os && current.diagnostico_solucao === c.diagnostico_solucao) {
    return { kind: 'ok' }
  }
  if (!ACTIVE_STATUSES.includes(current.status_os)) {
    return {
      kind: 'conflict',
      message: `OS #${osId} já está "${current.status_os}" no servidor`,
    }
  }

  // Peças precisam ser gravadas com a OS ainda ativa (regra de RLS), antes do fechamento.
  if (op.pecas.length > 0 && !op.parts_sent) {
    const { error } = await supabase.from('pecas_utilizadas').insert(
      op.pecas.map((p) => ({
        ordem_id: osId as number,
        nome_peca: p.nome_peca,
        tag_peca: p.tag_peca,
        quantidade: p.quantidade,
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
    })
    .eq('id', osId as number)
    .in('status_os', ACTIVE_STATUSES as ('Aberta' | 'Em manutenção')[])
    .select('id')
  if (updErr) return classify(updErr)
  if (!updated || updated.length === 0) {
    return { kind: 'conflict', message: `OS #${osId} foi alterada no servidor enquanto estava offline` }
  }
  return { kind: 'ok' }
}
