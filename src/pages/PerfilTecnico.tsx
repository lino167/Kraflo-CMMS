import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  useTechnicianPerformance,
  useTeamPerformance,
  useTeamMTTRComparison,
  useTechnicianQualityScore,
} from "@/hooks/useTechnicianStats";
import { TechnicianPerformanceCard } from "@/components/TechnicianPerformanceCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Award,
  BarChart3,
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

  const { data: qualityScoreData } = useTechnicianQualityScore(
    empresaId ?? undefined,
    tecnicoId ?? undefined
  );

  const isLoading = authLoading || perfLoading;

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest animate-pulse">Carregando Perfil...</p>
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  const topPerformers = (teamPerformance || [])
    .sort((a, b) => b.quality_score - a.quality_score)
    .slice(0, 10);

  const myRank =
    (teamPerformance || [])
      .sort((a, b) => b.quality_score - a.quality_score)
      .findIndex((t) => t.tecnico_id === tecnicoId) + 1;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col items-start space-y-2">
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase tracking-[0.2em] font-bold px-3 py-1">
          Dashboard de Performance
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Meu Desempenho Técnico</h1>
        <p className="text-muted-foreground font-medium">
          Acompanhe suas métricas de resolução e qualidade industrial.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <TechnicianPerformanceCard
            performance={myPerformance || null}
            mttrComparison={mttrComparison}
            isLoading={isLoading}
            overrideQualityScore={qualityScoreData?.qualityScore}
          />
          
          <Card className="bg-secondary/10 border-white/5 industrial-card">
            <CardContent className="pt-6">
              <h3 className="font-mono text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-6">
                Guia de Excelência Técnica
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <Award className="h-4 w-4 text-primary" />
                    Quality Score
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Resolva OS sem gerar reincidências nos primeiros 5 dias para maximizar sua pontuação de qualidade.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    MTTR Médio
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Mantenha seu tempo médio de reparo abaixo da média da equipe para subir no ranking de eficiência.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <Trophy className="h-4 w-4 text-primary" />
                    Histórico Herói
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Resolver ordens de serviço complexas ou críticas gera maior prestígio no algoritmo de performance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {myRank > 0 && (
            <Card className="bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border-primary/20 shadow-neon-sm industrial-card relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Trophy className="h-24 w-24 text-primary" />
              </div>
              <CardContent className="pt-8 pb-6 relative z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                      Sua Posição Atual
                    </p>
                    <div className="text-6xl font-mono font-bold text-primary tracking-tighter">
                      #{myRank}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mt-2">
                      Ranked entre <span className="text-foreground">{teamPerformance?.length || 0} especialistas</span>
                    </p>
                  </div>
                  {myRank <= 3 && (
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
                      <Crown
                        className={`h-12 w-12 ${
                          myRank === 1
                            ? "text-yellow-500 drop-shadow-neon-yellow"
                            : myRank === 2
                            ? "text-slate-300"
                            : "text-amber-600"
                        }`}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="industrial-card border-white/5 bg-black/20">
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="flex items-center gap-3 text-sm font-bold uppercase tracking-widest">
                <Users className="h-4 w-4 text-primary" />
                Elite da Equipe
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {teamLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
                </div>
              ) : topPerformers.length > 0 ? (
                <ScrollArea className="h-[450px]">
                  <div className="divide-y divide-white/5">
                    {topPerformers.map((tech, index) => (
                      <div
                        key={tech.tecnico_id}
                        className={`flex items-center justify-between p-4 transition-all duration-300 ${
                          tech.tecnico_id === tecnicoId
                            ? "bg-primary/10"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex items-center justify-center w-8 h-8 rounded-lg font-mono text-xs font-bold border ${
                              index === 0
                                ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                                : index === 1
                                ? "bg-slate-300/20 text-slate-300 border-slate-300/30"
                                : index === 2
                                ? "bg-amber-600/20 text-amber-600 border-amber-600/30"
                                : "bg-white/5 text-muted-foreground border-white/10"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-foreground flex items-center gap-2">
                              {tech.nome_completo.split(' ')[0]} {tech.nome_completo.split(' ').slice(-1)}
                              {tech.tecnico_id === tecnicoId && (
                                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                              )}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {tech.total_os_fechadas} OS • MTTR {tech.mttr_medio_horas.toFixed(1)}h
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-sm font-mono font-bold ${
                              tech.quality_score >= 90
                                ? "text-success"
                                : tech.quality_score >= 75
                                ? "text-primary"
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
                <div className="text-center py-12 space-y-3">
                  <User className="h-10 w-10 mx-auto opacity-10" />
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
