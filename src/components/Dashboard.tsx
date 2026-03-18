import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DateRangeFilter, DateRange } from '@/components/DateRangeFilter'
import { FrequentProblemsCard } from '@/components/FrequentProblemsCard'
import { TrendChart } from '@/components/TrendChart'
import { DashboardSkeleton } from '@/components/DashboardSkeleton'
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  Target,
  Repeat,
  BarChart3,
  Zap,
  Settings,
  AlertCircle,
  ExternalLink,
  Cpu,
  Activity,
} from 'lucide-react'
import { MTTRLineChart } from '@/components/MTTRLineChart'
import { TopMachinesChart } from '@/components/TopMachinesChart'
import { CategoryDistributionCard } from '@/components/CategoryDistributionCard'
import { ParetoCrossAnalysisCard } from '@/components/ParetoCrossAnalysisCard'
import {
  format,
  differenceInHours,
  parseISO,
  subDays,
  startOfDay,
  endOfDay,
  differenceInDays,
  startOfMonth,
  endOfMonth,
} from 'date-fns'


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
  tecnico_id: number
  localizacao: string | null
}

interface DashboardStats {
  osAbertas: number
  osFechadasHoje: number
  tempoMedioResolucao: number
  osUrgentes: number
}

interface EquipamentoProblematico {
  nome: string
  tag: string | null
  totalOS: number
  osAbertas: number
  ultimaOS: string
  mtbf: number // Mean Time Between Failures em dias
}

interface TendenciaData {
  semanaAtual: number
  semanaAnterior: number
  variacao: number
}

interface TipoManutencaoStats {
  tipo: string
  quantidade: number
  percentual: number
}

interface DashboardProps {
  onAskAI?: (question: string) => void
}

