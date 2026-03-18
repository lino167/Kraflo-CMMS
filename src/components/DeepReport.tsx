import { useState } from "react";
import { 
  BarChart3, 
  Calendar, 
  Loader2, 
  Download,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Target,

  Tag,


} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/error-handler";
import { toast } from "@/components/ui/sonner";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { IndexingCoverageBanner } from "@/components/IndexingCoverageBanner";
import { EquipmentHealthTable } from "@/components/EquipmentHealthTable";
import { TagProblemsCard } from "@/components/TagProblemsCard";
import { TrendCharts } from "@/components/TrendCharts";
import { ServiceTypeBreakdown } from "@/components/ServiceTypeBreakdown";
import { PreventivePlanWizard } from "@/components/PreventivePlanWizard";

import { useDeepReportStats, DeepPeriodType, DEEP_PERIOD_OPTIONS } from "@/hooks/useDeepReportStats";
import { EquipmentStats } from "@/lib/report-types";

interface DeepReportProps {
  empresaId?: string;
}

export function DeepReport({ empresaId }: DeepReportProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<DeepPeriodType | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardEquipment, setWizardEquipment] = useState<EquipmentStats | null>(null);

  const { data: reportData, isLoading, refetch } = useDeepReportStats({
    period: selectedPeriod || '1m',
    enabled: !!selectedPeriod,
  });

  const handlePeriodSelect = (period: DeepPeriodType) => {
    setSelectedPeriod(period);
  };

  const handleRequestBackfill = async () => {
    try {
      await supabase.functions.invoke('backfill-os-index', {
        body: { empresa_id: empresaId }
      });
      toast.success('Indexação iniciada');
      setTimeout(() => refetch(), 5000);
    } catch (error) {
      handleError(error, { showToast: true });
    }
  };

  const handleCreatePreventive = (equipment: EquipmentStats) => {
    setWizardEquipment(equipment);
    setWizardOpen(true);
  };

  const handleCreateOS = (equipment: EquipmentStats) => {
    toast.info(`Criar OS preventiva para ${equipment.nome} - funcionalidade em desenvolvimento`);
  };

  const mapCriticalToEquipmentStats = (): EquipmentStats[] => {
    if (!reportData?.criticalEquipment) return [];
    return reportData.criticalEquipment.map(eq => ({
      nome: eq.equipamento_nome,
      tag: eq.equipamento_tag || undefined,
      totalFalhas: eq.total_falhas,
      mttr: eq.mttr_hours,
      mtbf: eq.mtbf_days,
      tempoParadaTotal: 0,
      reincidencia: eq.reincidencia_30d,
      healthStatus: eq.score_criticidade > 50 ? 'critical' : eq.score_criticidade > 20 ? 'warning' : 'good',
      criticidadeScore: eq.score_criticidade,
    }));
  };

  const mapTagsToProblems = () => {
    if (!reportData?.tagAnalysis) return [];
    return reportData.tagAnalysis.map(tag => ({
      tag: tag.tag,
      totalFalhas: tag.total_os,
      mttrMedio: tag.mttr_avg,
      equipamentos: tag.equipamentos || [],
    }));
  };

  const exportToPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = margin;

    // Header
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("KRAFLO", margin, 20);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Relatório Profundo de Manutenção", margin, 30);
    
    yPos = 55;
    
    // Period info
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Período: ${DEEP_PERIOD_OPTIONS.find(p => p.value === selectedPeriod)?.label || selectedPeriod}`, margin, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${format(new Date(reportData.period.startDate), 'dd/MM/yyyy')} a ${format(new Date(reportData.period.endDate), 'dd/MM/yyyy')}`, margin, yPos);
    
    yPos += 15;

    // KPIs Box
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 45, 3, 3, 'F');
    
    const kpiWidth = (pageWidth - 2 * margin) / 3;
    const kpis = [
      { label: "Total OS", value: reportData.windowStats.totalOs.toString() },
      { label: "MTTR (horas)", value: reportData.windowStats.mttrHours.toFixed(1) },
      { label: "Taxa Resolução", value: `${reportData.windowStats.resolutionRate.toFixed(1)}%` },
    ];
    
    kpis.forEach((kpi, i) => {
      const x = margin + kpiWidth * i + kpiWidth / 2;
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(245, 158, 11);
      doc.text(kpi.value, x, yPos + 20, { align: "center" });
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(kpi.label, x, yPos + 30, { align: "center" });
    });
    
    yPos += 55;

    // Critical Equipment
    if (reportData.criticalEquipment.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text("Equipamentos Críticos (Top 5)", margin, yPos);
      yPos += 10;
      
      reportData.criticalEquipment.slice(0, 5).forEach((eq) => {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`• ${eq.equipamento_nome}: ${eq.total_falhas} falhas, MTTR ${eq.mttr_hours.toFixed(1)}h, Score ${eq.score_criticidade.toFixed(1)}`, margin + 5, yPos);
        yPos += 7;
      });
      
      yPos += 10;
    }

    // Footer
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );

    doc.save(`relatorio-profundo-${selectedPeriod}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success("PDF exportado com sucesso!");
  };

  const periodOptions = DEEP_PERIOD_OPTIONS.map(opt => ({
    value: opt.value,
    label: opt.label,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-mono font-semibold text-foreground text-lg">
              Relatório Profundo
            </h2>
            <p className="text-sm text-muted-foreground">
              Multi-granularidade: mensal, trimestral e anual
            </p>
          </div>
        </div>

        {reportData && (
          <Button onClick={exportToPDF} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        )}
      </div>

      {/* Period Selection */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Selecione o Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {periodOptions.map((option) => (
              <Button
                key={option.value}
                variant={selectedPeriod === option.value ? "default" : "outline"}
                className={`h-auto py-3 flex flex-col gap-1 ${
                  selectedPeriod === option.value 
                    ? "bg-primary text-primary-foreground" 
                    : "border-border hover:border-primary/50 hover:bg-primary/5"
                }`}
                onClick={() => handlePeriodSelect(option.value)}
                disabled={isLoading}
              >
                {isLoading && selectedPeriod === option.value ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                <span className="font-mono text-xs">{option.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && selectedPeriod && (
        <Card className="bg-card border-border">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="p-4 bg-primary/10 rounded-full">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <Loader2 className="h-5 w-5 animate-spin text-primary absolute -bottom-1 -right-1" />
              </div>
              <div className="text-center">
                <p className="font-mono font-semibold text-foreground">Carregando Relatório...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Agregando dados de múltiplas granularidades
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Data */}
      {reportData && !isLoading && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Visão Geral</TabsTrigger>
            <TabsTrigger value="equipment" className="text-xs sm:text-sm">Equipamentos</TabsTrigger>
            <TabsTrigger value="services" className="text-xs sm:text-sm">Serviços</TabsTrigger>
            <TabsTrigger value="tags" className="text-xs sm:text-sm">Tags</TabsTrigger>
            <TabsTrigger value="trends" className="text-xs sm:text-sm">Tendências</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Period Badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
                <Calendar className="h-3 w-3 mr-1" />
                {format(new Date(reportData.period.startDate), 'dd/MM/yyyy')} - {format(new Date(reportData.period.endDate), 'dd/MM/yyyy')}
              </Badge>
            </div>

            {/* Indexing Coverage */}
            <IndexingCoverageBanner
              total={reportData.indexingCoverage.total}
              indexadas={reportData.indexingCoverage.indexed}
              percentual={reportData.indexingCoverage.percentage}
              onRequestBackfill={handleRequestBackfill}
            />

            {/* KPIs Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col items-center text-center">
                    <FileText className="h-5 w-5 text-muted-foreground mb-2" />
                    <span className="text-2xl font-mono font-bold text-foreground">
                      {reportData.windowStats.totalOs}
                    </span>
                    <span className="text-xs text-muted-foreground">Total OS</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col items-center text-center">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mb-2" />
                    <span className="text-2xl font-mono font-bold text-foreground">
                      {reportData.windowStats.osFechadas}
                    </span>
                    <span className="text-xs text-muted-foreground">Fechadas</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col items-center text-center">
                    <AlertTriangle className="h-5 w-5 text-primary mb-2" />
                    <span className="text-2xl font-mono font-bold text-foreground">
                      {reportData.windowStats.osAbertas}
                    </span>
                    <span className="text-xs text-muted-foreground">Abertas</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col items-center text-center">
                    <Clock className="h-5 w-5 text-blue-500 mb-2" />
                    <span className="text-2xl font-mono font-bold text-foreground">
                      {reportData.windowStats.mttrHours.toFixed(1)}h
                    </span>
                    <span className="text-xs text-muted-foreground">MTTR</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col items-center text-center">
                    <Target className="h-5 w-5 text-green-500 mb-2" />
                    <span className="text-2xl font-mono font-bold text-foreground">
                      {reportData.windowStats.resolutionRate.toFixed(0)}%
                    </span>
                    <span className="text-xs text-muted-foreground">Resolução</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Service Type Breakdown */}
            <ServiceTypeBreakdown data={reportData.serviceTypeBreakdown} />

            {/* Mini Trends Preview */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Resumo de Tendências
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Últimos 12 Meses</p>
                    <p className="font-mono font-bold text-lg">{reportData.trends.monthly.length}</p>
                    <p className="text-xs text-muted-foreground">meses com dados</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Últimos 8 Trimestres</p>
                    <p className="font-mono font-bold text-lg">{reportData.trends.quarterly.length}</p>
                    <p className="text-xs text-muted-foreground">trimestres com dados</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Últimos 3 Anos</p>
                    <p className="font-mono font-bold text-lg">{reportData.trends.yearly.length}</p>
                    <p className="text-xs text-muted-foreground">anos com dados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Equipment Tab */}
          <TabsContent value="equipment" className="space-y-6">
            <EquipmentHealthTable
              equipments={mapCriticalToEquipmentStats()}
              onCreatePreventive={handleCreatePreventive}
              onCreateOS={handleCreateOS}
            />
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-6">
            <ServiceTypeBreakdown data={reportData.serviceTypeBreakdown} />
          </TabsContent>

          {/* Tags Tab */}
          <TabsContent value="tags" className="space-y-6">
            {mapTagsToProblems().length > 0 ? (
              <TagProblemsCard tags={mapTagsToProblems()} />
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Tag className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="font-mono text-lg font-semibold mb-2">Sem dados de tags</h3>
                    <p className="text-muted-foreground max-w-md">
                      Nenhuma tag de equipamento encontrada no período selecionado.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            <TrendCharts 
              monthly={reportData.trends.monthly}
              quarterly={reportData.trends.quarterly}
              yearly={reportData.trends.yearly}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Empty State */}
      {!reportData && !isLoading && !selectedPeriod && (
        <Card className="bg-card border-border">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="p-4 bg-primary/10 rounded-full mb-4">
                <BarChart3 className="h-10 w-10 text-primary" />
              </div>
              <h3 className="font-mono text-lg font-semibold mb-2">
                Relatório Profundo
              </h3>
              <p className="text-muted-foreground max-w-md">
                Selecione um período acima para ver análises multi-granularidade com 
                tendências mensais, trimestrais e anuais.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preventive Plan Wizard */}
      <PreventivePlanWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        empresaId={empresaId || ''}
        equipment={wizardEquipment || undefined}
      />
    </div>
  );
}
