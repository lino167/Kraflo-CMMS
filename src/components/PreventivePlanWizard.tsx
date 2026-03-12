/**
 * Wizard para criação de plano preventivo
 * Dialog multi-step para gerar plano a partir do relatório
 */

import { useState, type ComponentType } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  Calendar,
  ClipboardList,
  Loader2,
} from 'lucide-react'
import { EquipmentStats } from '@/lib/report-types'
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'
import { toast } from '@/components/ui/sonner'
import { useAuth } from '@/hooks/useAuth'

interface PreventivePlanWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment?: EquipmentStats
  empresaId?: string
  onSuccess?: () => void
}

type Step = 'context' | 'signals' | 'proposal' | 'review'

type Periodicidade = Database['public']['Enums']['periodicidade_manutencao']
type StatusIconComponent = ComponentType<{ className?: string }>

const PERIODICIDADES: { value: Periodicidade; label: string; days: number }[] =
  [
    { value: 'semanal', label: 'Semanal', days: 7 },
    { value: 'mensal', label: 'Mensal', days: 30 },
    { value: 'bimestral', label: 'Bimestral', days: 60 },
    { value: 'trimestral', label: 'Trimestral', days: 90 },
  ]

const DEFAULT_CHECKLIST = [
  'Verificar estado geral do equipamento',
  'Inspecionar conexões elétricas',
  'Verificar níveis de óleo/lubrificante',
  'Limpar componentes críticos',
  'Testar funcionamento básico',
  'Verificar ruídos e vibrações anormais',
  'Documentar observações',
]