export function Dashboard({ onAskAI }: DashboardProps) {
  const navigate = useNavigate()
  const { profile, isAdminKraflo } = useAuth()
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  })
  const [stats, setStats] = useState<DashboardStats>({
    osAbertas: 0,
    osFechadasHoje: 0,
    tempoMedioResolucao: 0,
    osUrgentes: 0,
  })
  const [recentOS, setRecentOS] = useState<OS[]>([])
  const [equipamentosProblematicos, setEquipamentosProblematicos] = useState<
    EquipamentoProblematico[]
  >([])
  const [tendenciaAbertura, setTendenciaAbertura] = useState<TendenciaData>({
    semanaAtual: 0,
    semanaAnterior: 0,
    variacao: 0,
  })
  const [tendenciaFechamento, setTendenciaFechamento] = useState<TendenciaData>(
    { semanaAtual: 0, semanaAnterior: 0, variacao: 0 }
  )
  const [tiposManutencao, setTiposManutencao] = useState<TipoManutencaoStats[]>(
    []
  )
  const [taxaResolucao, setTaxaResolucao] = useState(0)
  const [osReincidentes, setOsReincidentes] = useState(0)
  const [idadeMediaAbertasHoras, setIdadeMediaAbertasHoras] = useState(0)
  
  
  const [atrasadas, setAtrasadas] = useState(0)
  const [dentroPrazo, setDentroPrazo] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true)

      let query = supabase
        .from('ordens_de_servico')
        .select('*')
        .gte('data_abertura', dateRange.from.toISOString())
        .lte('data_abertura', dateRange.to.toISOString())

      if (!isAdminKraflo && profile?.empresa_id) {
        query = query.eq('empresa_id', profile.empresa_id)
      }

      const { data: allOS, error } = await query.order('data_abertura', {
        ascending: false,
      })

      if (error) throw error

      if (allOS) {
        calculateStats(allOS)
        calculateEquipamentosProblematicos(allOS)
        calculateTendencias(allOS)
        calculateTiposManutencao(allOS)
        calculateReincidencia(allOS)
        calculateOperacional(allOS)
        calculateMensal(allOS)
        setRecentOS(allOS.slice(0, 8))
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [profile, isAdminKraflo, dateRange])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const calculateStats = (allOS: OS[]) => {
    const abertas = allOS.filter(
      (os) => os.status_os === 'Aberta' || os.status_os === 'Em manutenção'
    )
    const hoje = startOfDay(new Date())
    const fimHoje = endOfDay(new Date())

    const fechadasHoje = allOS.filter((os) => {
      if (!os.data_fechamento) return false
      const dataFechamento = parseISO(os.data_fechamento)
      return dataFechamento >= hoje && dataFechamento <= fimHoje
    })

    const urgentes = allOS.filter(
      (os) =>
        (os.status_os === 'Aberta' || os.status_os === 'Em manutenção') &&
        (os.prioridade === 'Alta' || os.prioridade === 'Urgente')
    )

    // Calculate average resolution time (MTTR)
    const osFechadas = allOS.filter((os) => os.data_fechamento)
    let tempoTotal = 0
    osFechadas.forEach((os) => {
      const abertura = parseISO(os.data_abertura)
      const fechamento = parseISO(os.data_fechamento!)
      tempoTotal += differenceInHours(fechamento, abertura)
    })
    const tempoMedio =
      osFechadas.length > 0 ? Math.round(tempoTotal / osFechadas.length) : 0

    let idadeTotalHoras = 0
    abertas.forEach((os) => {
      const abertura = parseISO(os.data_abertura)
      const agora = new Date()
      idadeTotalHoras += Math.max(
        0,
        (agora.getTime() - abertura.getTime()) / (1000 * 60 * 60)
      )
    })
    const idadeMedia =
      abertas.length > 0 ? Math.round(idadeTotalHoras / abertas.length) : 0
    setIdadeMediaAbertasHoras(idadeMedia)

    // Taxa de resolução
    const taxa =
      allOS.length > 0
        ? Math.round((osFechadas.length / allOS.length) * 100)
        : 0
    setTaxaResolucao(taxa)

    setStats({
      osAbertas: abertas.length,
      osFechadasHoje: fechadasHoje.length,
      tempoMedioResolucao: tempoMedio,
      osUrgentes: urgentes.length,
    })
  }

  const calculateOperacional = (allOS: OS[]) => {
    const abertas = allOS.filter(
      (os) => os.status_os === 'Aberta' || os.status_os === 'Em manutenção'
    )
    const agora = new Date()
    let atras = 0
    let prazo = 0
    abertas.forEach((os) => {
      const abertura = parseISO(os.data_abertura)
      const horas = (agora.getTime() - abertura.getTime()) / (1000 * 60 * 60)
      if (horas >= 24) atras += 1
      else prazo += 1
    })
    setAtrasadas(atras)
    setDentroPrazo(prazo)
  }

  const calculateMensal = (_allOS: OS[]) => {
    // Cálculo mensal removido pois os estados correspondentes foram deletados
  }

  const calculateEquipamentosProblematicos = (allOS: OS[]) => {
    const equipamentoMap = new Map<string, { os: OS[]; abertas: number }>()

    allOS.forEach((os) => {
      const key = `${os.equipamento_nome}|${os.equipamento_tag || ''}`
      const existing = equipamentoMap.get(key) || { os: [], abertas: 0 }
      existing.os.push(os)
      if (os.status_os === 'Aberta') existing.abertas++
      equipamentoMap.set(key, existing)
    })

    const problematicos: EquipamentoProblematico[] = []

    equipamentoMap.forEach((data, key) => {
      const [nome, tag] = key.split('|')
      const osSorted = data.os.sort(
        (a, b) =>
          new Date(b.data_abertura).getTime() -
          new Date(a.data_abertura).getTime()
      )

      // Calculate MTBF (Mean Time Between Failures)
      let mtbf = 0
      if (osSorted.length > 1) {
        let totalDays = 0
        for (let i = 0; i < osSorted.length - 1; i++) {
          totalDays += differenceInDays(
            parseISO(osSorted[i].data_abertura),
            parseISO(osSorted[i + 1].data_abertura)
          )
        }
        mtbf = Math.round(totalDays / (osSorted.length - 1))
      }

      if (data.os.length >= 2) {
        // Only show equipments with 2+ OS
        problematicos.push({
          nome,
          tag: tag || null,
          totalOS: data.os.length,
          osAbertas: data.abertas,
          ultimaOS: osSorted[0].data_abertura,
          mtbf: Math.abs(mtbf),
        })
      }
    })

    // Sort by total OS (most problematic first)
    problematicos.sort((a, b) => b.totalOS - a.totalOS)
    setEquipamentosProblematicos(problematicos.slice(0, 5))
  }

  const calculateTendencias = (allOS: OS[]) => {
    const hoje = new Date()
    const inicioSemanaAtual = subDays(hoje, 7)
    const inicioSemanaAnterior = subDays(hoje, 14)

    // Tendência de abertura
    const abertasSemanaAtual = allOS.filter((os) => {
      const data = parseISO(os.data_abertura)
      return data >= inicioSemanaAtual
    }).length

    const abertasSemanaAnterior = allOS.filter((os) => {
      const data = parseISO(os.data_abertura)
      return data >= inicioSemanaAnterior && data < inicioSemanaAtual
    }).length

    const variacaoAbertura =
      abertasSemanaAnterior > 0
        ? Math.round(
            ((abertasSemanaAtual - abertasSemanaAnterior) /
              abertasSemanaAnterior) *
              100
          )
        : 0

    setTendenciaAbertura({
      semanaAtual: abertasSemanaAtual,
      semanaAnterior: abertasSemanaAnterior,
      variacao: variacaoAbertura,
    })

    // Tendência de fechamento
    const fechadasSemanaAtual = allOS.filter((os) => {
      if (!os.data_fechamento) return false
      const data = parseISO(os.data_fechamento)
      return data >= inicioSemanaAtual
    }).length

    const fechadasSemanaAnterior = allOS.filter((os) => {
      if (!os.data_fechamento) return false
      const data = parseISO(os.data_fechamento)
      return data >= inicioSemanaAnterior && data < inicioSemanaAtual
    }).length

    const variacaoFechamento =
      fechadasSemanaAnterior > 0
        ? Math.round(
            ((fechadasSemanaAtual - fechadasSemanaAnterior) /
              fechadasSemanaAnterior) *
              100
          )
        : 0

    setTendenciaFechamento({
      semanaAtual: fechadasSemanaAtual,
      semanaAnterior: fechadasSemanaAnterior,
      variacao: variacaoFechamento,
    })
  }

  const calculateTiposManutencao = (allOS: OS[]) => {
    const tipoMap = new Map<string, number>()

    allOS.forEach((os) => {
      const tipo = os.tipo_manutencao || 'Não especificado'
      tipoMap.set(tipo, (tipoMap.get(tipo) || 0) + 1)
    })

    const total = allOS.length
    const tipos: TipoManutencaoStats[] = []

    tipoMap.forEach((quantidade, tipo) => {
      tipos.push({
        tipo,
        quantidade,
        percentual: total > 0 ? Math.round((quantidade / total) * 100) : 0,
      })
    })

    tipos.sort((a, b) => b.quantidade - a.quantidade)
    setTiposManutencao(tipos)
  }

  const calculateReincidencia = (allOS: OS[]) => {
    const equipamentoOS = new Map<string, number>()

    allOS.forEach((os) => {
      const key = `${os.equipamento_nome}|${os.equipamento_tag || ''}`
      equipamentoOS.set(key, (equipamentoOS.get(key) || 0) + 1)
    })

    let reincidentes = 0
    equipamentoOS.forEach((count) => {
      if (count > 1) reincidentes += count - 1
    })

    setOsReincidentes(reincidentes)
  }

  const getPrioridadeColor = (prioridade: string | null) => {
    switch (prioridade) {
      case 'Urgente':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'Alta':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20'
      case 'Média':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      case 'Baixa':
        return 'bg-green-500/10 text-green-500 border-green-500/20'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aberta':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'Em manutenção':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      case 'Não liberado':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'Fechada':
      case 'Liberado para produção':
        return 'bg-green-500/10 text-green-500 border-green-500/20'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'Corretiva':
        return 'text-red-500'
      case 'Preventiva':
        return 'text-blue-500'
      case 'Preditiva':
        return 'text-purple-500'
      default:
        return 'text-muted-foreground'
    }
  }

  if (isLoading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6 animate-slide-up-fade">
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-4 rounded-xl border-white/5 shadow-surface">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate('/equipamento')} variant="outline" size="sm" className="bg-background/50 hover:bg-primary/20 hover:text-primary transition-colors border-white/10">
            <Cpu className="h-4 w-4 mr-2" />
            Raio-X Equipamento
          </Button>
          <Button onClick={() => navigate('/meu-desempenho')} variant="outline" size="sm" className="bg-background/50 hover:bg-primary/20 hover:text-primary transition-colors border-white/10">
            <Activity className="h-4 w-4 mr-2" />
            Meu Desempenho
          </Button>
          <Button onClick={() => navigate('/ordens-servico')} variant="outline" size="sm" className="bg-background/50 hover:bg-primary/20 hover:text-primary transition-colors border-white/10">
            <ExternalLink className="h-4 w-4 mr-2" />
            Gerenciar OS
          </Button>
        </div>
      </div>

      <Tabs defaultValue="operacional" className="space-y-6 w-full">
        <TabsList className="grid w-full md:w-fit grid-cols-3 glass-panel border border-white/10 p-1 h-auto rounded-xl">
          <TabsTrigger value="operacional" className="rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-neon px-6 py-2">
            Visão Operacional
          </TabsTrigger>
          <TabsTrigger value="equipamentos" className="rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-neon px-6 py-2">
            Equipamentos
          </TabsTrigger>
          <TabsTrigger value="inteligencia" className="rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-neon px-6 py-2">
            Análises & Histórico
          </TabsTrigger>
        </TabsList>

        {/* --- ABA OPERACIONAL --- */}
        <TabsContent value="operacional" className="space-y-6 animate-slide-in-right">
          {/* KPI Cards - Bento Grid High Density */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
            <Card className="col-span-2 xl:col-span-2 industrial-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">OS Abertas</CardTitle>
                <ClipboardList className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-primary">{stats.osAbertas}</div>
                <p className="text-xs text-muted-foreground mt-1">aguardando resolução</p>
              </CardContent>
            </Card>

            <Card className="col-span-2 xl:col-span-2 industrial-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Fechadas Hoje</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-foreground">{stats.osFechadasHoje}</div>
                <p className="text-xs text-muted-foreground mt-1">concluídas nas últimas 24h</p>
              </CardContent>
            </Card>

            <Card className="col-span-2 xl:col-span-2 industrial-card border-white/5 relative overflow-hidden group">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">OS Urgentes</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500 group-hover:scale-110 transition-transform" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-foreground">{stats.osUrgentes}</div>
                <p className="text-xs text-muted-foreground mt-1">prioridade alta/urgente</p>
              </CardContent>
              {stats.osUrgentes > 0 && <div className="absolute top-0 right-0 w-1 h-full bg-red-500 animate-pulse-neon" />}
            </Card>

            <Card className="col-span-2 xl:col-span-2 industrial-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">MTTR</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-foreground">{stats.tempoMedioResolucao}h</div>
                <p className="text-xs text-muted-foreground mt-1">tempo médio de resolução</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="industrial-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Idade Média (Abertas)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-foreground">{idadeMediaAbertasHoras}h</div>
              </CardContent>
            </Card>

            <Card className="industrial-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Atrasadas (≥24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-red-400">{atrasadas}</div>
                <p className="text-xs text-muted-foreground mt-1">no prazo: {dentroPrazo}</p>
              </CardContent>
            </Card>

             <Card className="industrial-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Aberturas (7 dias)</CardTitle>
                {tendenciaAbertura.variacao <= 0 ? <TrendingDown className="h-3 w-3 text-green-500" /> : <TrendingUp className="h-3 w-3 text-red-500" />}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-foreground flex items-baseline gap-2">
                  {tendenciaAbertura.semanaAtual}
                  <span className={`text-xs ${tendenciaAbertura.variacao <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {tendenciaAbertura.variacao > 0 ? '+' : ''}{tendenciaAbertura.variacao}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="industrial-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Fechamentos (7 dias)</CardTitle>
                {tendenciaFechamento.variacao >= 0 ? <TrendingUp className="h-3 w-3 text-green-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-foreground flex items-baseline gap-2">
                  {tendenciaFechamento.semanaAtual}
                  <span className={`text-xs ${tendenciaFechamento.variacao >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {tendenciaFechamento.variacao > 0 ? '+' : ''}{tendenciaFechamento.variacao}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glow-border rounded-xl">
              <TrendChart dateRange={dateRange} />
            </div>
            <div className="glow-border rounded-xl">
              <MTTRLineChart dateRange={dateRange} />
            </div>
          </div>
        </TabsContent>

        {/* --- ABA EQUIPAMENTOS --- */}
        <TabsContent value="equipamentos" className="space-y-6 animate-slide-in-right">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="col-span-2 industrial-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Resolução</CardTitle>
                <Target className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-foreground">{taxaResolucao}%</div>
                <Progress value={taxaResolucao} className="mt-2 h-2 [&>div]:bg-green-400" />
              </CardContent>
            </Card>

            <Card className="col-span-2 industrial-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">OS Reincidentes</CardTitle>
                <Repeat className="h-4 w-4 text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-orange-400">{osReincidentes}</div>
                <p className="text-xs text-muted-foreground mt-2">equipamentos com múltiplas OS no período</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glow-border rounded-xl">
              <TopMachinesChart />
            </div>
            <div className="glow-border rounded-xl">
              <FrequentProblemsCard dateRange={dateRange} onAskAI={onAskAI} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
             <div className="glow-border rounded-xl">
              <ParetoCrossAnalysisCard dateRange={dateRange} />
             </div>

             {/* Equipamentos Problemáticos */}
             <Card className="glass-panel border-white/5">
              <CardHeader>
                <CardTitle className="font-mono text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Equipamentos Críticos
                </CardTitle>
                <CardDescription>
                  Menor MTBF (Mean Time Between Failures)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {equipamentosProblematicos.length > 0 ? (
                    equipamentosProblematicos.map((equip, index) => (
                      <div key={index} className="p-3 rounded-lg bg-secondary/30 border border-white/5 hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Settings className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm truncate text-foreground">{equip.nome}</span>
                              {equip.tag && (
                                <Badge variant="outline" className="text-xs bg-black/20 border-white/10">{equip.tag}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span>Total: {equip.totalOS}</span>
                              {equip.osAbertas > 0 && <span className="text-red-400">{equip.osAbertas} abertas</span>}
                              <span>MTBF: {equip.mtbf} dias</span>
                            </div>
                          </div>
                          <div className={`text-lg font-mono font-bold ${equip.mtbf < 7 ? 'text-red-500' : equip.mtbf < 14 ? 'text-orange-500' : 'text-primary'}`}>
                            {equip.totalOS}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-sm">Nenhum equipamento crítico.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- ABA INTELIGENCIA & OS --- */}
        <TabsContent value="inteligencia" className="space-y-6 animate-slide-in-right">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
             <div className="glow-border rounded-xl">
               <CategoryDistributionCard dateRange={dateRange} />
             </div>

             <Card className="glass-panel border-white/5">
              <CardHeader>
                <CardTitle className="font-mono text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Distribuição por Tipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {tiposManutencao.map((tipo, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${getTipoColor(tipo.tipo)}`}>
                          {tipo.tipo}
                        </span>
                        <span className="text-sm font-mono text-muted-foreground">
                          {tipo.quantidade} <span className="text-xs opacity-50">({tipo.percentual}%)</span>
                        </span>
                      </div>
                      <Progress
                        value={tipo.percentual}
                        className={`h-1.5 bg-black/20 ${tipo.tipo === 'Corretiva' ? '[&>div]:bg-red-500' : tipo.tipo === 'Preventiva' ? '[&>div]:bg-blue-500' : '[&>div]:bg-purple-500'}`}
                      />
                    </div>
                  ))}
                  {tiposManutencao.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-sm">Sem dados.</div>
                  )}
                  {tiposManutencao.length > 0 && tiposManutencao[0]?.tipo === 'Corretiva' && tiposManutencao[0]?.percentual > 70 && (
                    <div className="mt-6 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 glow-border">
                      <div className="flex items-start gap-2">
                        <Zap className="h-4 w-4 text-orange-500 mt-0.5 animate-pulse" />
                        <div className="text-xs text-muted-foreground">
                          <strong className="text-orange-400 mr-1">Atenção:</strong>
                          {tiposManutencao[0].percentual}% das manutenções são corretivas.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
           </div>

           <Card className="glass-panel border-white/5 col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-mono text-lg flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                Histórico Recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {recentOS.map((os, index) => (
                    <div key={os.id} className={`p-4 rounded-xl bg-secondary/30 border border-white/5 hover:bg-secondary/60 transition-colors animate-slide-up-fade stagger-${(index % 5) + 1}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-primary">OS #{os.id}</span>
                            <Badge variant="outline" className={`${getStatusColor(os.status_os)} border-transparent bg-background/50 backdrop-blur`}>{os.status_os}</Badge>
                            {os.prioridade && <Badge variant="outline" className={`${getPrioridadeColor(os.prioridade)} border-transparent bg-background/50 backdrop-blur`}>{os.prioridade}</Badge>}
                            {os.tipo_manutencao && <Badge variant="outline" className="bg-secondary/50 border-white/10">{os.tipo_manutencao}</Badge>}
                          </div>
                          <h4 className="font-medium text-foreground truncate text-base">
                            {os.equipamento_nome}
                            {os.equipamento_tag && <span className="text-muted-foreground ml-2 text-xs font-mono">[{os.equipamento_tag}]</span>}
                          </h4>
                          {os.descricao_problema && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{os.descricao_problema}</p>}
                        </div>
                        <div className="text-right text-xs text-muted-foreground shrink-0 bg-background/30 p-2 rounded-lg border border-white/5">
                          <div className="flex items-center gap-1.5 justify-end">
                            <Calendar className="h-3 w-3 text-primary" />
                            {format(parseISO(os.data_abertura), 'dd/MM/yyyy')}
                          </div>
                          <div className="flex items-center gap-1.5 justify-end mt-2">
                            <User className="h-3 w-3 text-primary" />
                            Téc. #{os.tecnico_id}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
