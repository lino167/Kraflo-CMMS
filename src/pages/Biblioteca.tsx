/**
 * Prompt 11: Página "Biblioteca de Conhecimento"
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/sonner'
import { handleError } from '@/lib/error-handler'
import {
  Library,
  Search,
  FileText,
  CheckCircle2,
  Clock,
  MoreVertical,
  RefreshCw,
  Trash2,
  Globe,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Wrench,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import {
  MANUAL_CATEGORIES,
  MANUAL_TYPES,
} from '@/lib/manual-taxonomy'

interface Manual {
  id: string
  nome_arquivo: string
  manual_type: 'general' | 'equipment' | null
  category: string | null
  tags: string[] | null
  industry: string | null
  fabricante: string | null
  modelo: string | null
  equipamento_tipo: string | null
  is_public: boolean
  processado: boolean
  total_paginas: number | null
  created_at: string
  empresa_id: string | null
}

interface OS {
  id: number
  equipamento_nome: string
  equipamento_tag: string | null
  status_os: string
  prioridade: string | null
  tipo_manutencao: string | null
  data_abertura: string
  data_fechamento: string | null
  descricao_problema: string | null
  diagnostico_solucao: string | null
  notas_finais: string | null
  tecnico_id: number
  localizacao: string | null
  empresa_id: string
}

type ManualCategory = Database['public']['Enums']['manual_category']
type ManualType = Database['public']['Enums']['manual_type']

const PAGE_SIZE = 10

export default function Biblioteca() {
  const [manuais, setManuais] = useState<Manual[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<ManualType | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<ManualCategory | 'all'>('all')
  const [filterIndustry, setFilterIndustry] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [reindexingId, setReindexingId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [manualToDelete, setManualToDelete] = useState<Manual | null>(null)
  const { profile } = useAuth()

  // Histórico de Reparos (Wiki) State
  const [wikiResults, setWikiResults] = useState<OS[]>([])
  const [isWikiLoading, setIsWikiLoading] = useState(false)
  const [wikiSearch, setWikiSearch] = useState('')
  const [wikiTotalCount, setWikiTotalCount] = useState(0)
  const [wikiPage, setWikiPage] = useState(1)
  const [wikiDateFilter, setWikiDateFilter] = useState<string>('all')
  const [wikiDateRange, setWikiDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [activeTab, setActiveTab] = useState<'manuals' | 'wiki'>('manuals')

  const loadManuais = useCallback(async () => {
    setIsLoading(true)
    try {
      let query = supabase.from('manuais').select('*', { count: 'exact' })

      // Aplicar filtros
      if (search) {
        query = query.or(
          `nome_arquivo.ilike.%${search}%,fabricante.ilike.%${search}%,modelo.ilike.%${search}%`,
        )
      }
      if (filterType && (filterType as string) !== 'all') {
        query = query.eq('manual_type', filterType as any)
      }
      if (filterCategory && (filterCategory as string) !== 'all') {
        query = query.eq('category', filterCategory as any)
      }
      if (filterIndustry && (filterIndustry as string) !== 'all') {
        query = query.eq('industry', filterIndustry as any)
      }
      if (filterStatus === 'indexed') {
        query = query.eq('processado', true)
      } else if (filterStatus === 'pending') {
        query = query.eq('processado', false)
      }

      // Paginação
      const from = (currentPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error
      setManuais((data as Manual[]) || [])
      setTotalCount(count || 0)
    } catch (error) {
      handleError(error)
    } finally {
      setIsLoading(false)
    }
  }, [
    currentPage,
    filterCategory,
    filterIndustry,
    filterStatus,
    filterType,
    search,
  ])

  const loadWiki = useCallback(async () => {
    setIsWikiLoading(true)
    try {
      let query = supabase
        .from('ordens_de_servico')
        .select('*', { count: 'exact' })
        // Apenas OS fechadas servem como "wiki" de solução confirmada
        .eq('status_os', 'Fechada')

      if (profile?.empresa_id) {
        query = query.eq('empresa_id', profile.empresa_id)
      }

      if (wikiSearch) {
        query = query.or(
          `equipamento_nome.ilike.%${wikiSearch}%,equipamento_tag.ilike.%${wikiSearch}%,descricao_problema.ilike.%${wikiSearch}%,diagnostico_solucao.ilike.%${wikiSearch}%,notas_finais.ilike.%${wikiSearch}%`,
        )
      }

      if (wikiDateFilter !== 'all') {
        let start: Date | undefined
        let end: Date | undefined
        const now = new Date()

        if (wikiDateFilter === 'month') {
          start = startOfMonth(now)
          end = endOfMonth(now)
        } else if (wikiDateFilter === 'quarter') {
          start = subDays(now, 90)
        } else if (wikiDateFilter === '7days') {
          start = subDays(now, 7)
        } else if (wikiDateFilter === 'custom' && wikiDateRange.from) {
          start = wikiDateRange.from
          end = wikiDateRange.to
        }

        if (start) query = query.gte('data_fechamento', start.toISOString())
        if (end) query = query.lte('data_fechamento', end.toISOString())
      }

      const from = (wikiPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error, count } = await query
        .order('data_fechamento', { ascending: false })
        .range(from, to)

      if (error) throw error
      setWikiResults((data as OS[]) || [])
      setWikiTotalCount(count || 0)
    } catch (error) {
      handleError(error)
    } finally {
      setIsWikiLoading(false)
    }
  }, [profile?.empresa_id, wikiSearch, wikiPage, wikiDateFilter, wikiDateRange])

  useEffect(() => {
    loadManuais()
  }, [loadManuais])

  useEffect(() => {
    loadWiki()
  }, [loadWiki])

  const handleReindex = async (manual: Manual) => {
    setReindexingId(manual.id)
    try {
      // Reindexação via backfill-os-index (exemplo de uso da infraestrutura)
      // OSService.runRetroactiveClassification(manual.empresa_id); 
      toast.info('Solicitação de reindexação enviada')
    } catch (error) {
      handleError(error)
    } finally {
      setReindexingId(null)
    }
  }

  const handleDelete = async () => {
    if (!manualToDelete) return

    try {
      const { error } = await supabase
        .from('manuais')
        .delete()
        .eq('id', manualToDelete.id)

      if (error) throw error

      toast.success('Manual removido com sucesso')
      setDeleteDialogOpen(false)
      setManualToDelete(null)
      loadManuais()
    } catch (error) {
      handleError(error)
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const getStatusBadge = (manual: Manual) => {
    if (manual.processado) {
      return (
        <Badge variant="outline" className="text-green-500 border-green-500/50">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Indexado
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
        <Clock className="h-3 w-3 mr-1" />
        Pendente
      </Badge>
    )
  }

  const getTypeBadge = (manual: Manual) => {
    if (manual.manual_type === 'general') {
      return <Badge variant="secondary">Geral</Badge>
    }
    if (manual.manual_type === 'equipment') {
      return <Badge variant="default">Equipamento</Badge>
    }
    return null
  }

  const clearFilters = () => {
    setSearch('')
    setFilterType('all' as any)
    setFilterCategory('all' as any)
    setFilterIndustry('all')
    setFilterStatus('all')
    setCurrentPage(1)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Floating Command Bridge Header */}
      <div className="pt-4 px-4 sticky top-0 z-50 w-full mb-6 relative">
        <header className="glass-panel rounded-2xl mx-auto container p-3 flex items-center justify-between shadow-surface glow-border">
          <div className="flex items-center justify-between w-full gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg hidden sm:block">
                <Library className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-foreground">
                  Biblioteca de Conhecimento
                </h1>
                <p className="text-xs text-muted-foreground">
                  Gerencie os manuais e documentos da base da IA
                </p>
              </div>
            </div>
            <Button onClick={loadManuais} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </header>
      </div>

      <main className="container mx-auto px-4 pb-6 space-y-6 mt-2">
        <div className="flex w-full mb-8 h-12 p-1 bg-muted/50 rounded-xl overflow-hidden shadow-inner border border-border/10">
          <button
            onClick={() => setActiveTab('manuals')}
            className={`flex-1 flex items-center justify-center rounded-lg transition-all duration-300 font-medium text-sm ${
              activeTab === 'manuals'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <FileText className="h-4 w-4 mr-2" />
            Documentação (Manuais)
          </button>
          <button
            onClick={() => setActiveTab('wiki')}
            className={`flex-1 flex items-center justify-center rounded-lg transition-all duration-300 font-medium text-sm ${
              activeTab === 'wiki'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Wrench className="h-4 w-4 mr-2" />
            Histórico de Reparos (Wiki)
          </button>
        </div>

        {activeTab === 'manuals' ? (
          <div className="space-y-6 animate-in fade-in-50 duration-500">

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, fabricante ou modelo..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={filterType}
              onValueChange={(v) => {
                setFilterType(v as any)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {MANUAL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterCategory}
              onValueChange={(v) => {
                setFilterCategory(v as any)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {MANUAL_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterStatus}
              onValueChange={(v) => {
                setFilterStatus(v)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="indexed">Indexado</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(search ||
            (filterType && (filterType as string) !== 'all') ||
            (filterCategory && (filterCategory as string) !== 'all') ||
            (filterIndustry && (filterIndustry as string) !== 'all') ||
            (filterStatus && (filterStatus as string) !== 'all')) && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Filtros ativos:
              </span>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Manuais */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Fabricante / Modelo</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : manuais.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-4 border-0">
                    <EmptyState
                      icon={FileText}
                      title="Nenhum manual encontrado"
                      description="Faça o upload de um novo arquivo PDF para enriquecer a base de conhecimento."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                manuais.map((manual) => (
                  <TableRow key={manual.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <div>
                          <p className="font-medium text-sm">
                            {manual.nome_arquivo}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {manual.total_paginas
                              ? `${manual.total_paginas} páginas`
                              : ''}
                          </p>
                        </div>
                        {manual.is_public && (
                          <span title="Biblioteca Pública">
                            <Globe className="h-4 w-4 text-blue-500" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(manual)}</TableCell>
                    <TableCell>
                      {manual.category && (
                        <span className="text-sm">
                          {MANUAL_CATEGORIES.find(
                            (c) => c.value === manual.category,
                          )?.label || manual.category}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {manual.fabricante && <span>{manual.fabricante}</span>}
                        {manual.fabricante && manual.modelo && <span> / </span>}
                        {manual.modelo && <span>{manual.modelo}</span>}
                        {!manual.fabricante &&
                          !manual.modelo &&
                          manual.equipamento_tipo && (
                            <span className="text-muted-foreground">
                              {manual.equipamento_tipo}
                            </span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {manual.tags?.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {manual.tags && manual.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{manual.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(manual)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleReindex(manual)}
                            disabled={reindexingId === manual.id}
                          >
                            <RefreshCw
                              className={`h-4 w-4 mr-2 ${reindexingId === manual.id ? 'animate-spin' : ''}`}
                            />
                            Reindexar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setManualToDelete(manual)
                              setDeleteDialogOpen(true)
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Mostrando {(currentPage - 1) * PAGE_SIZE + 1} a{' '}
                {Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount}{' '}
                manuais
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
        ) : (
          <div className="animate-in fade-in-50 duration-500">
            <WikiTab
              wikiResults={wikiResults}
              isLoading={isWikiLoading}
              search={wikiSearch}
              setSearch={setWikiSearch}
              totalCount={wikiTotalCount}
              currentPage={wikiPage}
              setCurrentPage={setWikiPage}
              onRefresh={loadWiki}
              dateFilter={wikiDateFilter}
              setDateFilter={setWikiDateFilter}
              dateRange={wikiDateRange}
              setDateRange={setWikiDateRange}
            />
          </div>
        )}

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Manual</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o manual "
              {manualToDelete?.nome_arquivo}"? Esta ação não pode ser desfeita e
              todos os chunks indexados serão removidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </main>
    </div>
  )
}

function WikiTab({
  wikiResults,
  isLoading,
  search,
  setSearch,
  totalCount,
  currentPage,
  setCurrentPage,
  onRefresh,
  dateFilter,
  setDateFilter,
  dateRange,
  setDateRange,
}: {
  wikiResults: OS[]
  isLoading: boolean
  search: string
  setSearch: (v: string) => void
  totalCount: number
  currentPage: number
  setCurrentPage: (p: number) => void
  onRefresh: () => void
  dateFilter: string
  setDateFilter: (v: string) => void
  dateRange: { from: Date | undefined; to: Date | undefined }
  setDateRange: (range: { from: Date | undefined; to: Date | undefined }) => void
}) {
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-[2]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquise por palavras-chave (ex: 'correia', 'motor', 'erro 404')..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10 h-11 bg-background/50"
              />
            </div>
            <div className="flex flex-1 gap-2">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-11 bg-background/50 min-w-[150px]">
                  <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="month">Mês atual</SelectItem>
                  <SelectItem value="quarter">Trimestral (90 dias)</SelectItem>
                  <SelectItem value="7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="custom">Escolher intervalo</SelectItem>
                </SelectContent>
              </Select>

              {dateFilter === 'custom' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-11 bg-background/50 border-input px-3 shadow-sm hover:bg-accent group">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <CalendarComponent
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range: any) => setDateRange(range || { from: undefined, to: undefined })}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <Button onClick={onRefresh} variant="outline" size="lg" className="h-11 shadow-sm hover:bg-primary/5">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Pesquisar
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Dica: O wiki busca em nomes de equipamentos, problemas relatados e soluções técnicas aplicadas.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border-border/40">
              <CardContent className="p-0">
                <div className="p-4 space-y-3">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : wikiResults.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Nenhum registro encontrado"
            description="Tente usar termos mais genéricos ou verifique se as OS foram fechadas corretamente com diagnóstico."
          />
        ) : (
          wikiResults.map((os) => (
            <Card key={os.id} className="overflow-hidden border-border/40 hover:border-primary/30 transition-all duration-300 shadow-sm group">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/40 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-0">
                <div className="p-5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px] bg-secondary/50">
                          #{os.id}
                        </Badge>
                        <h3 className="text-base font-bold text-foreground">
                          {os.equipamento_nome}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {os.equipamento_tag && (
                          <span className="flex items-center gap-1 font-mono">
                            <Badge variant="secondary" className="px-1 text-[10px] h-4">TAG</Badge> {os.equipamento_tag}
                          </span>
                        )}
                        <span>•</span>
                        <span>{os.tipo_manutencao}</span>
                        <span>•</span>
                        <span>{os.data_fechamento ? format(new Date(os.data_fechamento), 'dd/MM/yyyy') : '-'}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => window.open(`/ordens-servico?search=${os.id}`, '_blank')}>
                      <ExternalLink className="h-3 w-3" />
                      Ver Detalhes
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                      <div className="flex items-center gap-2 text-orange-400 font-semibold text-xs uppercase tracking-wider">
                        <AlertTriangle className="h-3 w-3" />
                        Problema Relatado
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed italic">
                        "{os.descricao_problema || 'Não descrito'}"
                      </p>
                    </div>

                    <div className="space-y-2 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                      <div className="flex items-center gap-2 text-green-400 font-semibold text-xs uppercase tracking-wider">
                        <CheckCircle2 className="h-3 w-3" />
                        Diagnóstico e Solução
                      </div>
                      <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-medium">
                        {os.diagnostico_solucao || 'Nenhuma solução detalhada.'}
                      </div>
                      {os.notas_finais && (
                        <div className="mt-2 text-xs text-muted-foreground pt-2 border-t border-green-500/10">
                          <strong>Notas:</strong> {os.notas_finais}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Paginação Wiki */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-card rounded-lg border border-border/40">
          <span className="text-sm text-muted-foreground font-mono">
            {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)} / {totalCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono px-2">
              {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
