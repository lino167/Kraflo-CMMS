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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Lightbulb, AlertCircle, Loader2, MessageSquare } from 'lucide-react'
import { DateRange } from './DateRangeFilter'

interface FrequentProblem {
  descricao: string
  equipamento: string
  tag: string | null
  count: number
  lastOccurrence: string
}

interface FrequentProblemsCardProps {
  dateRange: DateRange
  onAskAI?: (problem: string) => void
}

export function FrequentProblemsCard({
  dateRange,
  onAskAI,
}: FrequentProblemsCardProps) {
  const { profile, isAdminKraflo } = useAuth()
  const [problems, setProblems] = useState<FrequentProblem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadProblems = useCallback(async () => {
    try {
      setIsLoading(true)

      let query = supabase
        .from('ordens_de_servico')
        .select(
          'descricao_problema, equipamento_nome, equipamento_tag, data_abertura',
        )
        .gte('data_abertura', dateRange.from.toISOString())
        .lte('data_abertura', dateRange.to.toISOString())
        .not('descricao_problema', 'is', null)

      if (!isAdminKraflo && profile?.empresa_id) {
        query = query.eq('empresa_id', profile.empresa_id)
      }

      const { data, error } = await query

      if (error) throw error

      const problemMap = new Map<
        string,
        {
          count: number
          equipamentos: Set<string>
          tags: Set<string>
          lastDate: string
        }
      >()

      data?.forEach((os) => {
        const desc = os.descricao_problema?.toLowerCase().trim() || ''
        if (desc.length < 5) return

        const key = desc.substring(0, 50)
        const existing = problemMap.get(key)

        if (existing) {
          existing.count++
          existing.equipamentos.add(os.equipamento_nome)
          if (os.equipamento_tag) existing.tags.add(os.equipamento_tag)
          if (os.data_abertura > existing.lastDate) {
            existing.lastDate = os.data_abertura
          }
        } else {
          const equipSet = new Set<string>()
          equipSet.add(os.equipamento_nome)
          const tagSet = new Set<string>()
          if (os.equipamento_tag) tagSet.add(os.equipamento_tag)

          problemMap.set(key, {
            count: 1,
            equipamentos: equipSet,
            tags: tagSet,
            lastDate: os.data_abertura,
          })
        }
      })

      const frequentProblems: FrequentProblem[] = []
      problemMap.forEach((value, desc) => {
        if (value.count >= 2) {
          const equipArray = Array.from(value.equipamentos)
          const tagArray = Array.from(value.tags)

          frequentProblems.push({
            descricao: desc,
            equipamento:
              equipArray.length > 1
                ? `${equipArray[0]} (+${equipArray.length - 1})`
                : equipArray[0] || 'N/A',
            tag:
              tagArray.length > 0
                ? tagArray.length > 1
                  ? `${tagArray[0]} (+${tagArray.length - 1})`
                  : tagArray[0]
                : null,
            count: value.count,
            lastOccurrence: value.lastDate,
          })
        }
      })

      frequentProblems.sort((a, b) => b.count - a.count)
      setProblems(frequentProblems.slice(0, 5))
    } catch (error) {
      console.error('Error loading frequent problems:', error)
    } finally {
      setIsLoading(false)
    }
  }, [dateRange.from, dateRange.to, isAdminKraflo, profile?.empresa_id])

  useEffect(() => {
    // Only load when auth is ready
    if (profile !== undefined || isAdminKraflo !== undefined) {
      loadProblems()
    }
  }, [profile, isAdminKraflo, loadProblems])

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">
              Top 5 Problemas Frequentes
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            IA pode ajudar
          </Badge>
        </div>
        <CardDescription>
          Problemas recorrentes em equipamentos com tag
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : problems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="text-sm">Nenhum problema frequente encontrado</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-3">
              {problems.map((problem, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-secondary/30 border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-mono font-bold text-destructive">
                          #{idx + 1}
                        </span>
                        <p className="text-sm font-medium text-foreground truncate">
                          {problem.descricao}...
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {problem.equipamento}
                        </Badge>
                        {problem.tag && (
                          <Badge variant="secondary" className="text-xs">
                            TAG: {problem.tag}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {problem.count}x ocorrências
                        </span>
                      </div>
                    </div>
                    {onAskAI && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onAskAI(
                            `Como resolver o problema: ${problem.descricao} no equipamento ${problem.equipamento}${problem.tag ? ` (TAG: ${problem.tag})` : ''}?`,
                          )
                        }
                        className="shrink-0"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
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
