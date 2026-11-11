import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Camera, CheckCircle2, Clock, Loader2, Lock, Plus, RefreshCw, Trash2, Wifi, WifiOff, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { offlineQueue, secureStore } from '@/lib/offline/local'
import { compressPhoto } from '@/lib/offline/photo'
import { PinGate } from '@/components/PinGate'
import { readSnapshot, refreshSnapshot, type RefSnapshot } from '@/lib/offline/snapshot'
import type { OfflineOp, PecaOffline } from '@/lib/offline/queue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const TIPOS = ['Corretiva', 'Preventiva', 'Preditiva'] as const
const PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Urgente'] as const
const STATUS_FINAIS = ['Fechada', 'Liberado para produção', 'Não liberado'] as const

const selectClass =
  'h-11 w-full rounded-md border border-white/10 bg-secondary/30 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary'

type Tab = 'nova' | 'abertas' | 'pendencias'

/** OS mostrada na tela: pode ser do servidor ou ainda só no aparelho. */
interface OSView {
  key: string
  os_id: number | null
  os_client_uuid: string | null
  equipamento_nome: string
  equipamento_tag: string | null
  prioridade: string | null
  aguardando_envio: boolean
}

const emptyForm = {
  maquina_id: '',
  equipamento_manual: '',
  categoria_parada_id: '',
  subcategoria_parada_id: '',
  tipo_manutencao: 'Corretiva',
  prioridade: 'Média',
  localizacao: '',
  descricao_problema: '',
  tecnico_id: '',
  foto: null as string | null,
}

const emptyClose = {
  categoria_problema_id: '',
  subcategoria_problema_id: '',
  status_os: 'Fechada' as (typeof STATUS_FINAIS)[number],
  diagnostico_solucao: '',
  notas_finais: '',
  pecas: [] as PecaOffline[],
  peca_nome: '',
  peca_tag: '',
  peca_qtd: '1',
  peca_estoque_id: '',
  foto: null as string | null,
}

function statusLabel(op: OfflineOp): { text: string; className: string } {
  if (op.status === 'conflict') return { text: 'Conflito', className: 'border-red-500/30 text-red-400' }
  if (op.status === 'error') return { text: 'Erro', className: 'border-red-500/30 text-red-400' }
  return { text: 'Aguardando envio', className: 'border-yellow-500/30 text-yellow-400' }
}

function FotoField({ id, label, value, onPick, onClear }: {
  id: string
  label: string
  value: string | null
  onPick: (file: File | undefined) => void
  onClear: () => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {value ? (
        <div className="relative overflow-hidden rounded-md border border-white/10">
          <img src={value} alt="Foto anexada" className="h-40 w-full object-cover" />
          <Button type="button" size="icon" variant="secondary" aria-label="Remover foto" className="absolute right-2 top-2 h-8 w-8" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label htmlFor={id} className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-white/15 text-sm text-muted-foreground">
          <Camera className="h-4 w-4" /> Tirar ou escolher foto
          <input id={id} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      )}
    </div>
  )
}

