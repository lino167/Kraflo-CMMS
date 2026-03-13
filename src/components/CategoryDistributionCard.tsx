import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tag } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { DateRange } from '@/components/DateRangeFilter'

interface CategoryStat {
  nome: string
  total: number
  percentual: number
}

interface CategoryDistributionCardProps {
  dateRange: DateRange
}

const COLORS_PARADA = [
  'hsl(var(--primary))',
  'hsl(210, 70%, 55%)',
  'hsl(190, 60%, 50%)',
  'hsl(170, 50%, 45%)',
  'hsl(150, 45%, 45%)',
  'hsl(130, 40%, 50%)',
]

const COLORS_PROBLEMA = [
  'hsl(25, 85%, 55%)',
  'hsl(35, 80%, 50%)',
  'hsl(45, 75%, 48%)',
  'hsl(55, 65%, 45%)',
  'hsl(15, 70%, 50%)',
  'hsl(5, 60%, 50%)',
]

export function CategoryDistributionCard({ dateRange }: CategoryDistributionCardProps) {
  const { profile, isAdminKraflo } = useAuth()
  const [categoriasParada, setCategoriasParada] = useState<CategoryStat[]>([])
  const [categoriasProblema, setCategoriasProblema] = useState<CategoryStat[]>([])
  const [totalOS, setTotalOS] = useState(0)
  const [semCategoria, setSemCategoria] = useState({ parada: 0, problema: 0 })
  const [isLoading, setIsLoading] = useState(true)

  const loadCategoryData = useCallback(async () => {
    try {
      setIsLoading(true)

      let query = supabase
        .from('ordens_de_servico')
        .select('categoria_parada_id, categoria_problema_id')
        .gte('data_abertura', dateRange.from.toISOString())
        .lte('data_abertura', dateRange.to.toISOString())

      if (!isAdminKraflo && profile?.empresa_id) {
        query = query.eq('empresa_id', profile.empresa_id)
      }

      const { data: osData, error } = await query

      if (error) throw error
      if (!osData || osData.length === 0) {
        setCategoriasParada([])
        setCategoriasProblema([])
        setTotalOS(0)
        return
      }

      setTotalOS(osData.length)

      // Contar por categoria de parada
      const paradaIds = osData
        .map((os) => os.categoria_parada_id)
        .filter(Boolean) as string[]
      const problemaIds = osData
        .map((os) => os.categoria_problema_id)
        .filter(Boolean) as string[]

      setSemCategoria({
        parada: osData.length - paradaIds.length,
        problema: osData.length - problemaIds.length,
      })

      // Buscar nomes das categorias
      if (paradaIds.length > 0) {
        const paradaCount = new Map<string, number>()
        paradaIds.forEach((id) => paradaCount.set(id, (paradaCount.get(id) || 0) + 1))

        const uniqueIds = [...new Set(paradaIds)]
        const { data: catParada } = await supabase
          .from('categorias_parada')
          .select('id, nome')
          .in('id', uniqueIds)

        if (catParada) {
          const stats: CategoryStat[] = catParada
            .map((cat) => ({
              nome: cat.nome,
              total: paradaCount.get(cat.id) || 0,
              percentual: Math.round(((paradaCount.get(cat.id) || 0) / osData.length) * 100),
            }))
            .sort((a, b) => b.total - a.total)
          setCategoriasParada(stats)
        }
      } else {
        setCategoriasParada([])
      }

      if (problemaIds.length > 0) {
        const problemaCount = new Map<string, number>()
        problemaIds.forEach((id) => problemaCount.set(id, (problemaCount.get(id) || 0) + 1))

        const uniqueIds = [...new Set(problemaIds)]
        const { data: catProblema } = await supabase
          .from('categorias_problema')
          .select('id, nome')
          .in('id', uniqueIds)

        if (catProblema) {
          const stats: CategoryStat[] = catProblema
            .map((cat) => ({
              nome: cat.nome,
              total: problemaCount.get(cat.id) || 0,
              percentual: Math.round(((problemaCount.get(cat.id) || 0) / osData.length) * 100),
            }))
            .sort((a, b) => b.total - a.total)
          setCategoriasProblema(stats)
        }
      } else {
        setCategoriasProblema([])
      }
    } catch (error) {
      console.error('Error loading category data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [profile, isAdminKraflo, dateRange])

  useEffect(() => {
    loadCategoryData()
  }, [loadCategoryData])

  const renderBarChart = (data: CategoryStat[], colors: string[]) => {
    if (data.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhuma OS categorizada neste período
        </div>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis
            type="category"
            dataKey="nome"
            width={130}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: number, _name: string, props: any) => [
              `${value} OS (${props.payload.percentual}%)`,
              'Total',
            ]}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  const renderProgressList = (data: CategoryStat[], colors: string[]) => {
    if (data.length === 0) return null

    return (
      <div className="space-y-3 mt-4">
        {data.map((cat, index) => (
          <div key={cat.nome}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">{cat.nome}</span>
              <span className="text-sm text-muted-foreground font-mono">
                {cat.total} ({cat.percentual}%)
              </span>
            </div>
            <Progress
              value={cat.percentual}
              className="h-2"
              style={{
                '--progress-color': colors[index % colors.length],
              } as React.CSSProperties}
            />
          </div>
        ))}
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-48 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="font-mono text-lg flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          Distribuição por Categorias
        </CardTitle>
        <CardDescription>
          Análise de {totalOS} OS por motivo de parada e causa raiz
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="parada" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="parada" className="text-xs sm:text-sm">
              🔴 Motivo de Parada
            </TabsTrigger>
            <TabsTrigger value="problema" className="text-xs sm:text-sm">
              🔧 Causa Raiz
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parada">
            {renderBarChart(categoriasParada, COLORS_PARADA)}
            {semCategoria.parada > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {semCategoria.parada} OS sem categoria ({Math.round((semCategoria.parada / totalOS) * 100)}%)
                </Badge>
              </div>
            )}
          </TabsContent>

          <TabsContent value="problema">
            {renderBarChart(categoriasProblema, COLORS_PROBLEMA)}
            {semCategoria.problema > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {semCategoria.problema} OS sem causa raiz ({Math.round((semCategoria.problema / totalOS) * 100)}%)
                </Badge>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