export function PreventivePlanWizard({
  open,
  onOpenChange,
  equipment,
  empresaId,
  onSuccess,
}: PreventivePlanWizardProps) {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState<Step>('context')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    titulo: equipment ? `Manutenção Preventiva - ${equipment.nome}` : '',
    objetivo: '',
    equipamentoNome: equipment?.nome || '',
    equipamentoTag: equipment?.tag || '',
    periodicidade: 'mensal' as Periodicidade,
    checklistItems: DEFAULT_CHECKLIST,
    customChecklistItem: '',
    tempoEstimado: 60,
    agendarProximos90Dias: true,
  })

  const steps: { id: Step; label: string; icon: StatusIconComponent }[] = [
    { id: 'context', label: 'Contexto', icon: Calendar },
    { id: 'signals', label: 'Sinais', icon: AlertTriangle },
    { id: 'proposal', label: 'Proposta', icon: ClipboardList },
    { id: 'review', label: 'Revisar', icon: Check },
  ]

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id)
    }
  }

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id)
    }
  }

  const handleAddChecklistItem = () => {
    if (formData.customChecklistItem.trim()) {
      setFormData((prev) => ({
        ...prev,
        checklistItems: [
          ...prev.checklistItems,
          prev.customChecklistItem.trim(),
        ],
        customChecklistItem: '',
      }))
    }
  }

  const handleRemoveChecklistItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      checklistItems: prev.checklistItems.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async () => {
    if (!empresaId || !user) {
      toast.error('Erro de autenticação')
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Criar plano
      const { data: plano, error: planoError } = await supabase
        .from('planos_manutencao')
        .insert({
          empresa_id: empresaId,
          equipamento_nome: formData.equipamentoNome || null,
          equipamento_tag: formData.equipamentoTag || null,
          titulo: formData.titulo,
          objetivo: formData.objetivo || null,
          periodicidade: formData.periodicidade,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (planoError) throw planoError

      // 2. Criar tarefa com checklist
      const checklist = formData.checklistItems.map((item) => ({
        item,
        obrigatorio: true,
      }))

      const periodicidade = PERIODICIDADES.find(
        (p) => p.value === formData.periodicidade,
      )
      const intervaloDias = periodicidade?.days || 30

      const { data: tarefa, error: tarefaError } = await supabase
        .from('tarefas_preventivas')
        .insert({
          plano_id: plano.id,
          titulo: formData.titulo,
          descricao: formData.objetivo,
          checklist,
          tempo_estimado_minutos: formData.tempoEstimado,
          intervalo_dias: intervaloDias,
          tags: formData.equipamentoTag
            ? [formData.equipamentoTag.toLowerCase()]
            : [],
        })
        .select('id')
        .single()

      if (tarefaError) throw tarefaError

      // 3. Agendar execuções para os próximos 90 dias (se selecionado)
      if (formData.agendarProximos90Dias) {
        const execucoes = []
        const hoje = new Date()
        const proximaData = new Date(hoje)
        proximaData.setDate(proximaData.getDate() + intervaloDias)

        const limite = new Date(hoje)
        limite.setDate(limite.getDate() + 90)

        while (proximaData <= limite) {
          execucoes.push({
            tarefa_id: tarefa.id,
            empresa_id: empresaId,
            agendado_para: proximaData.toISOString().split('T')[0],
            status: 'agendada',
          })
          proximaData.setDate(proximaData.getDate() + intervaloDias)
        }

        if (execucoes.length > 0) {
          const { error: execError } = await supabase
            .from('execucoes_preventivas')
            .insert(execucoes)

          if (execError) {
            console.error('Erro ao agendar execuções:', execError)
            // Não falha se não conseguir agendar
          }
        }
      }

      toast.success('Plano preventivo criado com sucesso!')
      onOpenChange(false)
      onSuccess?.()

      // Reset form
      setCurrentStep('context')
      setFormData({
        titulo: '',
        objetivo: '',
        equipamentoNome: '',
        equipamentoTag: '',
        periodicidade: 'mensal' as Periodicidade,
        checklistItems: DEFAULT_CHECKLIST,
        customChecklistItem: '',
        tempoEstimado: 60,
        agendarProximos90Dias: true,
      })
    } catch (error) {
      console.error('Erro ao criar plano:', error)
      toast.error('Erro ao criar plano preventivo')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'context':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título do Plano</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, titulo: e.target.value }))
                }
                placeholder="Ex: Manutenção Preventiva - Tear Picanol"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="equipamento">Equipamento</Label>
                <Input
                  id="equipamento"
                  value={formData.equipamentoNome}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      equipamentoNome: e.target.value,
                    }))
                  }
                  placeholder="Nome do equipamento"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag">Tag (opcional)</Label>
                <Input
                  id="tag"
                  value={formData.equipamentoTag}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      equipamentoTag: e.target.value,
                    }))
                  }
                  placeholder="Ex: TEAR-001"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="objetivo">Objetivo</Label>
              <Textarea
                id="objetivo"
                value={formData.objetivo}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, objetivo: e.target.value }))
                }
                placeholder="Descreva o objetivo deste plano preventivo..."
                rows={3}
              />
            </div>
          </div>
        )

      case 'signals':
        return (
          <div className="space-y-4">
            {equipment && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium">
                  Sinais detectados para {equipment.nome}
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Total de falhas:
                    </span>
                    <span className="font-medium">{equipment.totalFalhas}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">MTTR:</span>
                    <span className="font-medium">{equipment.mttr}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">MTBF:</span>
                    <span className="font-medium">{equipment.mtbf} dias</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reincidência:</span>
                    <span
                      className={`font-medium ${equipment.reincidencia > 30 ? 'text-destructive' : ''}`}
                    >
                      {equipment.reincidencia}%
                    </span>
                  </div>
                </div>
                {equipment.reincidencia > 30 && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded p-2">
                    <AlertTriangle className="h-4 w-4" />
                    Alta taxa de reincidência indica problemas recorrentes
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Periodicidade Sugerida</Label>
              <Select
                value={formData.periodicidade}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    periodicidade: value as Periodicidade,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODICIDADES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label} (a cada {p.days} dias)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {equipment && equipment.mtbf < 30 && (
                <p className="text-xs text-muted-foreground">
                  💡 Com MTBF de {equipment.mtbf} dias, recomendamos
                  periodicidade mais frequente.
                </p>
              )}
            </div>
          </div>
        )

      case 'proposal':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Checklist de Manutenção</Label>
              <ScrollArea className="h-48 border rounded-md p-2">
                <div className="space-y-2">
                  {formData.checklistItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded"
                    >
                      <span className="text-sm">{item}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveChecklistItem(index)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  value={formData.customChecklistItem}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      customChecklistItem: e.target.value,
                    }))
                  }
                  placeholder="Adicionar item ao checklist..."
                  onKeyDown={(e) =>
                    e.key === 'Enter' && handleAddChecklistItem()
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddChecklistItem}
                >
                  Adicionar
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tempo">Tempo estimado (minutos)</Label>
              <Input
                id="tempo"
                type="number"
                value={formData.tempoEstimado}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    tempoEstimado: parseInt(e.target.value) || 60,
                  }))
                }
                min={15}
                max={480}
              />
            </div>
          </div>
        )

      case 'review': {
        const periodicidade = PERIODICIDADES.find(
          (p) => p.value === formData.periodicidade,
        )
        return (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold">{formData.titulo}</h4>
              {formData.objetivo && (
                <p className="text-sm text-muted-foreground">
                  {formData.objetivo}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {formData.equipamentoNome && (
                  <Badge variant="outline">{formData.equipamentoNome}</Badge>
                )}
                {formData.equipamentoTag && (
                  <Badge variant="secondary">{formData.equipamentoTag}</Badge>
                )}
                <Badge>{periodicidade?.label}</Badge>
                <Badge variant="outline">{formData.tempoEstimado} min</Badge>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">
                Checklist ({formData.checklistItems.length} itens)
              </Label>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {formData.checklistItems.slice(0, 5).map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
                {formData.checklistItems.length > 5 && (
                  <li className="text-primary">
                    + {formData.checklistItems.length - 5} itens
                  </li>
                )}
              </ul>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="agendar"
                checked={formData.agendarProximos90Dias}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    agendarProximos90Dias: !!checked,
                  }))
                }
              />
              <Label htmlFor="agendar" className="text-sm cursor-pointer">
                Agendar execuções para os próximos 90 dias
              </Label>
            </div>
          </div>
        )
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Plano Preventivo</DialogTitle>
          <DialogDescription>
            Configure um plano de manutenção preventiva baseado nos dados do
            relatório
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => {
            const StepIcon = step.icon
            const isActive = index === currentStepIndex
            const isComplete = index < currentStepIndex

            return (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={`
                  flex items-center justify-center w-8 h-8 rounded-full
                  ${isComplete ? 'bg-primary text-primary-foreground' : ''}
                  ${isActive ? 'bg-primary/20 text-primary border-2 border-primary' : ''}
                  ${!isActive && !isComplete ? 'bg-muted text-muted-foreground' : ''}
                `}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`text-xs hidden sm:block ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                >
                  {step.label}
                </span>
                {index < steps.length - 1 && (
                  <div
                    className={`w-8 h-0.5 ${isComplete ? 'bg-primary' : 'bg-muted'}`}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Content */}
        <div className="min-h-[280px]">{renderStepContent()}</div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStepIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          {currentStep === 'review' ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.titulo}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Criar Plano
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Próximo
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
