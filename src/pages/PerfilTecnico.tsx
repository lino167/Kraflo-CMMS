import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  useTechnicianPerformance,
  useTeamPerformance,
  useTeamMTTRComparison,
  useTechnicianQualityScore,
} from "@/hooks/useTechnicianStats";
import { TechnicianPerformanceCard } from "@/components/TechnicianPerformanceCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Award,
  BarChart3,
  Bot,
  Crown,
  Loader2,
  Trophy,
  User,
  Users,
} from "lucide-react";

export default function PerfilTecnico() {
  const navigate = useNavigate();
  const { profile, user, isLoading: authLoading } = useAuth();

  const empresaId = profile?.empresa_id;
  const tecnicoId = profile?.id_telegram;

  const { data: myPerformance, isLoading: perfLoading } = useTechnicianPerformance(
    empresaId ?? undefined,
    tecnicoId ?? undefined
  );

  const { data: teamPerformance, isLoading: teamLoading } = useTeamPerformance(
    empresaId ?? undefined
  );

  const { data: mttrComparison } = useTeamMTTRComparison(
    empresaId ?? undefined,
    tecnicoId ?? undefined
  );

  // Quality Score calculado com 5 dias de não-reincidência
  const { data: qualityScoreData } = useTechnicianQualityScore(
    empresaId ?? undefined,
    tecnicoId ?? undefined
  );

  const isLoading = authLoading || perfLoading;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  // Get top performers for leaderboard
  const topPerformers = (teamPerformance || [])
    .sort((a, b) => b.quality_score - a.quality_score)
    .slice(0, 5);

  const myRank =
    (teamPerformance || [])
      .sort((a, b) => b.quality_score - a.quality_score)
      .findIndex((t) => t.tecnico_id === tecnicoId) + 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Floating Command Bridge Header */}
      <div className="pt-4 px-4 sticky top-0 z-50 w-full mb-6 relative">
        <header className="glass-panel rounded-2xl mx-auto container p-3 flex items-center justify-between shadow-surface glow-border">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="p-2 bg-primary rounded-lg">
                <Bot className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-foreground">
                  Meu Desempenho
                </h1>
                <p className="text-xs text-muted-foreground">
                  Dashboard de Performance Individual
                </p>
              </div>
            </div>
          </div>
        </header>
      </div>

      <main className="container mx-auto px-4 pb-6 mt-2">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal - Performance Individual */}
          <div className="lg:col-span-2 space-y-6">
            {/* Minha Performance */}
            <TechnicianPerformanceCard
              performance={myPerformance || null}
              mttrComparison={mttrComparison}
              isLoading={isLoading}
              overrideQualityScore={qualityScoreData?.qualityScore}
            />
          </div>

          {/* Coluna Lateral - Ranking da Equipe */}
          <div className="space-y-4">
            {/* Minha Posição */}
            {myRank > 0 && (
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Sua Posição no Ranking
                      </p>
                      <div className="text-4xl font-bold text-primary">
                        #{myRank}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        de {teamPerformance?.length || 0} técnicos
                      </p>
                    </div>
                    {myRank <= 3 && (
                      <Crown
                        className={`h-12 w-12 ${
                          myRank === 1
                            ? "text-yellow-500"
                            : myRank === 2
                            ? "text-slate-400"
                            : "text-amber-700"
                        }`}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ranking da Equipe */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  Ranking da Equipe
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teamLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : topPerformers.length > 0 ? (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {topPerformers.map((tech, index) => (
                        <div
                          key={tech.tecnico_id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            tech.tecnico_id === tecnicoId
                              ? "bg-primary/10 border border-primary/20"
                              : "bg-accent/50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                                index === 0
                                  ? "bg-yellow-500 text-yellow-950"
                                  : index === 1
                                  ? "bg-slate-400 text-slate-950"
                                  : index === 2
                                  ? "bg-amber-700 text-amber-50"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {index < 3 ? (
                                <Trophy className="h-4 w-4" />
                              ) : (
                                <span className="text-sm font-bold">{index + 1}</span>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {tech.nome_completo}
                                {tech.tecnico_id === tecnicoId && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    Você
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {tech.total_os_fechadas} OS • MTTR {tech.mttr_medio_horas.toFixed(1)}h
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`text-lg font-bold ${
                                tech.quality_score >= 90
                                  ? "text-emerald-600"
                                  : tech.quality_score >= 75
                                  ? "text-blue-600"
                                  : "text-orange-500"
                              }`}
                            >
                              {tech.quality_score}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum técnico encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dicas */}
            <Card className="bg-secondary/30">
              <CardContent className="pt-4">
                <h3 className="font-mono text-xs font-semibold text-muted-foreground uppercase mb-3">
                  Como Melhorar
                </h3>
                <ul className="text-xs text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <Award className="h-3 w-3 mt-0.5 text-primary" />
                    <span>Resolva OS sem gerar reincidências para aumentar seu Quality Score</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <BarChart3 className="h-3 w-3 mt-0.5 text-primary" />
                    <span>Compare seu MTTR com a média da equipe para identificar oportunidades</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Trophy className="h-3 w-3 mt-0.5 text-primary" />
                    <span>Resolver OS complexas (abertas há muito tempo) aumenta seu histórico de Herói</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
