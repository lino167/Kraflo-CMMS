import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, Wrench, User, Calendar, ChevronDown, ChevronUp, Award, ArrowLeft, ClipboardCheck, TrendingUp, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Card>
        <CardContent className="pt-4 pb-4 text-center">
          <div className="inline-flex items-center justify-center p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-2">
            <ClipboardCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-xl font-bold">{totalClosed}</p>
          <p className="text-xs text-muted-foreground">OS Fechadas</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-4 pb-4 text-center">
          <div className="inline-flex items-center justify-center p-2 rounded-full bg-green-100 dark:bg-green-900/30 mb-2">
            <Award className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{successCases}</p>
          <p className="text-xs text-muted-foreground">Sucessos</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-4 text-center">
          <div className="inline-flex items-center justify-center p-2 rounded-full bg-red-100 dark:bg-red-900/30 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">{problematicCases}</p>
          <p className="text-xs text-muted-foreground">Reincidências</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-4 pb-4 text-center">
          <div className="inline-flex items-center justify-center p-2 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-2">
            <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{successRate}%</p>
          <p className="text-xs text-muted-foreground">Taxa Sucesso</p>
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
      className={`cursor-pointer transition-all hover:shadow-md ${isExpanded ? 'ring-2 ring-primary/20' : ''}`}
      onClick={onToggle}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isProblematic 
              ? (isCritical ? 'bg-red-100 dark:bg-red-900/30' : 'bg-orange-100 dark:bg-orange-900/30')
              : 'bg-green-100 dark:bg-green-900/30'
            }`}>
              {isProblematic ? (
                <XCircle className={`h-5 w-5 ${isCritical ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`} />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              )}
            </div>
            <div>
              <CardTitle className="text-base">{caseData.equipamento_nome}</CardTitle>
              <Badge variant="outline" className="mt-1 font-mono text-xs">
                {caseData.equipamento_tag}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isProblematic ? (
              <Badge variant="secondary" className={`${isCritical 
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
              }`}>
                <AlertTriangle className="h-3 w-3 mr-1" />
                {isCritical ? 'Crítico' : 'Alerta'}
                {caseData.dias_desde_ultima_solucao && (
                  <span className="ml-1">({Math.round(caseData.dias_desde_ultima_solucao)}d)</span>
                )}
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Award className="h-3 w-3 mr-1" />
                Sucesso
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {caseData.descricao_problema}
        </p>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {caseData.tecnico_nome}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(caseData.data_fechamento), "dd MMM yyyy", { locale: ptBR })}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-4 animate-in slide-in-from-top-2">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <span className="text-red-500">⚠️</span> Problema Relatado
              </h4>
              <p className="text-sm bg-muted/50 p-3 rounded-lg">
                {caseData.descricao_problema}
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Wrench className={`h-4 w-4 ${isProblematic ? 'text-orange-600' : 'text-green-600'}`} /> 
                Solução Aplicada
              </h4>
              <p className={`text-sm p-3 rounded-lg border ${isProblematic 
                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              }`}>
                {caseData.diagnostico_solucao}
              </p>
            </div>

            {caseData.notas_finais && (
              <div>
                <h4 className="text-sm font-semibold mb-2">📝 Observações</h4>
                <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  {caseData.notas_finais}
                </p>
              </div>
            )}

            {isProblematic && caseData.dias_desde_ultima_solucao && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Reincidência detectada {Math.round(caseData.dias_desde_ultima_solucao)} dias após última manutenção
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ type }: { type: 'success' | 'problematic' }) {
  const isSuccess = type === 'success';
  return (
    <Card>
      <CardContent className="py-12 text-center">
        {isSuccess ? (
          <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        ) : (
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        )}
        <p className="text-muted-foreground">
          {isSuccess 
            ? "Ainda não há casos de sucesso registrados este mês."
            : "Nenhuma reincidência registrada este mês. 🎉"
          }
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {isSuccess 
            ? "Os casos aparecerão quando OS fechadas não gerarem reincidência."
            : "Todas as manutenções foram resolvidas definitivamente."
          }
        </p>
      </CardContent>
    </Card>
  );
}

export default function EquipamentoRaioX() {
  const navigate = useNavigate();
  const { profile, isLoading: authLoading } = useAuth();
  const empresaId = profile?.empresa_id;
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filtrar pelo mês atual
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const currentMonthName = format(now, "MMMM 'de' yyyy", { locale: ptBR });

  const { data: successCases, isLoading: successLoading } = useSuccessCases(empresaId || undefined, 10, monthStart, monthEnd);
  const { data: problematicCases, isLoading: problematicLoading } = useProblematicCases(empresaId || undefined, 10, monthStart, monthEnd);
  const { data: monthlyStats, isLoading: statsLoading } = useMonthlyStats(empresaId || undefined, monthStart, monthEnd);

  const handleToggle = (osId: number) => {
    setExpandedId(expandedId === osId ? null : osId);
  };

  const isLoading = authLoading || successLoading || problematicLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const problematicCount = problematicCases?.length || 0;

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Início
        </Button>
      </div>

      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Análise de Manutenções</h1>
        <p className="text-muted-foreground mt-1 capitalize">
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
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="success" className="gap-2">
            <Award className="h-4 w-4" />
            Casos de Sucesso
            {successCases && successCases.length > 0 && (
              <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">
                {successCases.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="problematic" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Reincidências
            {problematicCount > 0 && (
              <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
                {problematicCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="success" className="space-y-4">
          {!successCases || successCases.length === 0 ? (
            <EmptyState type="success" />
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

        <TabsContent value="problematic" className="space-y-4">
          {!problematicCases || problematicCases.length === 0 ? (
            <EmptyState type="problematic" />
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