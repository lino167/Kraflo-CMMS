import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Wrench,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TimelineEvent } from "@/hooks/useEquipmentHistory";
import { cn } from "@/lib/utils";

interface EquipmentTimelineProps {
  events: TimelineEvent[];
  isLoading?: boolean;
}

function getStatusColor(status: string) {
  switch (status) {
    case "reincidencia_critica":
      return "text-destructive bg-destructive/10 border-destructive/30";
    case "reincidencia_alerta":
      return "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800";
    default:
      return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "reincidencia_critica":
      return <AlertTriangle className="h-4 w-4" />;
    case "reincidencia_alerta":
      return <AlertCircle className="h-4 w-4" />;
    default:
      return <CheckCircle2 className="h-4 w-4" />;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "reincidencia_critica":
      return "Reincidência Crítica";
    case "reincidencia_alerta":
      return "Reincidência";
    default:
      return "OK";
  }
}

function formatDuration(hours: number | null): string {
  if (!hours) return "-";
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round(hours / 24)}d`;
}

export function EquipmentTimeline({ events, isLoading }: EquipmentTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleItem = (osId: number) => {
    const newSet = new Set(expandedItems);
    if (newSet.has(osId)) {
      newSet.delete(osId);
    } else {
      newSet.add(osId);
    }
    setExpandedItems(newSet);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="w-3 h-3 rounded-full bg-muted mt-1.5" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum histórico encontrado para este equipamento.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Linha vertical da timeline */}
      <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-border" />

      <div className="space-y-4">
        {events.map(event => {
          const isExpanded = expandedItems.has(event.os_id);
          const statusColor = getStatusColor(event.status_reincidencia);
          const isOpen = event.status_os === "Aberta" || event.status_os === "Em manutenção";

          return (
            <div key={event.os_id} className="relative pl-8">
              {/* Bolinha da timeline */}
              <div
                className={cn(
                  "absolute left-0 top-3 w-3 h-3 rounded-full border-2 z-10",
                  event.status_reincidencia === "reincidencia_critica"
                    ? "bg-destructive border-destructive"
                    : event.status_reincidencia === "reincidencia_alerta"
                    ? "bg-orange-500 border-orange-500"
                    : isOpen
                    ? "bg-blue-500 border-blue-500"
                    : "bg-emerald-500 border-emerald-500"
                )}
              />

              <Collapsible open={isExpanded} onOpenChange={() => toggleItem(event.os_id)}>
                <Card
                  className={cn(
                    "transition-all hover:shadow-md",
                    event.status_reincidencia === "reincidencia_critica" &&
                      "border-destructive/50 bg-destructive/5"
                  )}
                >
                  <CollapsibleTrigger asChild>
                    <CardContent className="pt-3 pb-3 cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Data e badges */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-medium">
                              {format(new Date(event.data_abertura), "dd MMM yyyy", {
                                locale: ptBR,
                              })}
                            </span>
                            <Badge variant={isOpen ? "default" : "secondary"} className="text-xs">
                              {event.status_os}
                            </Badge>
                            {event.tipo_manutencao && (
                              <Badge variant="outline" className="text-xs">
                                {event.tipo_manutencao}
                              </Badge>
                            )}
                          </div>

                          {/* Problema */}
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {event.descricao_problema || "Sem descrição"}
                          </p>

                          {/* Métricas rápidas */}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {event.tecnico_nome && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {event.tecnico_nome}
                              </span>
                            )}
                            {event.horas_reparo && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(event.horas_reparo)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status de reincidência */}
                        <div className="flex flex-col items-end gap-2">
                          {event.status_reincidencia !== "ok" && (
                            <div
                              className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border",
                                statusColor
                              )}
                            >
                              {getStatusIcon(event.status_reincidencia)}
                              <span className="hidden sm:inline">
                                {event.dias_desde_ultima_solucao !== null &&
                                  `${Math.round(event.dias_desde_ultima_solucao)}d`}
                              </span>
                            </div>
                          )}
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 border-t">
                      <div className="space-y-3 pt-3">
                        {/* Detalhes da OS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-muted-foreground">Diagnóstico:</span>
                            <p className="mt-1">
                              {event.diagnostico_solucao || "Não informado"}
                            </p>
                          </div>
                          {event.notas_finais && (
                            <div>
                              <span className="font-medium text-muted-foreground">Notas:</span>
                              <p className="mt-1">{event.notas_finais}</p>
                            </div>
                          )}
                        </div>

                        {/* Alerta de reincidência */}
                        {event.status_reincidencia !== "ok" && (
                          <div
                            className={cn(
                              "p-3 rounded-lg border",
                              statusColor
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {getStatusIcon(event.status_reincidencia)}
                              <div className="text-sm">
                                <p className="font-medium">
                                  {getStatusLabel(event.status_reincidencia)}
                                </p>
                                <p className="text-xs opacity-80 mt-0.5">
                                  Esta falha ocorreu apenas{" "}
                                  <strong>
                                    {Math.round(event.dias_desde_ultima_solucao || 0)} dias
                                  </strong>{" "}
                                  após a última solução. Verifique se a causa raiz foi tratada.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Datas */}
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
                          <span>
                            <strong>Abertura:</strong>{" "}
                            {format(new Date(event.data_abertura), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}
                          </span>
                          {event.data_fechamento && (
                            <span>
                              <strong>Fechamento:</strong>{" "}
                              {format(new Date(event.data_fechamento), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                          )}
                          <span>
                            <strong>OS #</strong>
                            {event.os_id}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </div>
          );
        })}
      </div>
    </div>
  );
}
