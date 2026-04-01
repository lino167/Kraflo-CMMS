import { useState } from "react";
import { Loader2, CheckCircle2, Wrench, User, Calendar, ChevronDown, ChevronUp, Award, ClipboardCheck, TrendingUp, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSuccessCases, useMonthlyStats, useProblematicCases, SuccessCase } from "@/hooks/useEquipmentHistory";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

function StatsCards({ totalClosed, successCases, problematicCases, successRate }: { 
  totalClosed: number; 
  successCases: number;
  problematicCases: number;
  successRate: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <Card className="industrial-card">
        <CardContent className="pt-6 pb-6 text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-primary/10 mb-3 shadow-neon-sm border border-primary/20">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <p className="text-3xl font-mono font-bold tracking-tighter">{totalClosed}</p>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mt-1">OS Fechadas</p>
        </CardContent>
      </Card>
      
      <Card className="industrial-card">
        <CardContent className="pt-6 pb-6 text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-success/10 mb-3 shadow-neon-sm border border-success/20">
            <Award className="h-5 w-5 text-success" />
          </div>
          <p className="text-3xl font-mono font-bold text-success tracking-tighter">{successCases}</p>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mt-1">Sucessos</p>
        </CardContent>
      </Card>

      <Card className="industrial-card">
        <CardContent className="pt-6 pb-6 text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-destructive/10 mb-3 shadow-neon-sm border border-destructive/20">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <p className="text-3xl font-mono font-bold text-destructive tracking-tighter">{problematicCases}</p>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mt-1">Reincidências</p>
        </CardContent>
      </Card>
      
      <Card className="industrial-card">
        <CardContent className="pt-6 pb-6 text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-primary/20 mb-3 shadow-neon-sm border border-primary/30">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <p className="text-3xl font-mono font-bold text-primary tracking-tighter">{Math.round(successRate)}%</p>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mt-1">Taxa de Sucesso</p>
        </CardContent>
      </Card>
    </div>
  );
}

