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
import { Badge } from '@/components/ui/badge'
import { DateRangeFilter, DateRange } from '@/components/DateRangeFilter'
import { OSList } from '@/components/OSList'
import { OSForm } from '@/components/OSForm'
import { OSViewDialog } from '@/components/OSViewDialog'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Bot,
  Plus,
  Search,
  Filter,
  Loader2,
  ArrowLeft,
  User,
  Building2,
  Shield,
  LogOut,
  FileDown,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
    roles,
    isLoading: authLoading,
    isAdminKraflo,
    signOut,
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
        osQuery = osQuery.eq('status_os', statusFilter as "Aberta" | "Em manutenção" | "Fechada" | "Liberado para produção" | "Não liberado")
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

      // Search filter (client-side for text search)
      // We'll apply search after fetching since ilike on multiple columns needs OR

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

      // Load technicians (only once, no pagination needed)
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
    }
  }, [user, loadData])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  const handleEdit = (os: OS) => {
    setEditingOS(os)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingOS(null)
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Floating Command Bridge Header */}
      <div className="pt-4 px-4 sticky top-0 z-50 w-full mb-6 relative">
        <header className="glass-panel rounded-2xl mx-auto container p-3 flex items-center justify-between shadow-surface glow-border">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="p-2 bg-primary rounded-lg">
                <Bot className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-foreground">
                  Ordens de Serviço
                </h1>
                <p className="text-xs text-muted-foreground">
                  Gerenciamento de OS
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {isAdminKraflo ? (
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/20"
                >
                  <Shield className="h-3 w-3 mr-1" />
                  Admin Kraflo
                </Badge>
              ) : roles.includes('admin_empresa') ? (
                <Badge
                  variant="outline"
                  className="bg-blue-500/10 text-blue-500 border-blue-500/20"
                >
                  <Building2 className="h-3 w-3 mr-1" />
                  Admin Empresa
                </Badge>
              ) : null}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {profile?.nome_completo || 'Usuário'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
      </div>

      <main className="container mx-auto px-4 pb-6 space-y-6 mt-2">
        {/* Filters */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <DateRangeFilter value={dateRange} onChange={setDateRange} />
            </div>
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
      </main>

      {/* Dialogs */}
      <OSForm
        open={isFormOpen}
        onClose={handleFormClose}
        onSuccess={loadData}
        editingOS={editingOS || undefined}
      />

      <OSViewDialog
        open={!!viewingOS}
        onClose={() => setViewingOS(null)}
        os={viewingOS}
        tecnicos={tecnicos}
      />
    </div>
  )
}
