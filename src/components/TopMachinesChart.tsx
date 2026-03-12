import { useEffect, useMemo, useState, useCallback } from 'react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Settings, Loader2, AlertCircle } from 'lucide-react'
import { startOfMonth, endOfMonth, parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface TopMachinesChartProps {
  month?: Date
}

interface MachineStats {
  equipamento: string
  tag: string | null
  osMes: number
  abertas: number
  mttr: number
}

export function TopMachinesChart({ month }: TopMachinesChartProps) {
  const { profile, isAdminKraflo } = useAuth()
  const [data, setData] = useState<MachineStats[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Prevent infinite reload when parent doesn't pass month (default new Date() would change every render)
  const monthKey = month?.getTime() ?? 0
  const monthDate = useMemo(() => month ?? new Date(), [month])

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const from = startOfMonth(monthDate).toISOString()
      const to = endOfMonth(monthDate).toISOString()

      let query = supabase
        .from('ordens_de_servico')
        .select(
          'equipamento_nome, equipamento_tag, status_os, data_abertura, data_fechamento',
        )
        .gte('data_abertura', from)
        .lte('data_abertura', to)

      if (!isAdminKraflo && profile?.empresa_id) {
        query = query.eq('empresa_id', profile.empresa_id)
      }

      const { data: osData, error } = await query
      if (error) throw error

      // Group by equipamento_nome + equipamento_tag
      const map = new Map<
        string,
        {
          tag: string | null
          osMes: number
          abertas: number
          mttrSum: number
          mttrCount: number
        }
      >()

      ;(osData || []).forEach((os) => {
        const key = `${os.equipamento_nome}|${os.equipamento_tag || ''}`
        const entry = map.get(key) || {
          tag: os.equipamento_tag,
          osMes: 0,
          abertas: 0,
          mttrSum: 0,
          mttrCount: 0,
        }
        entry.osMes += 1
        if (os.status_os === 'Aberta' || os.status_os === 'Em manutenção')
          entry.abertas += 1
        if (os.data_fechamento) {
          const open = parseISO(os.data_abertura)
          const close = parseISO(os.data_fechamento)
          entry.mttrSum += (close.getTime() - open.getTime()) / (1000 * 60 * 60)
          entry.mttrCount += 1
        }
        map.set(key, entry)
      })

      const rows: MachineStats[] = Array.from(map.entries())
        .map(([key, v]) => {
          const [nome] = key.split('|')
          return {
            equipamento: nome,
            tag: v.tag,
            osMes: v.osMes,
            abertas: v.abertas,
            mttr: v.mttrCount ? Math.round(v.mttrSum / v.mttrCount) : 0,
          }
        })
        .sort((a, b) => b.osMes - a.osMes)
        .slice(0, 5)

      setData(rows)
    } catch (error) {
      console.error('Error loading top machines:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isAdminKraflo, monthDate, profile?.empresa_id])

  useEffect(() => {
    // Only load data when auth is ready
    if (profile !== undefined && isAdminKraflo !== undefined) {
      loadData()
    }
  }, [profile, isAdminKraflo, monthKey, loadData])

  const monthLabel = format(monthDate, "MMMM 'de' yyyy", { locale: ptBR })

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Top 5 Equipamentos do Mês</CardTitle>
        </div>
        <CardDescription>
          Equipamentos com mais OS em {monthLabel}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="text-sm">Nenhum equipamento encontrado</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-3">
              {data.map((machine, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-secondary/30 border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-mono font-bold text-primary">
                          #{idx + 1}
                        </span>
                        <p className="text-sm font-medium text-foreground truncate">
                          {machine.equipamento}
                        </p>
                      </div>
                      {machine.tag && (
                        <Badge variant="outline" className="text-xs mt-1">
                          TAG: {machine.tag}
                        </Badge>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-mono font-bold text-foreground">
                        {machine.osMes}
                      </p>
                      <p className="text-xs text-muted-foreground">OS no mês</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className={machine.abertas > 0 ? 'text-red-400' : ''}>
                      {machine.abertas} abertas
                    </span>
                    <span>MTTR: {machine.mttr}h</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
