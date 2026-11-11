import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Edit2,
  History,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage } from '@/lib/error-handler'
import {
  formatBRL,
  formatQtd,
  movimentacaoSchema,
  nivelEstoque,
  pecaSchema,
  sugestaoReposicao,
  valorEmEstoque,
} from '@/lib/estoque'
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
import { EmptyState } from '@/components/EmptyState'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Peca = Database['public']['Tables']['pecas_estoque']['Row']
type Movimentacao = Database['public']['Tables']['movimentacoes_estoque']['Row']
type TipoMov = 'entrada' | 'saida' | 'ajuste'

const TIPO_LABEL: Record<TipoMov, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste de inventário',
}

function NivelBadge({ peca }: { peca: Peca }) {
  const nivel = nivelEstoque(peca)
  if (nivel === 'ok') return null
  return (
    <Badge
      variant="outline"
      className={
        nivel === 'zerado'
          ? 'border-red-500/30 bg-red-500/10 text-red-400'
          : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
      }
    >
      {nivel === 'zerado' ? 'Sem estoque' : 'Abaixo do mínimo'}
    </Badge>
  )
}

export default function Estoque() {
  const { profile, isAdminEmpresa, isAdminKraflo } = useAuth()
  const empresaId = profile?.empresa_id
  const podeGerenciar = isAdminEmpresa || isAdminKraflo
  const queryClient = useQueryClient()

  const [busca, setBusca] = useState('')
  const [somenteCriticos, setSomenteCriticos] = useState(false)
  const [pecaDialog, setPecaDialog] = useState<{ open: boolean; peca: Peca | null }>({ open: false, peca: null })
  const [movDialog, setMovDialog] = useState<{ peca: Peca; tipo: TipoMov } | null>(null)
  const [historicoPeca, setHistoricoPeca] = useState<Peca | null>(null)

  const { data: pecas = [], isLoading } = useQuery({
    queryKey: ['estoque', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pecas_estoque')
        .select('*')
        .eq('empresa_id', empresaId!)
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return data
    },
  })

  const { data: historico = [], isLoading: historicoLoading } = useQuery({
    queryKey: ['estoque-movimentacoes', historicoPeca?.id],
    enabled: !!historicoPeca,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('*')
        .eq('peca_id', historicoPeca!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as Movimentacao[]
    },
  })

  const criticos = useMemo(() => pecas.filter((p) => nivelEstoque(p) !== 'ok'), [pecas])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (somenteCriticos ? criticos : pecas).filter(
      (p) =>
        !termo ||
        p.nome.toLowerCase().includes(termo) ||
        (p.codigo ?? '').toLowerCase().includes(termo) ||
        (p.localizacao ?? '').toLowerCase().includes(termo),
    )
  }, [busca, somenteCriticos, criticos, pecas])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['estoque'] })
    queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] })
  }

  const salvarPeca = useMutation({
    mutationFn: async (form: FormData) => {
      if (!empresaId) throw new Error('Empresa não identificada')
      const parsed = pecaSchema.safeParse(Object.fromEntries(form))
      if (!parsed.success) throw new Error(parsed.error.issues[0].message)
      const valores = {
        codigo: parsed.data.codigo || null,
        nome: parsed.data.nome,
        unidade: parsed.data.unidade,
        estoque_minimo: parsed.data.estoque_minimo,
        localizacao: parsed.data.localizacao || null,
        fornecedor: parsed.data.fornecedor || null,
      }

      if (pecaDialog.peca) {
        const { error } = await supabase.from('pecas_estoque').update(valores).eq('id', pecaDialog.peca.id)
        if (error) throw error
        return
      }

      const { data: nova, error } = await supabase
        .from('pecas_estoque')
        .insert({ ...valores, empresa_id: empresaId, custo_unitario: parsed.data.custo_unitario })
        .select('id')
        .single()
      if (error) throw error

      // Saldo inicial entra como movimentação, para o razão começar completo
      const saldoInicial = Number(form.get('saldo_inicial') || 0)
      if (saldoInicial > 0) {
        const { error: movError } = await supabase.from('movimentacoes_estoque').insert({
          empresa_id: empresaId,
          peca_id: nova.id,
          tipo: 'entrada',
          quantidade: saldoInicial,
          custo_unitario: parsed.data.custo_unitario,
          observacao: 'Saldo inicial',
        })
        if (movError) throw movError
      }
    },
    onSuccess: () => {
      invalidate()
      setPecaDialog({ open: false, peca: null })
      toast.success('Peça salva')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const registrarMov = useMutation({
    mutationFn: async (form: FormData) => {
      if (!movDialog || !empresaId) throw new Error('Movimentação inválida')
      const parsed = movimentacaoSchema.safeParse({
        tipo: movDialog.tipo,
        quantidade: form.get('quantidade'),
        custo_unitario: form.get('custo_unitario') || undefined,
        observacao: form.get('observacao') || undefined,
        saldo_atual: movDialog.peca.quantidade,
      })
      if (!parsed.success) throw new Error(parsed.error.issues[0].message)

      const { error } = await supabase.from('movimentacoes_estoque').insert({
        empresa_id: empresaId,
        peca_id: movDialog.peca.id,
        tipo: parsed.data.tipo,
        quantidade: parsed.data.quantidade,
        custo_unitario: parsed.data.tipo === 'entrada' ? (parsed.data.custo_unitario ?? null) : null,
        observacao: parsed.data.observacao || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      setMovDialog(null)
      toast.success('Movimentação registrada')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/20 p-2">
            <Boxes className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold uppercase tracking-tight text-foreground">Estoque de Peças</h1>
            <p className="text-sm text-muted-foreground">
              Saldo, custo médio e ponto de reposição das peças de manutenção
            </p>
          </div>
        </div>
        {podeGerenciar && (
          <Button onClick={() => setPecaDialog({ open: true, peca: null })}>
            <Plus className="mr-2 h-4 w-4" /> Nova peça
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="glass-panel border-white/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Boxes className="h-5 w-5 text-primary" />
            <div>
              <p className="font-mono text-2xl font-bold">{pecas.length}</p>
              <p className="text-xs text-muted-foreground">Itens cadastrados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <p className="font-mono text-2xl font-bold">{formatBRL(valorEmEstoque(pecas))}</p>
              <p className="text-xs text-muted-foreground">Valor em estoque</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`glass-panel ${criticos.length ? 'border-yellow-500/30' : 'border-white/5'}`}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-5 w-5 ${criticos.length ? 'text-yellow-400' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-mono text-2xl font-bold">{criticos.length}</p>
                <p className="text-xs text-muted-foreground">No mínimo ou abaixo</p>
              </div>
            </div>
            {criticos.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setSomenteCriticos((v) => !v)}>
                {somenteCriticos ? 'Ver todos' : 'Ver itens'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, código ou local..."
          className="pl-9"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <Card className="glass-panel overflow-hidden border-white/5">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtradas.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Boxes}
                title={pecas.length === 0 ? 'Nenhuma peça cadastrada' : 'Nenhuma peça encontrada'}
                description={
                  pecas.length === 0
                    ? 'Cadastre as peças de reposição para controlar saldo, custo e ponto de reposição.'
                    : 'Ajuste a busca ou o filtro.'
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow>
                    <TableHead>Peça</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead className="text-right">Custo médio</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((p) => {
                    const repor = sugestaoReposicao(p)
                    return (
                      <TableRow key={p.id} className="hover:bg-white/5">
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{p.nome}</span>
                            <NivelBadge peca={p} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.codigo && <span className="font-mono">{p.codigo}</span>}
                            {repor > 0 && (
                              <span>
                                {p.codigo && ' • '}Repor {formatQtd(repor)} {p.unidade}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.localizacao || '-'}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {formatQtd(p.quantidade)} <span className="text-xs font-normal">{p.unidade}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatQtd(p.estoque_minimo)}
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatBRL(p.custo_unitario)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {podeGerenciar && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Entrada"
                                aria-label={`Entrada de ${p.nome}`}
                                onClick={() => setMovDialog({ peca: p, tipo: 'entrada' })}
                              >
                                <ArrowDownToLine className="h-4 w-4 text-green-400" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Saída"
                              aria-label={`Saída de ${p.nome}`}
                              disabled={p.quantidade <= 0}
                              onClick={() => setMovDialog({ peca: p, tipo: 'saida' })}
                            >
                              <ArrowUpFromLine className="h-4 w-4 text-red-400" />
                            </Button>
                            {podeGerenciar && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Ajuste de inventário"
                                aria-label={`Ajustar ${p.nome}`}
                                onClick={() => setMovDialog({ peca: p, tipo: 'ajuste' })}
                              >
                                <SlidersHorizontal className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Histórico"
                              aria-label={`Histórico de ${p.nome}`}
                              onClick={() => setHistoricoPeca(p)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            {podeGerenciar && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Editar"
                                aria-label={`Editar ${p.nome}`}
                                onClick={() => setPecaDialog({ open: true, peca: p })}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cadastro / edição */}
      <Dialog open={pecaDialog.open} onOpenChange={(open) => setPecaDialog({ open, peca: open ? pecaDialog.peca : null })}>
        <DialogContent className="glass-panel border-white/10 sm:max-w-[520px]">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              salvarPeca.mutate(new FormData(e.currentTarget))
            }}
          >
            <DialogHeader>
              <DialogTitle>{pecaDialog.peca ? 'Editar peça' : 'Nova peça'}</DialogTitle>
              <DialogDescription>
                O saldo só muda por entrada, saída ou ajuste, para manter o histórico.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" name="nome" defaultValue={pecaDialog.peca?.nome ?? ''} placeholder="Rolamento 6204 ZZ" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input id="codigo" name="codigo" defaultValue={pecaDialog.peca?.codigo ?? ''} placeholder="ROL-6204" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unidade">Unidade</Label>
                <Select name="unidade" defaultValue={pecaDialog.peca?.unidade ?? 'un'}>
                  <SelectTrigger id="unidade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['un', 'pç', 'kg', 'L', 'm', 'cx'].map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estoque_minimo">Estoque mínimo</Label>
                <Input
                  id="estoque_minimo"
                  name="estoque_minimo"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={pecaDialog.peca?.estoque_minimo ?? 0}
                />
              </div>
              {pecaDialog.peca ? (
                <input type="hidden" name="custo_unitario" value={pecaDialog.peca.custo_unitario} />
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="custo_unitario">Custo unitário (R$)</Label>
                    <Input id="custo_unitario" name="custo_unitario" type="number" min="0" step="0.01" defaultValue={0} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="saldo_inicial">Saldo inicial</Label>
                    <Input id="saldo_inicial" name="saldo_inicial" type="number" min="0" step="any" defaultValue={0} />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="localizacao">Local (prateleira)</Label>
                <Input id="localizacao" name="localizacao" defaultValue={pecaDialog.peca?.localizacao ?? ''} placeholder="A3-02" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="fornecedor">Fornecedor</Label>
                <Input id="fornecedor" name="fornecedor" defaultValue={pecaDialog.peca?.fornecedor ?? ''} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setPecaDialog({ open: false, peca: null })}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvarPeca.isPending}>
                {salvarPeca.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Movimentação */}
      <Dialog open={!!movDialog} onOpenChange={(open) => !open && setMovDialog(null)}>
        <DialogContent className="glass-panel border-white/10 sm:max-w-[420px]">
          {movDialog && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                registrarMov.mutate(new FormData(e.currentTarget))
              }}
            >
              <DialogHeader>
                <DialogTitle>{TIPO_LABEL[movDialog.tipo]}</DialogTitle>
                <DialogDescription>
                  {movDialog.peca.nome} — saldo atual {formatQtd(movDialog.peca.quantidade)} {movDialog.peca.unidade}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="quantidade">
                    {movDialog.tipo === 'ajuste' ? 'Saldo contado' : 'Quantidade'} ({movDialog.peca.unidade})
                  </Label>
                  <Input id="quantidade" name="quantidade" type="number" min="0" step="any" required autoFocus />
                </div>
                {movDialog.tipo === 'entrada' && (
                  <div className="space-y-2">
                    <Label htmlFor="mov_custo">Custo unitário desta compra (R$)</Label>
                    <Input
                      id="mov_custo"
                      name="custo_unitario"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={String(movDialog.peca.custo_unitario)}
                    />
                    <p className="text-xs text-muted-foreground">Em branco mantém o custo médio atual.</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="observacao">Observação</Label>
                  <Input id="observacao" name="observacao" placeholder="NF, motivo, OS..." />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setMovDialog(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={registrarMov.isPending}>
                  {registrarMov.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Registrar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Histórico */}
      <Dialog open={!!historicoPeca} onOpenChange={(open) => !open && setHistoricoPeca(null)}>
        <DialogContent className="glass-panel max-h-[80vh] overflow-y-auto border-white/10 sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Histórico — {historicoPeca?.nome}</DialogTitle>
            <DialogDescription>Últimas 50 movimentações.</DialogDescription>
          </DialogHeader>
          {historicoLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : historico.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
          ) : (
            <ul className="space-y-2">
              {historico.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-secondary/20 p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {TIPO_LABEL[m.tipo as TipoMov] ?? m.tipo}
                      {m.ordem_id && <span className="ml-2 font-mono text-xs text-primary">OS #{m.ordem_id}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleString('pt-BR')}
                      {m.observacao && ` • ${m.observacao}`}
                    </p>
                  </div>
                  <div className="text-right font-mono text-sm">
                    <p className={m.tipo === 'entrada' ? 'text-green-400' : m.tipo === 'saida' ? 'text-red-400' : ''}>
                      {m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '−' : '='}
                      {formatQtd(m.quantidade)}
                    </p>
                    <p className="text-xs text-muted-foreground">saldo {formatQtd(m.saldo_apos ?? 0)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
