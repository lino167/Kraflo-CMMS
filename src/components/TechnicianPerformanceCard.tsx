import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Award,
  BarChart3,
  Clock,
  Medal,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TechnicianPerformance,
  TeamMTTRComparison,
} from "@/hooks/useTechnicianStats";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface TechnicianPerformanceCardProps {
  performance: TechnicianPerformance | null;
  mttrComparison?: TeamMTTRComparison[];
  isLoading?: boolean;
  overrideQualityScore?: number; // Quality Score calculado com 5 dias
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function getQualityScoreColor(score: number): string {
  if (score >= 90) return "text-emerald-600";
  if (score >= 75) return "text-blue-600";
  if (score >= 60) return "text-orange-500";
  return "text-destructive";
}

function getQualityScoreLabel(score: number): string {
  if (score >= 95) return "Excelente";
  if (score >= 85) return "Muito Bom";
  if (score >= 75) return "Bom";
  if (score >= 60) return "Regular";
  return "Precisa Melhorar";
}

export function TechnicianPerformanceCard({
  performance,
  mttrComparison,
  isLoading,
  overrideQualityScore,
}: TechnicianPerformanceCardProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-4 w-32 bg-muted rounded mb-4" />
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!performance) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado de performance disponível.</p>
        </CardContent>
      </Card>
    );
  }

  const pieData = Object.entries(performance.os_por_tipo).map(([tipo, count]) => ({
    name: tipo,
    value: count,
  }));

  // Usa o quality score sobrescrito (5 dias) se fornecido, senão usa o da view (7 dias)
  const qualityScore = overrideQualityScore ?? performance.quality_score;

  return (
    <div className="space-y-4">
      {/* Card principal - Quality Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            {performance.nome_completo}
          </CardTitle>
          {performance.funcao && (
            <p className="text-sm text-muted-foreground">{performance.funcao}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Quality Score</div>
              <div
                className={`text-4xl font-bold ${getQualityScoreColor(qualityScore)}`}
              >
                {qualityScore}%
              </div>
              <div
                className={`text-sm font-medium ${getQualityScoreColor(qualityScore)}`}
              >
                {getQualityScoreLabel(qualityScore)}
              </div>
            </div>
            <div className="text-right">
              <Award
                className={`h-16 w-16 ${
                  qualityScore >= 90
                    ? "text-yellow-500"
                    : qualityScore >= 75
                    ? "text-slate-400"
                    : "text-amber-700"
                }`}
              />
            </div>
          </div>
          <Progress value={qualityScore} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">
            Taxa de OS sem reincidência em 5 dias
          </p>
        </CardContent>
      </Card>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Wrench className="h-4 w-4" />
              <span className="text-xs">OS Fechadas</span>
            </div>
            <div className="text-2xl font-bold">{performance.total_os_fechadas}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">MTTR Médio</span>
            </div>
            <div className="text-2xl font-bold">
              {performance.mttr_medio_horas < 24
                ? `${performance.mttr_medio_horas.toFixed(1)}h`
                : `${(performance.mttr_medio_horas / 24).toFixed(1)}d`}
            </div>
          </CardContent>
        </Card>

        <Card className={performance.total_retrabalhos > 0 ? "border-orange-200 bg-orange-50/50 dark:bg-orange-950/20" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs">Retrabalhos</span>
            </div>
            <div className={`text-2xl font-bold ${performance.total_retrabalhos > 0 ? "text-orange-600" : ""}`}>
              {performance.total_retrabalhos}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Medal className="h-4 w-4" />
              <span className="text-xs">OS Herói</span>
            </div>
            <div className="text-2xl font-bold">{performance.os_heroi.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de pizza - Tipos de OS */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Distribuição por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparativo MTTR */}
      {mttrComparison && mttrComparison.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              MTTR vs. Média da Equipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mttrComparison.slice(0, 5).map((item) => (
                <div key={item.tipo} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{item.tipo}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.meu_mttr}h</span>
                      <span className="text-muted-foreground">vs</span>
                      <span className="text-muted-foreground">{item.media_equipe}h</span>
                      <Badge
                        variant={item.diferenca_percentual <= 0 ? "default" : "secondary"}
                        className={`text-xs ${
                          item.diferenca_percentual <= -10
                            ? "bg-emerald-500"
                            : item.diferenca_percentual >= 10
                            ? "bg-orange-500"
                            : ""
                        }`}
                      >
                        {item.diferenca_percentual > 0 ? "+" : ""}
                        {item.diferenca_percentual}%
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 h-2">
                    <div
                      className="bg-primary rounded-l"
                      style={{
                        width: `${Math.min((item.meu_mttr / Math.max(item.meu_mttr, item.media_equipe)) * 100, 100)}%`,
                      }}
                    />
                    <div
                      className="bg-muted-foreground/30 rounded-r"
                      style={{
                        width: `${Math.min((item.media_equipe / Math.max(item.meu_mttr, item.media_equipe)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* OS Herói */}
      {performance.os_heroi.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Histórico de Herói
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              OS complexas resolvidas (abertas por mais de 48h)
            </p>
            <div className="space-y-2">
              {performance.os_heroi.slice(0, 5).map((os) => (
                <div
                  key={os.os_id}
                  className="flex items-center justify-between p-2 rounded bg-accent/50 text-sm"
                >
                  <div>
                    <span className="font-mono">{os.equipamento_tag || `OS #${os.os_id}`}</span>
                    <span className="text-muted-foreground ml-2">
                      {format(new Date(os.data_fechamento), "dd/MM/yy", { locale: ptBR })}
                    </span>
                  </div>
                  <Badge variant="outline">{Math.round(os.horas_aberto)}h aberta</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
