import {
  Activity,
  AlertTriangle,
  Clock,
  FileText,
  MapPin,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TagStats } from "@/hooks/useEquipmentHistory";

interface EquipmentStatsCardsProps {
  stats: TagStats | null;
  isLoading?: boolean;
}

export function EquipmentStatsCards({ stats, isLoading }: EquipmentStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-4 w-20 bg-muted rounded mb-2" />
              <div className="h-8 w-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const totalReincidencias = stats.total_reincidencias_criticas + stats.total_reincidencias_alerta;
  const taxaSaude =
    stats.total_os > 0
      ? Math.round(((stats.total_os - totalReincidencias) / stats.total_os) * 100)
      : 100;

  return (
    <div className="space-y-4">
      {/* Cabeçalho do equipamento */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                {stats.equipamento_nome || stats.tag}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="font-mono">
                  {stats.tag}
                </Badge>
                {stats.localizacao && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {stats.localizacao}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{taxaSaude}%</div>
              <div className="text-xs text-muted-foreground">Taxa de Saúde</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={taxaSaude} className="h-2" />
        </CardContent>
      </Card>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-xs">Total OS</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{stats.total_os}</span>
              {stats.os_abertas > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {stats.os_abertas} aberta{stats.os_abertas > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">MTTR Médio</span>
            </div>
            <div className="text-2xl font-bold">
              {stats.mttr_medio_horas !== null
                ? stats.mttr_medio_horas < 24
                  ? `${stats.mttr_medio_horas.toFixed(1)}h`
                  : `${(stats.mttr_medio_horas / 24).toFixed(1)}d`
                : "-"}
            </div>
          </CardContent>
        </Card>

        <Card
          className={
            stats.total_reincidencias_criticas > 0 ? "border-destructive/50 bg-destructive/5" : ""
          }
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle
                className={`h-4 w-4 ${
                  stats.total_reincidencias_criticas > 0 ? "text-destructive" : ""
                }`}
              />
              <span className="text-xs">Reincidências</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold ${
                  stats.total_reincidencias_criticas > 0 ? "text-destructive" : ""
                }`}
              >
                {totalReincidencias}
              </span>
              {stats.total_reincidencias_criticas > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {stats.total_reincidencias_criticas} crítica
                  {stats.total_reincidencias_criticas > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs">Tipos de Serviço</span>
            </div>
            <div className="text-2xl font-bold">
              {stats.tipos_manutencao ? Object.keys(stats.tipos_manutencao).length : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards secundários */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tipos de manutenção */}
        {stats.tipos_manutencao && Object.keys(stats.tipos_manutencao).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Tipos de Manutenção
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.tipos_manutencao)
                  .sort((a, b) => b[1] - a[1])
                  .map(([tipo, count]) => (
                    <div key={tipo} className="flex items-center justify-between text-sm">
                      <span>{tipo}</span>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={(count / stats.total_os) * 100}
                          className="w-20 h-1.5"
                        />
                        <span className="text-muted-foreground w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Técnicos frequentes */}
        {stats.tecnicos_frequentes && stats.tecnicos_frequentes.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Técnicos que Mais Atuaram
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.tecnicos_frequentes.map((tecnico, index) => (
                  <div key={tecnico.nome} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      {tecnico.nome}
                    </span>
                    <Badge variant="secondary">{tecnico.total} OS</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
