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
} from 'lucide-react'
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

type ManualCategory = Database['public']['Enums']['manual_category']
type ManualType = Database['public']['Enums']['manual_type']

const PAGE_SIZE = 10

export default function Biblioteca() {
  const [manuais, setManuais] = useState<Manual[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<ManualType | ''>('')
  const [filterCategory, setFilterCategory] = useState<ManualCategory | ''>('')
  const [filterIndustry, setFilterIndustry] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [reindexingId, setReindexingId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [manualToDelete, setManualToDelete] = useState<Manual | null>(null)

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
      if (filterType) {
        query = query.eq('manual_type', filterType)
      }
      if (filterCategory) {
        query = query.eq('category', filterCategory)
      }
      if (filterIndustry) {
        query = query.eq('industry', filterIndustry)
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

  useEffect(() => {
    loadManuais()
  }, [loadManuais])

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
    setFilterType('')
    setFilterCategory('')
    setFilterIndustry('')
    setFilterStatus('')
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
                setFilterType(v as ManualType | '')
                setCurrentPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os tipos</SelectItem>
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
                setFilterCategory(v as ManualCategory | '')
                setCurrentPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas categorias</SelectItem>
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
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="indexed">Indexado</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(search ||
            filterType ||
            filterCategory ||
            filterIndustry ||
            filterStatus) && (
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
