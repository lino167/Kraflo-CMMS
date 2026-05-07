import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useOSCategories } from '@/hooks/useOSCategories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateRangeFilter, DateRange } from '@/components/DateRangeFilter'
import { OSList } from '@/components/OSList'
import { OSForm } from '@/components/OSForm'
import { OSViewDialog } from '@/components/OSViewDialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Plus,
  Search,
  Filter,
  Loader2,
  FileDown,
  Calendar,
  ClipboardList,
  MessageSquare,
  AlertTriangle,
  UserCheck,
  Clock,
} from 'lucide-react'
import { toast } from '@/components/ui/sonner'
import { handleError } from '@/lib/error-handler'
import { exportOSListToPDF } from '@/components/OSListPdfExport'
import { startOfMonth, endOfMonth } from 'date-fns'

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
  url_foto: string | null
  url_arquivo_fechamento: string | null
  categoria_parada_id?: string | null
  subcategoria_parada_id?: string | null
  categoria_problema_id?: string | null
  subcategoria_problema_id?: string | null
}

interface Tecnico {
  id_telegram: number
  nome_completo: string
}

const PAGE_SIZE = 50

export default function OrdensServico() {
  const navigate = useNavigate()
  const {
    user,
    profile,
    isLoading: authLoading,
    isAdminKraflo,
  } = useAuth()

  const {
    categoriasParada,
    categoriasProblema,
    getCategoriaParadaNome,
    getCategoriaProblemaName,
    getSubcategoriaName,
  } = useOSCategories()

  const [osList, setOsList] = useState<OS[]>([])
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>('all')
  const [categoriaParadaFilter, setCategoriaParadaFilter] = useState<string>('all')
  const [categoriaProblemaFilter, setCategoriaProblemaFilter] = useState<string>('all')

  // Dialogs
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingOS, setEditingOS] = useState<OS | null>(null)
  const [viewingOS, setViewingOS] = useState<OS | null>(null)
  const [isExportingList, setIsExportingList] = useState(false)

  // Preventivas e Solicitações de Manutenção
  const [preventivasPendentes, setPreventivasPendentes] = useState<any[]>([])
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState<any[]>([])
  const [isLoadingPreventivas, setIsLoadingPreventivas] = useState(false)
  const [isLoadingSolicitacoes, setIsLoadingSolicitacoes] = useState(false)
  const [prefilledData, setPrefilledData] = useState<any>(null)

  const loadPreventivas = useCallback(async () => {
    if (!profile?.empresa_id) return
    setIsLoadingPreventivas(true)
    try {
      const { data, error } = await supabase
        .from('execucoes_preventivas')
        .select(`
          id,
          agendado_para,
          status,
          tarefa:tarefas_preventivas (
            id,
            titulo,
            descricao,
            plano:planos_manutencao (
              id,
              equipamento_nome,
              equipamento_tag,
              fabricante,
              modelo,
              periodicidade
            )
          )
        `)
        .eq('empresa_id', profile.empresa_id)
        .in('status', ['agendada', 'atrasada'])
        .order('agendado_para', { ascending: true })

      if (error) throw error
      setPreventivasPendentes(data || [])
    } catch (err) {
      console.error('Erro ao carregar preventivas:', err)
    } finally {
      setIsLoadingPreventivas(false)
    }
  }, [profile?.empresa_id])

  const loadSolicitacoes = useCallback(async () => {
    if (!profile?.empresa_id) return
    setIsLoadingSolicitacoes(true)
    try {
      const { data, error } = await supabase
        .from('solicitacoes_manutencao' as any)
        .select('*')
        .eq('empresa_id', profile.empresa_id)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSolicitacoesPendentes(data || [])
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err)
    } finally {
      setIsLoadingSolicitacoes(false)
    }
  }, [profile?.empresa_id])

  const handleStartPreventiva = (prev: any) => {
    setPrefilledData({
      equipamento_nome: prev.tarefa?.plano?.equipamento_nome || 'Equipamento',
      equipamento_tag: prev.tarefa?.plano?.equipamento_tag || '',
      localizacao: prev.tarefa?.plano?.modelo || 'Fábrica',
      tipo_manutencao: 'Preventiva',
      prioridade: 'Média',
      descricao_problema: `Manutenção Preventiva Periódica (${prev.tarefa?.plano?.periodicidade || 'mensal'}): ${prev.tarefa?.titulo || 'Sem título'}. Descrição: ${prev.tarefa?.descricao || 'Nenhuma'}`,
      execucao_origem_id: prev.id,
      plano_origem_id: prev.tarefa?.plano?.id
    })
    setIsFormOpen(true)
  }

  const handleConvertSolicitacao = (sol: any) => {
    setPrefilledData({
      equipamento_nome: sol.equipamento_nome || 'Equipamento',
      localizacao: sol.localizacao || '',
      tipo_manutencao: 'Corretiva',
      prioridade: sol.prioridade || 'Média',
      descricao_problema: `Solicitação feita por ${sol.solicitante_nome}: ${sol.descricao}`,
      solicitacao_origem_id: sol.id
    })
    setIsFormOpen(true)
  }

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      // Build query with server-side filters
      let osQuery = supabase
        .from('ordens_de_servico')
        .select('*', { count: 'exact' })

      if (!isAdminKraflo && profile?.empresa_id) {
        osQuery = osQuery.eq('empresa_id', profile.empresa_id)
      }

      // Date range filter
      osQuery = osQuery
        .gte('data_abertura', dateRange.from.toISOString())
        .lte('data_abertura', dateRange.to.toISOString())

      // Status filter
      if (statusFilter !== 'all') {
        osQuery = osQuery.eq('status_os', statusFilter as any)
      }

      // Priority filter
      if (prioridadeFilter !== 'all') {
        osQuery = osQuery.eq('prioridade', prioridadeFilter)
      }

      // Category filters
      if (categoriaParadaFilter !== 'all') {
        osQuery = osQuery.eq('categoria_parada_id', categoriaParadaFilter)
      }
      if (categoriaProblemaFilter !== 'all') {
        osQuery = osQuery.eq('categoria_problema_id', categoriaProblemaFilter)
      }

      if (searchQuery) {
        const query = searchQuery.trim()
        osQuery = osQuery.or(
          `equipamento_nome.ilike.%${query}%,equipamento_tag.ilike.%${query}%,descricao_problema.ilike.%${query}%`
        )
      }

      // Pagination
      const from = (currentPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data: osData, error: osError, count } = await osQuery
        .order('data_abertura', { ascending: false })
        .range(from, to)

      if (osError) throw osError
      setOsList(osData || [])
      setTotalCount(count || 0)

      // Load technicians
      let tecnicoQuery = supabase
        .from('tecnicos')
        .select('id_telegram, nome_completo')

      if (!isAdminKraflo && profile?.empresa_id) {
        tecnicoQuery = tecnicoQuery.eq('empresa_id', profile.empresa_id)
      }

      const { data: tecnicoData, error: tecnicoError } = await tecnicoQuery

      if (tecnicoError) throw tecnicoError
      setTecnicos(tecnicoData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isAdminKraflo, profile?.empresa_id, dateRange, statusFilter, prioridadeFilter, categoriaParadaFilter, categoriaProblemaFilter, searchQuery, currentPage])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [dateRange, statusFilter, prioridadeFilter, categoriaParadaFilter, categoriaProblemaFilter, searchQuery])

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (user) {
      loadData()
      loadPreventivas()
      loadSolicitacoes()
    }
  }, [user, loadData, loadPreventivas, loadSolicitacoes])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const handleEdit = (os: OS) => {
    setEditingOS(os)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingOS(null)
    setPrefilledData(null)
  }

  const handleExportListPDF = async () => {
    if (osList.length === 0) {
      toast.error('Nenhuma OS para exportar')
      return
    }
    setIsExportingList(true)
    try {
      exportOSListToPDF(osList, tecnicos, dateRange, {
        getCategoriaParadaNome,
        getCategoriaProblemaName,
        getSubcategoriaName,
      })
      toast.success(`PDF com ${osList.length} OS exportado com sucesso!`)
    } catch (error) {
      handleError(error)
    } finally {
      setIsExportingList(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground tracking-tight flex items-center gap-2">
            Painel Operacional do Técnico
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie suas ordens de serviço, realize preventivas e atenda chamados de operadores.</p>
        </div>
      </div>

      <Tabs defaultValue="lista-os" className="w-full space-y-6">
        <TabsList className="bg-secondary/40 border border-white/5 p-1 rounded-xl flex w-full overflow-x-auto h-auto sm:inline-flex md:w-auto">
          <TabsTrigger value="lista-os" className="font-mono text-xs gap-2 py-2.5 px-4 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-foreground data-[state=active]:shadow-neon transition-all">
            <ClipboardList className="h-4 w-4 text-primary" />
            Minhas OS ({totalCount})
          </TabsTrigger>
          <TabsTrigger value="preventivas" className="font-mono text-xs gap-2 py-2.5 px-4 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-foreground data-[state=active]:shadow-neon transition-all">
            <Calendar className="h-4 w-4 text-blue-400" />
            Preventivas Pendentes ({preventivasPendentes.length})
          </TabsTrigger>
          <TabsTrigger value="solicitacoes" className="font-mono text-xs gap-2 py-2.5 px-4 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-foreground data-[state=active]:shadow-neon transition-all">
            <MessageSquare className="h-4 w-4 text-warning" />
            Solicitações ({solicitacoesPendentes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista-os" className="space-y-6 mt-0">
          {/* Filters */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <DateRangeFilter value={dateRange} onChange={setDateRange} />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportListPDF}
                  disabled={isExportingList || osList.length === 0}
                >
                  {isExportingList ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline ml-2">Exportar PDF</span>
                </Button>
                <Button onClick={() => setIsFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova OS
                </Button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por equipamento, TAG ou descrição..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="Aberta">Aberta</SelectItem>
                  <SelectItem value="Em manutenção">Em manutenção</SelectItem>
                  <SelectItem value="Não liberado">Não liberado</SelectItem>
                  <SelectItem value="Fechada">Fechada</SelectItem>
                  <SelectItem value="Liberado para produção">
                    Liberado para produção
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={prioridadeFilter}
                onValueChange={setPrioridadeFilter}
              >
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Prioridades</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category Filters Row */}
            <div className="flex flex-col md:flex-row gap-4">
              <Select
                value={categoriaParadaFilter}
                onValueChange={setCategoriaParadaFilter}
              >
                <SelectTrigger className="w-full md:w-56">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Motivo de Parada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Motivos</SelectItem>
                  {categoriasParada.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={categoriaProblemaFilter}
                onValueChange={setCategoriaProblemaFilter}
              >
                <SelectTrigger className="w-full md:w-56">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Causa Raiz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Causas</SelectItem>
                  {categoriasProblema.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Mostrando {osList.length} de {totalCount} ordens de serviço
                {totalPages > 1 && ` — Página ${currentPage} de ${totalPages}`}
              </span>
            </div>
          </div>

          {/* OS List */}
          <OSList
            osList={osList}
            tecnicos={tecnicos}
            isLoading={isLoading}
            onView={(os) => setViewingOS(os)}
            onEdit={handleEdit}
            onDelete={() => {}}
            onRefresh={loadData}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number
                  if (totalPages <= 5) {
                    page = i + 1
                  } else if (currentPage <= 3) {
                    page = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i
                  } else {
                    page = currentPage - 2 + i
                  }
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        isActive={page === currentPage}
                        onClick={() => setCurrentPage(page)}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </TabsContent>

        <TabsContent value="preventivas" className="mt-0">
          {isLoadingPreventivas ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : preventivasPendentes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {preventivasPendentes.map((prev) => {
                const isAtrasada = prev.status === 'atrasada' || new Date(prev.agendado_para) < new Date()
                return (
                  <div
                    key={prev.id}
                    className="p-5 rounded-xl bg-secondary/15 border border-white/5 hover:border-blue-500/30 transition-all duration-300 flex flex-col justify-between relative group"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-md ${
                          isAtrasada ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {isAtrasada ? 'ATRASADA' : 'AGENDADA'}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(prev.agendado_para).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-mono font-bold text-base text-foreground group-hover:text-primary transition-colors">
                          {prev.tarefa?.plano?.equipamento_nome || 'Equipamento'}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          TAG: <span className="text-foreground/80 font-semibold">{prev.tarefa?.plano?.equipamento_tag || 'S/N'}</span> | Loc: <span className="text-foreground/80 font-semibold">{prev.tarefa?.plano?.modelo || 'Fábrica'}</span>
                        </p>
                      </div>

                      <div className="p-3.5 rounded-lg bg-secondary/30 border border-white/5 space-y-1.5">
                        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {prev.tarefa?.titulo || 'Tarefa Geral'}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {prev.tarefa?.descricao || 'Procedimento de verificação preventiva periódica.'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        Plano: {prev.tarefa?.plano?.periodicidade || 'mensal'}
                      </span>
                      <Button
                        size="sm"
                        className="bg-blue-600/20 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all font-mono text-xs gap-1.5 h-8"
                        onClick={() => handleStartPreventiva(prev)}
                      >
                        <Plus className="h-3 w-3" /> Iniciar Preventiva
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-12 text-center rounded-xl bg-secondary/10 border border-white/5 space-y-3">
              <UserCheck className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <h3 className="font-mono font-bold text-lg text-foreground">Tudo em dia!</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">Nenhuma manutenção preventiva pendente para a sua empresa no momento.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="solicitacoes" className="mt-0">
          {isLoadingSolicitacoes ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : solicitacoesPendentes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {solicitacoesPendentes.map((sol) => {
                const isUrgente = sol.prioridade === 'Urgente' || sol.prioridade === 'Alta'
                return (
                  <div
                    key={sol.id}
                    className="p-5 rounded-xl bg-secondary/15 border border-white/5 hover:border-warning/30 transition-all duration-300 flex flex-col justify-between relative group"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-md ${
                          isUrgente ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-warning/10 text-warning border border-warning/20'
                        }`}>
                          {sol.prioridade ? sol.prioridade.toUpperCase() : 'MÉDIA'}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(sol.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-mono font-bold text-base text-foreground group-hover:text-warning transition-colors">
                          {sol.equipamento_nome || 'Equipamento'}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          Solicitante: <span className="text-foreground/80 font-semibold">{sol.solicitante_nome || 'Operador'}</span> | Loc: <span className="text-foreground/80 font-semibold">{sol.localizacao || 'Fábrica'}</span>
                        </p>
                      </div>

                      <div className="p-3.5 rounded-lg bg-secondary/30 border border-white/5 space-y-1.5">
                        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                          Problema Relatado
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {sol.descricao || 'Nenhuma descrição detalhada fornecida.'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        Chamado pendente
                      </span>
                      <Button
                        size="sm"
                        className="bg-warning/20 text-warning border border-warning/20 hover:bg-warning hover:text-black transition-all font-mono text-xs gap-1.5 h-8"
                        onClick={() => handleConvertSolicitacao(sol)}
                      >
                        <Plus className="h-3 w-3" /> Converter em OS
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-12 text-center rounded-xl bg-secondary/10 border border-white/5 space-y-3">
              <UserCheck className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <h3 className="font-mono font-bold text-lg text-foreground">Sem pendências!</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">Não há solicitações de operadores aguardando verificação no momento.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <OSForm
        open={isFormOpen}
        onClose={handleFormClose}
        onSuccess={() => {
          loadData()
          loadPreventivas()
          loadSolicitacoes()
        }}
        editingOS={editingOS || undefined}
        prefilledData={prefilledData || undefined}
      />

      <OSViewDialog
        open={!!viewingOS}
        onClose={() => setViewingOS(null)}
        os={viewingOS}
        tecnicos={tecnicos}
      />
    </main>
  )
}
