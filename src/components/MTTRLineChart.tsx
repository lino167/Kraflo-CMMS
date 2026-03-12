import { useEffect, useState, useCallback } from 'react'
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Loader2, Clock } from 'lucide-react'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DateRange } from './DateRangeFilter'

interface MTTRLineChartProps {
  dateRange: DateRange
}

interface DailyMTTR {
  date: string
  mttr: number
}

export function MTTRLineChart({ dateRange }: MTTRLineChartProps) {
  const { profile, isAdminKraflo } = useAuth()
  const [data, setData] = useState<DailyMTTR[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      let query = supabase
        .from('ordens_de_servico')
        .select('data_abertura, data_fechamento')
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
      const daily: DailyMTTR[] = days.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd')
        const closed = (osData || []).filter((os) => {
          if (!os.data_fechamento) return false
          const closeStr = format(parseISO(os.data_fechamento), 'yyyy-MM-dd')
          return closeStr === dayStr
        })
        let totalHours = 0
        closed.forEach((os) => {
          const open = parseISO(os.data_abertura)
          const close = parseISO(os.data_fechamento!)
          totalHours += (close.getTime() - open.getTime()) / (1000 * 60 * 60)
        })
        const mttr = closed.length ? Math.round(totalHours / closed.length) : 0
        return { date: format(day, 'dd/MM', { locale: ptBR }), mttr }
      })
      setData(daily)
    } catch (e) {
      console.error('MTTR chart error:', e)
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
          <Clock className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">MTTR por Dia</CardTitle>
        </div>
        <CardDescription>Tempo médio de resolução diário</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={data}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
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
            <Line
              type="monotone"
              dataKey="mttr"
              name="MTTR (h)"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
