import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {


  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts'
import { TrendingUp, Loader2 } from 'lucide-react'
import {
  format,


  parseISO,
  eachDayOfInterval,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DateRange } from './DateRangeFilter'

interface TrendChartProps {
  dateRange: DateRange
}

interface DailyData {
  date: string
  abertas: number
  fechadas: number
}

export function TrendChart({ dateRange }: TrendChartProps) {
  const { profile, isAdminKraflo } = useAuth()
  const [data, setData] = useState<DailyData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)

      let query = supabase
        .from('ordens_de_servico')
        .select('data_abertura, data_fechamento, status_os')
        .gte('data_abertura', dateRange.from.toISOString())
        .lte('data_abertura', dateRange.to.toISOString())

      if (!isAdminKraflo && profile?.empresa_id) {
        query = query.eq('empresa_id', profile.empresa_id)
      }

      const { data: osData, error } = await query

      if (error) throw error

      const days = eachDayOfInterval({
        start: dateRange.from,
        end: dateRange.to,
      })

      const dailyData: DailyData[] = days.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd')

        const abertas =
          osData?.filter((os) => {
            const osDate = format(parseISO(os.data_abertura), 'yyyy-MM-dd')
            return osDate === dayStr
          }).length || 0

        const fechadas =
          osData?.filter((os) => {
            if (!os.data_fechamento) return false
            const osDate = format(parseISO(os.data_fechamento), 'yyyy-MM-dd')
            return osDate === dayStr
          }).length || 0

        return {
          date: format(day, 'dd/MM', { locale: ptBR }),
          abertas,
          fechadas,
        }
      })

      setData(dailyData)
    } catch (error) {
      console.error('Error loading trend data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [dateRange.from, dateRange.to, isAdminKraflo, profile?.empresa_id])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Evolução de OS</CardTitle>
        </div>
        <CardDescription>
          Comparativo entre ordens abertas e fechadas no período
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorAbertas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorFechadas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 25%)" />
            <XAxis
              dataKey="date"
              stroke="hsl(210 10% 55%)"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(210 10% 55%)"
              fontSize={11}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(220 18% 13%)',
                border: '1px solid hsl(220 15% 20%)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'hsl(210 20% 95%)' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            <Area
              type="monotone"
              dataKey="abertas"
              name="Abertas"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#colorAbertas)"
            />
            <Area
              type="monotone"
              dataKey="fechadas"
              name="Fechadas"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#colorFechadas)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
