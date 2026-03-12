/**
 * Tabela de saúde do parque de equipamentos
 * Exibe equipamentos críticos com ações
 */

import { useState, type ComponentType } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  MoreHorizontal,
  Wrench,
  Calendar,
  FileText,
  Search,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  Clock,
} from 'lucide-react'
import { EquipmentStats, HealthStatus } from '@/lib/report-types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface EquipmentHealthTableProps {
  equipments: EquipmentStats[]
  isLoading?: boolean
  onCreatePreventive?: (equipment: EquipmentStats) => void
  onCreateOS?: (equipment: EquipmentStats) => void
  onViewHistory?: (equipment: EquipmentStats) => void
}

type BadgeVariant = NonNullable<BadgeProps['variant']>
type StatusIconComponent = ComponentType<{ className?: string }>

const healthConfig: Record<
  HealthStatus,
  { label: string; color: BadgeVariant; icon: StatusIconComponent }
> = {
  critical: { label: 'Crítico', color: 'destructive', icon: AlertCircle },
  warning: { label: 'Atenção', color: 'default', icon: AlertTriangle },
  good: { label: 'Bom', color: 'secondary', icon: CheckCircle },
}

export function EquipmentHealthTable({
  equipments,
  isLoading = false,
  onCreatePreventive,
  onCreateOS,
  onViewHistory,
}: EquipmentHealthTableProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredEquipments = equipments.filter(
    (eq) =>
      eq.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (eq.tag && eq.tag.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-primary" />
              Saúde do Parque de Equipamentos
            </CardTitle>
            <CardDescription>
              Equipamentos ordenados por criticidade
            </CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar equipamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredEquipments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {equipments.length === 0
              ? 'Nenhum equipamento com falhas no período'
              : 'Nenhum equipamento encontrado'}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Falhas</TableHead>
                  <TableHead className="text-right">MTTR (h)</TableHead>
                  <TableHead className="text-right">MTBF (d)</TableHead>
                  <TableHead className="text-right">Reincidência</TableHead>
                  <TableHead className="text-right">Último Evento</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEquipments.map((eq) => {
                  const config = healthConfig[eq.healthStatus]
                  const StatusIcon = config.icon

                  return (
                    <TableRow key={eq.nome}>
                      <TableCell>
                        <div className="font-medium">{eq.nome}</div>
                        {eq.tag && (
                          <div className="text-xs text-muted-foreground">
                            {eq.tag}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={config.color} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {eq.totalFalhas}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={eq.mttr > 8 ? 'text-destructive' : ''}>
                          {eq.mttr}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={eq.mtbf < 7 ? 'text-destructive' : ''}>
                          {eq.mtbf}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            eq.reincidencia > 30
                              ? 'text-destructive font-medium'
                              : ''
                          }
                        >
                          {eq.reincidencia}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {eq.ultimoEvento
                          ? format(eq.ultimoEvento, 'dd/MM', { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onCreatePreventive?.(eq)}
                            >
                              <Calendar className="h-4 w-4 mr-2" />
                              Criar plano preventivo
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onCreateOS?.(eq)}>
                              <Wrench className="h-4 w-4 mr-2" />
                              Criar OS preventiva
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onViewHistory?.(eq)}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Ver histórico
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Legenda */}
        <div className="flex items-center justify-end gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>MTTR = Tempo Médio de Reparo</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3" />
            <span>MTBF = Tempo Médio Entre Falhas</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
