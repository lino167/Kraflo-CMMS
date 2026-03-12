/**
 * Página de administração de indexação de OS
 * Permite monitorar e controlar o processo de indexação para RAG
 */

import { useState, useEffect, type ComponentType } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AccessDenied } from '@/components/AccessDenied'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  RefreshCw,
  Play,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Loader2,
  Search,
  RotateCcw,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface IndexStats {
  total: number
  indexed: number
  pending: number
  queued: number
  indexing: number
  error: number
}

interface IndexJob {
  id: string
  os_id: number
  status: string
  attempts: number
  last_error: string | null
  next_run_at: string
  created_at: string
  updated_at: string
  empresa_id: string
}

type BadgeVariant = NonNullable<BadgeProps['variant']>
type StatusIconComponent = ComponentType<{ className?: string }>

const statusConfig: Record<
  string,
  { label: string; color: BadgeVariant; icon: StatusIconComponent }
> = {
  pending: { label: 'Pendente', color: 'secondary', icon: Clock },
  queued: { label: 'Na Fila', color: 'default', icon: Clock },
  indexing: { label: 'Indexando', color: 'default', icon: Loader2 },
  indexed: { label: 'Indexado', color: 'default', icon: CheckCircle },
  error: { label: 'Erro', color: 'destructive', icon: AlertCircle },
}

export default function IndexacaoAdmin() {
  const {
    user,
    isAdminKraflo,
    isAdminEmpresa,
    isLoading: authLoading,
  } = useAuth()
  const isAdmin = isAdminKraflo || isAdminEmpresa
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Fetch index stats
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['index-stats'],
    queryFn: async (): Promise<IndexStats> => {
      const { data, error } = await supabase
        .from('ordens_de_servico')
        .select('index_status')

      if (error) throw error

      const counts = (data || []).reduce(
        (acc, os) => {
          const status = os.index_status || 'pending'
          acc[status] = (acc[status] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )

      return {
        total: data?.length || 0,
        indexed: counts.indexed || 0,
        pending: counts.pending || 0,
        queued: counts.queued || 0,
        indexing: counts.indexing || 0,
        error: counts.error || 0,
      }
    },
    enabled: !!user && isAdmin,
    refetchInterval: 10000, // Auto-refresh every 10s
  })

  // Fetch index jobs
  const {
    data: jobs,
    isLoading: jobsLoading,
    refetch: refetchJobs,
  } = useQuery({
    queryKey: ['index-jobs', statusFilter, searchTerm],
    queryFn: async (): Promise<IndexJob[]> => {
      let query = supabase
        .from('os_index_jobs')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(100)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (searchTerm) {
        query = query.eq('os_id', parseInt(searchTerm) || 0)
      }

      const { data, error } = await query
      if (error) throw error
      return data as IndexJob[]
    },
    enabled: !!user && isAdmin,
    refetchInterval: 5000,
  })

  // Backfill mutation
  const backfillMutation = useMutation({
    mutationFn: async (forceReindex: boolean) => {
      // Get user's access token for authentication
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.')
      }

      const response = await fetch(
        `https://stqjixdsolguzpvjfrmr.supabase.co/functions/v1/backfill-os-index`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ force_reindex: forceReindex }),
        },
      )
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erro ao executar backfill')
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast({
        title: 'Backfill iniciado',
        description: `${data.enqueued} OS enfileiradas para indexação`,
      })
      queryClient.invalidateQueries({ queryKey: ['index-stats'] })
      queryClient.invalidateQueries({ queryKey: ['index-jobs'] })
    },
    onError: (error) => {
      toast({
        title: 'Erro no backfill',
        description:
          error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    },
  })

  // Process queue mutation
  const processQueueMutation = useMutation({
    mutationFn: async () => {
      // Get user's access token for authentication
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.')
      }

      const response = await fetch(
        `https://stqjixdsolguzpvjfrmr.supabase.co/functions/v1/process-os-index-queue`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ batch_size: 50, concurrency: 5 }),
        },
      )
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erro ao processar fila')
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast({
        title: 'Fila processada',
        description: `${data.successful} indexadas, ${data.failed} erros`,
      })
      queryClient.invalidateQueries({ queryKey: ['index-stats'] })
      queryClient.invalidateQueries({ queryKey: ['index-jobs'] })
    },
    onError: (error) => {
      toast({
        title: 'Erro ao processar',
        description:
          error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    },
  })

  // Reindex specific OS mutation
  const reindexOsMutation = useMutation({
    mutationFn: async (osId: number) => {
      const { error } = await supabase.rpc('enqueue_os_index', {
        p_os_id: osId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast({ title: 'OS enfileirada para reindexação' })
      queryClient.invalidateQueries({ queryKey: ['index-jobs'] })
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description:
          error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    },
  })

  if (authLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!user || !isAdmin) {
    return <AccessDenied />
  }

  const percentIndexed = stats
    ? Math.round((stats.indexed / Math.max(stats.total, 1)) * 100)
    : 0

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Indexação de OS</h1>
          <p className="text-muted-foreground">
            Gerenciamento de embeddings para o assistente IA
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              refetchStats()
              refetchJobs()
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de OS</CardDescription>
            <CardTitle className="text-2xl">
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                stats?.total || 0
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-green-500/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              Indexadas
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                `${stats?.indexed || 0} (${percentIndexed}%)`
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Na Fila
            </CardDescription>
            <CardTitle className="text-2xl">
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                stats?.queued || 0
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Loader2 className="h-3 w-3" />
              Indexando
            </CardDescription>
            <CardTitle className="text-2xl">
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                stats?.indexing || 0
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-destructive" />
              Erros
            </CardDescription>
            <CardTitle className="text-2xl text-destructive">
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                stats?.error || 0
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Ações
          </CardTitle>
          <CardDescription>Controle o processo de indexação</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={() => backfillMutation.mutate(false)}
            disabled={backfillMutation.isPending}
          >
            {backfillMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Indexar Pendentes
          </Button>
          <Button
            variant="outline"
            onClick={() => backfillMutation.mutate(true)}
            disabled={backfillMutation.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reindexar Tudo
          </Button>
          <Button
            variant="secondary"
            onClick={() => processQueueMutation.mutate()}
            disabled={processQueueMutation.isPending}
          >
            {processQueueMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Processar Fila Agora
          </Button>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Jobs de Indexação</CardTitle>
              <CardDescription>Últimos 100 jobs</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar OS #"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-32"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="queued">Na Fila</SelectItem>
                  <SelectItem value="running">Executando</SelectItem>
                  <SelectItem value="done">Concluído</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : jobs && jobs.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>OS #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead>Próx. Execução</TableHead>
                    <TableHead>Último Erro</TableHead>
                    <TableHead>Atualizado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const config =
                      statusConfig[job.status] || statusConfig.pending
                    const StatusIcon = config.icon
                    return (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono">
                          #{job.os_id}
                        </TableCell>
                        <TableCell>
                          <Badge variant={config.color} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{job.attempts}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(job.next_run_at), 'dd/MM HH:mm', {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-sm text-destructive">
                          {job.last_error || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(job.updated_at), 'dd/MM HH:mm', {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => reindexOsMutation.mutate(job.os_id)}
                            disabled={reindexOsMutation.isPending}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum job encontrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
