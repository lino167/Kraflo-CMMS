import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { GitMerge, Info } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Line,
  ComposedChart,
} from 'recharts'
import { DateRange } from '@/components/DateRangeFilter'

interface CrossStat {
  label: string
  parada: string
  problema: string
  total: number
  percentual: number
  acumulado: number
}

interface ParetoCrossAnalysisCardProps {
  dateRange: DateRange
}

const BAR_COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 70%, 55%)',
  'hsl(25, 85%, 55%)',
  'hsl(190, 60%, 50%)',
  'hsl(35, 80%, 50%)',
  'hsl(170, 50%, 45%)',
  'hsl(45, 75%, 48%)',
  'hsl(150, 45%, 45%)',
  'hsl(5, 60%, 50%)',
  'hsl(130, 40%, 50%)',
]

export function ParetoCrossAnalysisCard({ dateRange }: ParetoCrossAnalysisCardProps) {
  const { profile, isAdminKraflo } = useAuth()
  const [data, setData] = useState<CrossStat[]>([])
  const [totalOS, setTotalOS] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)

      // Fetch ALL OS in range (not just ones with both categories)
      let query = supabase
        .from('ordens_de_servico')
        .select('categoria_parada_id, categoria_problema_id')
        .gte('data_abertura', dateRange.from.toISOString())
        .lte('data_abertura', dateRange.to.toISOString())

      if (!isAdminKraflo && profile?.empresa_id) {
        query = query.eq('empresa_id', profile.empresa_id)
      }

      const { data: allOsData, error } = await query

      if (error) throw error
      if (!allOsData || allOsData.length === 0) {
        setData([])
        setTotalOS(0)
        return
      }

      // Filter to ones with BOTH categories for Pareto
      const osData = allOsData.filter(
        (os) => os.categoria_parada_id && os.categoria_problema_id
      )

      // Track how many are missing classification
      const missingCount = allOsData.length - osData.length

      if (osData.length === 0) {
        // Fallback: show single-category distribution
        const paradaOnly = allOsData.filter((os) => os.categoria_parada_id)
        const problemaOnly = allOsData.filter((os) => os.categoria_problema_id)

        // Use whichever has more data
        const fallbackData = paradaOnly.length >= problemaOnly.length ? paradaOnly : problemaOnly
        const isParada = paradaOnly.length >= problemaOnly.length
        const categoryField = isParada ? 'categoria_parada_id' : 'categoria_problema_id'

        if (fallbackData.length === 0) {
          setData([])
          setTotalOS(0)
          return
        }

        const countMap = new Map<string, number>()
        fallbackData.forEach((os) => {
          const id = (os as any)[categoryField] as string
          countMap.set(id, (countMap.get(id) || 0) + 1)
        })

        const ids = [...countMap.keys()]
        const table = isParada ? 'categorias_parada' : 'categorias_problema'
        const { data: catData } = await supabase.from(table).select('id, nome').in('id', ids)
        const nameMap = new Map(catData?.map((c) => [c.id, c.nome]) || [])

        const entries = [...countMap.entries()]
          .map(([id, total]) => ({
            parada: isParada ? (nameMap.get(id) || 'Desconhecido') : '—',
            problema: !isParada ? (nameMap.get(id) || 'Desconhecido') : '—',
            total,
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)

        const grandTotal = entries.reduce((sum, e) => sum + e.total, 0)
        let cumulative = 0
        const result: CrossStat[] = entries.map((e) => {
          cumulative += e.total
          const label = isParada ? e.parada : e.problema
          return {
            label,
            parada: e.parada,
            problema: e.problema,
            total: e.total,
            percentual: Math.round((e.total / grandTotal) * 100),
            acumulado: Math.round((cumulative / grandTotal) * 100),
          }
        })

        setData(result)
        setTotalOS(fallbackData.length)
        return
      }

      setTotalOS(osData.length)

      // Count combinations
      const comboMap = new Map<string, number>()
      osData.forEach((os) => {
        const key = `${os.categoria_parada_id}|${os.categoria_problema_id}`
        comboMap.set(key, (comboMap.get(key) || 0) + 1)
      })

      // Get unique IDs
      const paradaIds = [...new Set(osData.map((os) => os.categoria_parada_id!))]
      const problemaIds = [...new Set(osData.map((os) => os.categoria_problema_id!))]

      const [paradaRes, problemaRes] = await Promise.all([
        supabase.from('categorias_parada').select('id, nome').in('id', paradaIds),
        supabase.from('categorias_problema').select('id, nome').in('id', problemaIds),
      ])

      const paradaNames = new Map(paradaRes.data?.map((c) => [c.id, c.nome]) || [])
      const problemaNames = new Map(problemaRes.data?.map((c) => [c.id, c.nome]) || [])

      // Build sorted array
      const entries = [...comboMap.entries()]
        .map(([key, total]) => {
          const [pId, rId] = key.split('|')
          return {
            parada: paradaNames.get(pId) || 'Desconhecido',
            problema: problemaNames.get(rId) || 'Desconhecido',
            total,
          }
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)

      // Calculate Pareto (cumulative %)
      const grandTotal = entries.reduce((sum, e) => sum + e.total, 0)
      let cumulative = 0
      const result: CrossStat[] = entries.map((e) => {
        cumulative += e.total
        return {
          label: `${e.parada} × ${e.problema}`,
          parada: e.parada,
          problema: e.problema,
          total: e.total,
          percentual: Math.round((e.total / grandTotal) * 100),
          acumulado: Math.round((cumulative / grandTotal) * 100),
        }
      })

      setData(result)
    } catch (error) {
      console.error('Error loading cross analysis:', error)
    } finally {
      setIsLoading(false)
    }
  }, [profile, isAdminKraflo, dateRange])

  useEffect(() => {
    loadData()
  }, [loadData])

  const pareto80Index = useMemo(() => {
    return data.findIndex((d) => d.acumulado >= 80)
  }, [data])

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-lg flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            Pareto: Parada × Causa Raiz
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhuma OS com ambas as categorias classificadas neste período
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="font-mono text-lg flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-primary" />
              Pareto: Parada × Causa Raiz
            </CardTitle>
            <CardDescription>
              Top 10 combinações em {totalOS} OS classificadas — linha = % acumulado
            </CardDescription>
          </div>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs text-xs">
                O princípio de Pareto (80/20) mostra que poucas combinações concentram a maioria das ocorrências. 
                Foque nas barras à esquerda da linha vermelha.
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ left: 5, right: 30, top: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={80}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'total') return [`${value} OS`, 'Ocorrências']
                if (name === 'acumulado') return [`${value}%`, '% Acumulado']
                return [value, name]
              }}
              labelFormatter={(label) => label}
            />
            <Bar yAxisId="left" dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index <= pareto80Index ? BAR_COLORS[index % BAR_COLORS.length] : 'hsl(var(--muted))'}
                  opacity={index <= pareto80Index ? 1 : 0.5}
                />
              ))}
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="acumulado"
              stroke="hsl(0, 70%, 55%)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'hsl(0, 70%, 55%)' }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend table */}
        <div className="mt-4 space-y-2">
          {data.slice(0, 5).map((item, i) => (
            <div key={item.label} className="flex items-center gap-3 text-sm">
              <div
                className="h-3 w-3 rounded-sm shrink-0"
                style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
              />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-foreground">{item.parada}</span>
                <span className="text-muted-foreground mx-1">→</span>
                <span className="text-foreground">{item.problema}</span>
              </div>
              <Badge variant="outline" className="shrink-0 font-mono text-xs">
                {item.total} OS ({item.percentual}%)
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
