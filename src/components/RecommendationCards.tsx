/**
 * Cards de recomendações acionáveis da IA
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import {
  Lightbulb,
  Calendar,
  Wrench,
  Plus,
  ChevronRight,
  Target,
} from 'lucide-react'
import { AIRecommendation } from '@/lib/report-types'

interface RecommendationCardsProps {
  recommendations: AIRecommendation[]
  onCreatePlan?: (rec: AIRecommendation) => void
  onCreateOS?: (rec: AIRecommendation) => void
  onAddToExisting?: (rec: AIRecommendation) => void
}

type BadgeVariant = NonNullable<BadgeProps['variant']>

const priorityConfig: Record<
  AIRecommendation['priority'],
  { color: BadgeVariant; label: string }
> = {
  alta: { color: 'destructive', label: 'Alta' },
  media: { color: 'default', label: 'Média' },
  baixa: { color: 'secondary', label: 'Baixa' },
}

const scopeLabels = {
  equipment: 'Equipamento',
  tag: 'Tag',
  model: 'Modelo',
}

export function RecommendationCards({
  recommendations,
  onCreatePlan,
  onCreateOS,
  onAddToExisting,
}: RecommendationCardsProps) {
  if (recommendations.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Lightbulb className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            Nenhuma recomendação disponível para este período.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Recomendações Acionáveis</h3>
        <Badge variant="secondary">{recommendations.length}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {recommendations.map((rec) => {
          const priority = priorityConfig[rec.priority]

          return (
            <Card key={rec.id} className="relative overflow-hidden">
              <div
                className={`absolute top-0 left-0 w-1 h-full ${
                  rec.priority === 'alta'
                    ? 'bg-destructive'
                    : rec.priority === 'media'
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                }`}
              />

              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">
                    {rec.title}
                  </CardTitle>
                  <Badge variant={priority.color} className="shrink-0">
                    {priority.label}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <span className="text-xs">
                    {scopeLabels[rec.targetScope]}:{' '}
                    {rec.targetValue || rec.targetId}
                  </span>
                  {rec.suggestedIntervalDays && (
                    <>
                      <span>•</span>
                      <span className="text-xs">
                        A cada {rec.suggestedIntervalDays} dias
                      </span>
                    </>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{rec.rationale}</p>

                {rec.checklistSteps.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Checklist sugerido:</span>
                    <ul className="mt-1 space-y-0.5">
                      {rec.checklistSteps.slice(0, 3).map((step, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <ChevronRight className="h-3 w-3" />
                          {step}
                        </li>
                      ))}
                      {rec.checklistSteps.length > 3 && (
                        <li className="text-primary">
                          +{rec.checklistSteps.length - 3} itens
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {(rec.expectedImpact.mttrDown || rec.expectedImpact.mtbfUp) && (
                  <div className="flex items-center gap-2 text-xs">
                    <Target className="h-3 w-3 text-primary" />
                    <span className="text-muted-foreground">
                      Impacto esperado:
                    </span>
                    {rec.expectedImpact.mttrDown && (
                      <Badge variant="outline" className="text-xs">
                        MTTR -{rec.expectedImpact.mttrDown}%
                      </Badge>
                    )}
                    {rec.expectedImpact.mtbfUp && (
                      <Badge variant="outline" className="text-xs">
                        MTBF +{rec.expectedImpact.mtbfUp}%
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onCreatePlan?.(rec)}
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    Criar Plano
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCreateOS?.(rec)}
                  >
                    <Wrench className="h-3 w-3 mr-1" />
                    Criar OS
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAddToExisting?.(rec)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