export default function Campo() {
  const { profile, user } = useAuth()
  const empresaId = profile?.empresa_id ?? null
  const ownerId = user?.id ?? null
  const [unlocked, setUnlocked] = useState(secureStore.isUnlocked)
  const { online, ops: todasOps, syncing, lastReport, sync, refresh } = useOfflineSync(ownerId, unlocked)
  // Cada usuário vê e envia só os próprios lançamentos
  const ops = useMemo(() => todasOps.filter((o) => o.owner_id === ownerId), [todasOps, ownerId])
  const acessoExpirado = !online && !profile

  const [snap, setSnap] = useState<RefSnapshot | null>(null)
  const [tab, setTab] = useState<Tab>('nova')
  const [form, setForm] = useState(emptyForm)
  const [closing, setClosing] = useState<OSView | null>(null)
  const [closeForm, setCloseForm] = useState(emptyClose)

  // Dados de apoio: primeiro o que está no aparelho, depois atualiza se houver conexão
  useEffect(() => {
    if (!empresaId || !unlocked) return
    void readSnapshot(secureStore, empresaId).then((s) => s && setSnap(s))
  }, [empresaId, unlocked])

  const loadSnapshot = useCallback(async () => {
    if (!empresaId || !unlocked || !navigator.onLine) return
    try {
      setSnap(await refreshSnapshot(secureStore, empresaId))
    } catch (err) {
      console.warn('Não foi possível atualizar os dados de campo:', err)
    }
  }, [empresaId, unlocked])

  useEffect(() => {
    void loadSnapshot()
  }, [loadSnapshot, online])

  useEffect(() => {
    if (lastReport && lastReport.sent > 0) void loadSnapshot()
  }, [lastReport, loadSnapshot])

  // OS que já têm um fechamento pendente saem da lista de abertas
  const closedLocally = useMemo(() => {
    const keys = new Set<string | number>()
    for (const o of ops) {
      if (o.kind === 'close_os' && o.status === 'pending') {
        if (o.os_id != null) keys.add(o.os_id)
        if (o.os_client_uuid) keys.add(o.os_client_uuid)
      }
    }
    return keys
  }, [ops])

  const abertas: OSView[] = useMemo(() => {
    const local: OSView[] = ops
      .filter((o) => o.kind === 'open_os' && !closedLocally.has(o.open.client_uuid))
      .map((o) => ({
        key: `l${o.id}`,
        os_id: null,
        os_client_uuid: o.kind === 'open_os' ? o.open.client_uuid : null,
        equipamento_nome: o.kind === 'open_os' ? o.open.equipamento_nome : '',
        equipamento_tag: o.kind === 'open_os' ? o.open.equipamento_tag : null,
        prioridade: o.kind === 'open_os' ? o.open.prioridade : null,
        aguardando_envio: true,
      }))
    const server: OSView[] = (snap?.os_abertas ?? [])
      .filter((o) => !closedLocally.has(o.id) && !(o.client_uuid && closedLocally.has(o.client_uuid)))
      .map((o) => ({
        key: `s${o.id}`,
        os_id: o.id,
        os_client_uuid: o.client_uuid,
        equipamento_nome: o.equipamento_nome,
        equipamento_tag: o.equipamento_tag,
        prioridade: o.prioridade,
        aguardando_envio: false,
      }))
    return [...local, ...server]
  }, [ops, snap, closedLocally])

  const problemas = ops.filter((o) => o.status !== 'pending').length
  const pendentes = ops.length

  const subcategoriasParada = (snap?.subcategorias ?? []).filter(
    (s) => s.categoria_id === form.categoria_parada_id && s.tipo_categoria === 'parada',
  )
  const subcategoriasProblema = (snap?.subcategorias ?? []).filter(
    (s) => s.categoria_id === closeForm.categoria_problema_id && s.tipo_categoria === 'problema',
  )

  const precisaEscolherTecnico = profile?.id_telegram == null

  async function submitOpen(e: React.FormEvent) {
    e.preventDefault()
    if (!empresaId || !ownerId) return
    const maq = snap?.maquinas.find((m) => m.id === form.maquina_id)
    const equipamento = maq ? maq.nome : form.equipamento_manual.trim()
    const tecnicoId = profile?.id_telegram ?? Number(form.tecnico_id)

    if (!equipamento) return toast.error('Informe o equipamento.')
    if (!form.categoria_parada_id) return toast.error('Selecione o motivo da parada.')
    if (form.descricao_problema.trim().length < 5) return toast.error('Descreva o problema (mínimo de 5 caracteres).')
    if (!tecnicoId || Number.isNaN(tecnicoId)) return toast.error('Selecione o técnico responsável.')

    await offlineQueue.add({
      kind: 'open_os',
      open: {
        client_uuid: crypto.randomUUID(),
        empresa_id: empresaId,
        tecnico_id: tecnicoId,
        equipamento_nome: equipamento,
        equipamento_tag: maq?.tag ?? null,
        localizacao: form.localizacao.trim() || null,
        tipo_manutencao: form.tipo_manutencao,
        prioridade: form.prioridade,
        descricao_problema: form.descricao_problema.trim(),
        categoria_parada_id: form.categoria_parada_id,
        subcategoria_parada_id: form.subcategoria_parada_id || null,
        opened_at: new Date().toISOString(),
        foto: form.foto,
      },
    }, ownerId)

    setForm({ ...emptyForm, tecnico_id: form.tecnico_id })
    await refresh()
    setTab('abertas')
    toast.success(online ? 'OS salva. Enviando…' : 'OS salva no aparelho. Será enviada quando houver conexão.')
    if (online) void sync()
  }

  function addPeca() {
    const qtd = Math.floor(Number(closeForm.peca_qtd))
    if (!(qtd >= 1)) return toast.error('Quantidade deve ser pelo menos 1.')
    const item = snap?.pecas_estoque.find((x) => x.id === closeForm.peca_estoque_id)
    if (item) {
      const reservado = closeForm.pecas.filter((x) => x.peca_estoque_id === item.id).reduce((t, x) => t + x.quantidade, 0)
      if (qtd > item.quantidade - reservado) {
        return toast.error(`Saldo no aparelho: ${item.quantidade - reservado} ${item.unidade}.`)
      }
      setCloseForm({
        ...closeForm,
        pecas: [...closeForm.pecas, { nome_peca: item.nome, tag_peca: item.codigo, quantidade: qtd, peca_estoque_id: item.id }],
        peca_qtd: '1',
        peca_estoque_id: '',
      })
      return
    }
    if (!closeForm.peca_nome.trim()) return toast.error('Informe o nome da peça.')
    setCloseForm({
      ...closeForm,
      pecas: [
        ...closeForm.pecas,
        { nome_peca: closeForm.peca_nome.trim(), tag_peca: closeForm.peca_tag.trim() || null, quantidade: qtd, peca_estoque_id: null },
      ],
      peca_nome: '',
      peca_tag: '',
      peca_qtd: '1',
      peca_estoque_id: '',
    })
  }

  async function submitClose(e: React.FormEvent) {
    e.preventDefault()
    if (!closing || !ownerId || !empresaId) return
    if (!closeForm.categoria_problema_id) return toast.error('Selecione a causa raiz.')
    if (closeForm.diagnostico_solucao.trim().length < 5) return toast.error('Descreva o diagnóstico e a solução (mínimo de 5 caracteres).')

    await offlineQueue.add({
      kind: 'close_os',
      os_client_uuid: closing.os_client_uuid,
      os_id: closing.os_id,
      empresa_id: empresaId,
      foto: closeForm.foto,
      pecas: closeForm.pecas,
      close: {
        status_os: closeForm.status_os,
        diagnostico_solucao: closeForm.diagnostico_solucao.trim(),
        notas_finais: closeForm.notas_finais.trim() || null,
        categoria_problema_id: closeForm.categoria_problema_id,
        subcategoria_problema_id: closeForm.subcategoria_problema_id || null,
        closed_at: new Date().toISOString(),
      },
    }, ownerId)

    setClosing(null)
    setCloseForm(emptyClose)
    await refresh()
    toast.success(online ? 'OS fechada. Enviando…' : 'Fechamento salvo no aparelho. Será enviado com a conexão.')
    if (online) void sync()
  }

  async function discard(op: OfflineOp) {
    if (!window.confirm('Descartar este lançamento? Ele não será enviado ao servidor.')) return
    await offlineQueue.discard(op.id)
    await refresh()
  }

  async function retry(op: OfflineOp) {
    await offlineQueue.requeue(op.id)
    await refresh()
    if (online) void sync()
  }

  async function pickFoto(file: File | undefined, apply: (dataUrl: string) => void) {
    if (!file) return
    try {
      apply(await compressPhoto(file))
    } catch {
      toast.error('Não foi possível processar a foto.')
    }
  }

  const describe = (op: OfflineOp) =>
    op.kind === 'open_os'
      ? `Abertura: ${op.open.equipamento_nome}`
      : `Fechamento: ${op.os_id ? `OS #${op.os_id}` : 'OS aberta offline'}`

  if (!unlocked) {
    return <PinGate ownerId={ownerId} onUnlocked={() => setUnlocked(true)} />
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold uppercase tracking-tight">Modo Campo</h1>
          <p className="text-xs text-muted-foreground">
            {snap
              ? `Dados de apoio de ${new Date(snap.saved_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
              : 'Conecte-se uma vez para baixar máquinas e categorias.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className={online ? 'border-green-500/30 text-green-400' : 'border-yellow-500/30 text-yellow-400'}>
            {online ? <Wifi className="mr-1 h-3 w-3" /> : <WifiOff className="mr-1 h-3 w-3" />}
            {online ? 'Online' : 'Offline'}
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9"
            aria-label="Bloquear Modo Campo"
            onClick={() => {
              secureStore.lock()
              setSnap(null)
              setUnlocked(false)
            }}
          >
            <Lock className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="glass-panel border-white/5">
        <CardContent className="flex items-center justify-between gap-3 p-3">
          <div className="min-w-0 flex-1 text-sm">
            {pendentes === 0 ? (
              <span className="flex items-center gap-2 whitespace-nowrap text-green-400">
                <CheckCircle2 className="h-4 w-4" /> Tudo enviado
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-yellow-400">
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <Clock className="h-4 w-4" /> {pendentes} aguardando envio
                </span>
                {problemas > 0 && <span className="whitespace-nowrap text-red-400">· {problemas} com problema</span>}
              </span>
            )}
          </div>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => void sync()} disabled={!online || syncing}>
            {syncing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Sincronizar
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/5 bg-secondary/20 p-1">
        {(
          [
            ['nova', 'Nova OS'],
            ['abertas', `Abertas (${abertas.length})`],
            ['pendencias', `Envio (${pendentes})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`h-10 rounded-lg text-xs font-medium transition-colors ${
              tab === id ? 'bg-primary/20 text-primary' : 'text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {acessoExpirado && (
        <Card className="glass-panel border-red-500/30">
          <CardContent className="space-y-1 p-4 text-sm">
            <p className="font-medium text-red-300">Acesso offline indisponível</p>
            <p className="text-xs text-muted-foreground">
              Este aparelho não validou seu acesso com o servidor nos últimos 7 dias, ou você saiu da conta.
              Conecte-se à internet e entre novamente para continuar.
            </p>
          </CardContent>
        </Card>
      )}

      {tab === 'nova' && (
        <form onSubmit={submitOpen} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maquina">Máquina</Label>
            <select
              id="maquina"
              className={selectClass}
              value={form.maquina_id}
              onChange={(e) => {
                const m = snap?.maquinas.find((x) => x.id === e.target.value)
                setForm({ ...form, maquina_id: e.target.value, localizacao: m?.setor_nome ?? form.localizacao })
              }}
            >
              <option value="">Outra (digitar o nome)</option>
              {(snap?.maquinas ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.tag ? `${m.tag} — ` : ''}
                  {m.nome}
                </option>
              ))}
            </select>
            {!form.maquina_id && (
              <Input
                aria-label="Nome do equipamento"
                placeholder="Nome do equipamento"
                className="h-11"
                value={form.equipamento_manual}
                onChange={(e) => setForm({ ...form, equipamento_manual: e.target.value })}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria">Motivo da parada</Label>
            <select
              id="categoria"
              className={selectClass}
              value={form.categoria_parada_id}
              onChange={(e) => setForm({ ...form, categoria_parada_id: e.target.value, subcategoria_parada_id: '' })}
            >
              <option value="">Selecione…</option>
              {(snap?.categorias_parada ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {subcategoriasParada.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="sub-parada">Subcategoria (opcional)</Label>
              <select
                id="sub-parada"
                className={selectClass}
                value={form.subcategoria_parada_id}
                onChange={(e) => setForm({ ...form, subcategoria_parada_id: e.target.value })}
              >
                <option value="">Sem subcategoria</option>
                {subcategoriasParada.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <select id="tipo" className={selectClass} value={form.tipo_manutencao} onChange={(e) => setForm({ ...form, tipo_manutencao: e.target.value })}>
                {TIPOS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prioridade">Prioridade</Label>
              <select id="prioridade" className={selectClass} value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>
                {PRIORIDADES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {precisaEscolherTecnico && (
            <div className="space-y-2">
              <Label htmlFor="tecnico">Técnico responsável</Label>
              <select id="tecnico" className={selectClass} value={form.tecnico_id} onChange={(e) => setForm({ ...form, tecnico_id: e.target.value })}>
                <option value="">Selecione…</option>
                {(snap?.tecnicos ?? []).map((t) => (
                  <option key={t.id_telegram} value={t.id_telegram}>
                    {t.nome_completo}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="local">Local (opcional)</Label>
            <Input id="local" className="h-11" value={form.localizacao} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">O que aconteceu?</Label>
            <Textarea id="descricao" rows={4} value={form.descricao_problema} onChange={(e) => setForm({ ...form, descricao_problema: e.target.value })} />
          </div>

          <FotoField id="foto-abertura" label="Foto do problema (opcional)" value={form.foto} onPick={(f) => pickFoto(f, (d) => setForm((prev) => ({ ...prev, foto: d })))} onClear={() => setForm({ ...form, foto: null })} />

          <Button type="submit" className="h-12 w-full text-base" disabled={!snap || !profile}>
            <Plus className="mr-2 h-5 w-5" /> Salvar OS
          </Button>
          {!snap && (
            <p className="text-center text-xs text-muted-foreground">
              Sem dados de apoio no aparelho. Abra esta tela com internet uma vez.
            </p>
          )}
        </form>
      )}

      {tab === 'abertas' && (
        <div className="space-y-3">
          {abertas.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma OS aberta.</p>
          )}
          {abertas.map((os) => (
            <Card key={os.key} className="glass-panel border-white/5">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{os.equipamento_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {os.equipamento_tag ? `${os.equipamento_tag} · ` : ''}
                      {os.os_id ? `OS #${os.os_id}` : 'Sem número ainda'}
                      {os.prioridade ? ` · ${os.prioridade}` : ''}
                    </p>
                  </div>
                  {os.aguardando_envio && (
                    <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                      no aparelho
                    </Badge>
                  )}
                </div>
                <Button
                  className="h-11 w-full"
                  variant="outline"
                  onClick={() => {
                    setCloseForm(emptyClose)
                    setClosing(os)
                  }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Fechar OS
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === 'pendencias' && (
        <div className="space-y-3">
          {ops.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nada aguardando envio.</p>}
          {ops.map((op) => {
            const st = statusLabel(op)
            return (
              <Card key={op.id} className="glass-panel border-white/5">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{describe(op)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(op.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <Badge variant="outline" className={st.className}>
                      {st.text}
                    </Badge>
                  </div>
                  {op.message && (
                    <p className="flex items-start gap-2 text-xs text-red-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {op.message}
                    </p>
                  )}
                  {op.status !== 'pending' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => void retry(op)}>
                        Tentar de novo
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => void discard(op)}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Descartar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!closing} onOpenChange={(open) => !open && setClosing(null)}>
        <DialogContent className="glass-panel max-h-[90vh] overflow-y-auto border-white/10 sm:max-w-md">
          <form onSubmit={submitClose} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Fechar OS</DialogTitle>
              <DialogDescription>
                {closing?.equipamento_nome}
                {closing?.os_id ? ` · OS #${closing.os_id}` : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="causa">Causa raiz</Label>
              <select
                id="causa"
                className={selectClass}
                value={closeForm.categoria_problema_id}
                onChange={(e) => setCloseForm({ ...closeForm, categoria_problema_id: e.target.value, subcategoria_problema_id: '' })}
              >
                <option value="">Selecione…</option>
                {(snap?.categorias_problema ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {subcategoriasProblema.length > 0 && (
              <select
                aria-label="Subcategoria da causa"
                className={selectClass}
                value={closeForm.subcategoria_problema_id}
                onChange={(e) => setCloseForm({ ...closeForm, subcategoria_problema_id: e.target.value })}
              >
                <option value="">Sem subcategoria</option>
                {subcategoriasProblema.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            )}

            <div className="space-y-2">
              <Label htmlFor="diag">Diagnóstico e solução</Label>
              <Textarea id="diag" rows={3} value={closeForm.diagnostico_solucao} onChange={(e) => setCloseForm({ ...closeForm, diagnostico_solucao: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-final">Status final</Label>
              <select
                id="status-final"
                className={selectClass}
                value={closeForm.status_os}
                onChange={(e) => setCloseForm({ ...closeForm, status_os: e.target.value as (typeof STATUS_FINAIS)[number] })}
              >
                {STATUS_FINAIS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Peças usadas</Label>
              {closeForm.pecas.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-white/5 bg-secondary/20 p-2 text-sm">
                  <span>
                    {p.quantidade}× {p.nome_peca}
                    {p.tag_peca ? ` (${p.tag_peca})` : ''}
                    {p.peca_estoque_id ? ' · estoque' : ''}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remover ${p.nome_peca}`}
                    onClick={() => setCloseForm({ ...closeForm, pecas: closeForm.pecas.filter((_, j) => j !== i) })}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
              {(snap?.pecas_estoque.length ?? 0) > 0 && (
                <select
                  aria-label="Origem da peça"
                  className={selectClass}
                  value={closeForm.peca_estoque_id}
                  onChange={(e) => setCloseForm({ ...closeForm, peca_estoque_id: e.target.value })}
                >
                  <option value="">Peça avulsa (fora do estoque)</option>
                  {snap?.pecas_estoque.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nome} — {x.quantidade} {x.unidade}
                    </option>
                  ))}
                </select>
              )}
              <div className="grid grid-cols-6 gap-2">
                <Input aria-label="Nome da peça" placeholder="Peça" disabled={!!closeForm.peca_estoque_id} className="col-span-3 h-10" value={closeForm.peca_estoque_id ? (snap?.pecas_estoque.find((x) => x.id === closeForm.peca_estoque_id)?.nome ?? '') : closeForm.peca_nome} onChange={(e) => setCloseForm({ ...closeForm, peca_nome: e.target.value })} />
                <Input aria-label="Quantidade" type="number" min={1} className="col-span-1 h-10" value={closeForm.peca_qtd} onChange={(e) => setCloseForm({ ...closeForm, peca_qtd: e.target.value })} />
                <Button type="button" variant="secondary" className="col-span-2 h-10" onClick={addPeca}>
                  Adicionar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas finais (opcional)</Label>
              <Textarea id="notas" rows={2} value={closeForm.notas_finais} onChange={(e) => setCloseForm({ ...closeForm, notas_finais: e.target.value })} />
            </div>

            <FotoField id="foto-fechamento" label="Foto do serviço (opcional)" value={closeForm.foto} onPick={(f) => pickFoto(f, (d) => setCloseForm((prev) => ({ ...prev, foto: d })))} onClear={() => setCloseForm({ ...closeForm, foto: null })} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setClosing(null)}>
                Cancelar
              </Button>
              <Button type="submit" className="h-11">
                Fechar OS
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