function CaseCard({ caseData, isExpanded, onToggle, isProblematic }: {
  caseData: SuccessCase; 
  isExpanded: boolean;
  onToggle: () => void;
  isProblematic?: boolean;
}) {
  const isCritical = caseData.status_reincidencia === "reincidencia_critica";
  
  return (
    <Card 
      className={`cursor-pointer transition-all duration-300 industrial-card group hover:border-primary/20 ${isExpanded ? 'ring-1 ring-primary/30 bg-primary/5' : ''}`}
      onClick={onToggle}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl shadow-surface-sm border ${isProblematic 
              ? (isCritical ? 'bg-destructive/10 border-destructive/20' : 'bg-orange-500/10 border-orange-500/20')
              : 'bg-success/10 border-success/20'
            }`}>
              {isProblematic ? (
                <XCircle className={`h-5 w-5 ${isCritical ? 'text-destructive' : 'text-orange-500'}`} />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-success" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg group-hover:text-primary transition-colors">{caseData.equipamento_nome}</CardTitle>
              <Badge variant="outline" className="mt-1 font-mono text-[10px] uppercase tracking-wider">
                {caseData.equipamento_tag}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isProblematic ? (
              <Badge variant="secondary" className={`${isCritical 
                ? 'bg-destructive/10 text-destructive border-destructive/20'
                : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
              } text-[10px] uppercase font-bold`}>
                <AlertTriangle className="h-3 w-3 mr-1" />
                {isCritical ? 'CRÍTICO' : 'ALERTA'}
                {caseData.dias_desde_ultima_solucao && (
                  <span className="ml-1">({Math.round(caseData.dias_desde_ultima_solucao)}d)</span>
                )}
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-success/10 text-success border-success/20 text-[10px] uppercase font-bold">
                <Award className="h-3 w-3 mr-1" />
                SUCESSO
              </Badge>
            )}
            <div className="p-1 rounded-full hover:bg-white/10 transition-colors">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 px-1">
          {caseData.descricao_problema}
        </p>
        
        <div className="flex items-center gap-4 mt-4 px-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border border-white/5 bg-white/5 px-2 py-1 rounded-md">
            <User className="h-3 w-3 text-primary" />
            {caseData.tecnico_nome}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border border-white/5 bg-white/5 px-2 py-1 rounded-md">
            <Calendar className="h-3 w-3 text-primary" />
            {format(new Date(caseData.data_fechamento), "dd MMM yyyy", { locale: ptBR })}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-white/10 space-y-6 animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 px-1">
                  Problema Relatado
                </h4>
                <div className="text-sm text-foreground/80 leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5 shadow-inner">
                  {caseData.descricao_problema}
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 px-1 ${isProblematic ? 'text-orange-500' : 'text-success'}`}>
                  <Wrench className="h-3 w-3" /> 
                  Solução Aplicada
                </h4>
                <div className={`text-sm leading-relaxed p-4 rounded-xl border shadow-inner ${isProblematic 
                  ? 'bg-orange-500/5 text-orange-200 border-orange-500/10'
                  : 'bg-success/5 text-success-foreground border-success/10'
                }`}>
                  {caseData.diagnostico_solucao}
                </div>
              </div>
            </div>

            {caseData.notas_finais && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Observações Adicionais</h4>
                <div className="text-sm text-muted-foreground/90 bg-white/5 p-4 rounded-xl border border-white/5">
                  {caseData.notas_finais}
                </div>
              </div>
            )}

            {isProblematic && caseData.dias_desde_ultima_solucao && (
              <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20 shadow-neon-sm">
                <p className="text-xs text-destructive font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  REINCIDÊNCIA CRÍTICA: Detectada apenas {Math.round(caseData.dias_desde_ultima_solucao)} dias após a última intervenção.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyStateComponent({ type }: { type: 'success' | 'problematic' }) {
  const isSuccess = type === 'success';
  return (
    <Card className="industrial-card border-dashed">
      <CardContent className="py-20 text-center">
        <div className="inline-flex items-center justify-center p-4 rounded-full bg-muted/20 mb-4">
          {isSuccess ? (
            <CheckCircle2 className="h-10 w-10 text-muted-foreground/30" />
          ) : (
            <AlertTriangle className="h-10 w-10 text-muted-foreground/30" />
          )}
        </div>
        <p className="text-lg font-medium text-foreground">
          {isSuccess 
            ? "Sem registros de sucesso"
            : "Nenhuma reincidência detectada"
          }
        </p>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
          {isSuccess 
            ? "Os casos de sucesso aparecerão aqui quando as manutenções forem concluídas definitivamente."
            : "Excelente! Todas as manutenções deste período foram resolvidas de forma definitiva."
          }
        </p>
      </CardContent>
    </Card>
  );
}

export default function EquipamentoRaioX() {
  const { profile, isLoading: authLoading } = useAuth();
  const empresaId = profile?.empresa_id;
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const currentMonthName = format(now, "MMMM 'de' yyyy", { locale: ptBR });

  const { data: successCases, isLoading: successLoading } = useSuccessCases(empresaId || undefined, 15, monthStart, monthEnd);
  const { data: problematicCases, isLoading: problematicLoading } = useProblematicCases(empresaId || undefined, 15, monthStart, monthEnd);
  const { data: monthlyStats, isLoading: statsLoading } = useMonthlyStats(empresaId || undefined, monthStart, monthEnd);

  const handleToggle = (osId: number) => {
    setExpandedId(expandedId === osId ? null : osId);
  };

  const isLoading = authLoading || successLoading || problematicLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest animate-pulse">Processando Dados...</p>
      </div>
    );
  }

  const problematicCount = problematicCases?.length || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col items-center text-center space-y-2">
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase tracking-[0.2em] font-bold px-3 py-1">
          Raio-X de Manutenção
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Análise de Performance Industrial</h1>
        <p className="text-muted-foreground capitalize font-medium text-lg">
          {currentMonthName}
        </p>
      </div>

      <StatsCards 
        totalClosed={monthlyStats?.totalClosed || 0}
        successCases={monthlyStats?.successCases || 0}
        problematicCases={problematicCount}
        successRate={monthlyStats?.successRate || 0}
      />

      <Tabs defaultValue="success" className="w-full">
        <TabsList className="grid w-full grid-cols-2 p-1.5 bg-muted/30 rounded-2xl border border-white/5 mb-8 h-14">
          <TabsTrigger value="success" className="rounded-xl flex items-center gap-3 data-[state=active]:bg-background data-[state=active]:shadow-surface transition-all duration-300">
            <Award className="h-4 w-4" />
            <span className="font-semibold">Casos de Sucesso</span>
            {successCases && successCases.length > 0 && (
              <Badge variant="secondary" className="ml-1 bg-success/10 text-success border-success/20 text-[10px]">
                {successCases.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="problematic" className="rounded-xl flex items-center gap-3 data-[state=active]:bg-background data-[state=active]:shadow-surface transition-all duration-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-semibold">Reincidências</span>
            {problematicCount > 0 && (
              <Badge variant="secondary" className="ml-1 bg-destructive/10 text-destructive border-destructive/20 text-[10px]">
                {problematicCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="success" className="space-y-4 outline-none">
          {!successCases || successCases.length === 0 ? (
            <EmptyStateComponent type="success" />
          ) : (
            successCases.map((caseData) => (
              <CaseCard
                key={caseData.os_id}
                caseData={caseData}
                isExpanded={expandedId === caseData.os_id}
                onToggle={() => handleToggle(caseData.os_id)}
                isProblematic={false}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="problematic" className="space-y-4 outline-none">
          {!problematicCases || problematicCases.length === 0 ? (
            <EmptyStateComponent type="problematic" />
          ) : (
            problematicCases.map((caseData) => (
              <CaseCard
                key={caseData.os_id}
                caseData={caseData}
                isExpanded={expandedId === caseData.os_id}
                onToggle={() => handleToggle(caseData.os_id)}
                isProblematic={true}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}