import { useState, useRef } from "react";
import { 
  FileText, 
  Loader2, 
  Download, 
  Calendar, 
  TrendingUp, 
  AlertTriangle,

  Clock,
  Target,
  CheckCircle2,
  BarChart3,
  Bot,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/error-handler";
import { toast } from "@/components/ui/sonner";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DOMPurify from "dompurify";

// New components
import { IndexingCoverageBanner } from "@/components/IndexingCoverageBanner";
import { EquipmentHealthTable } from "@/components/EquipmentHealthTable";
import { TagProblemsCard } from "@/components/TagProblemsCard";
import { RecommendationCards } from "@/components/RecommendationCards";
import { PreventivePlanWizard } from "@/components/PreventivePlanWizard";
import { BenchmarkComparisonCard } from "@/components/BenchmarkComparisonCard";

// New hooks and types
import { useReportStats, usePreviousPeriodMetrics } from "@/hooks/useReportStats";
import { useInternalBenchmarks } from "@/hooks/useInternalBenchmarks";
import {
  PeriodType, 
  PERIOD_OPTIONS,
  ReportData,
  StructuredAIResponse,
  AIRecommendation,
  EquipmentStats 
} from "@/lib/report-types";

interface AIReportProps {
  empresaId?: string;
}

export function AIReport({ empresaId }: AIReportProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardEquipment, setWizardEquipment] = useState<EquipmentStats | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Use hooks for stats
  const { data: statsData, isLoading: isLoadingStats, refetch: refetchStats } = useReportStats({
    empresaId,
    period: selectedPeriod || '1mes',
    enabled: !!selectedPeriod,
  });

  const { data: previousMetrics } = usePreviousPeriodMetrics({
    empresaId,
    period: selectedPeriod || '1mes',
    enabled: !!selectedPeriod && !!statsData,
  });

  // Hook para benchmarks internos
  const { data: internalBenchmarks } = useInternalBenchmarks({
    empresaId,
    enabled: !!selectedPeriod,
  });

  const periodOptions = PERIOD_OPTIONS.slice(0, 4).map(opt => ({
    value: opt.value,
    label: opt.label,
    icon: <Calendar className="h-4 w-4" />
  }));

  const handlePeriodSelect = async (period: PeriodType) => {
    setSelectedPeriod(period);
    setReportData(null);
  };

  const handleRequestBackfill = async () => {
    try {
      await supabase.functions.invoke('backfill-os-index', {
        body: { empresa_id: empresaId }
      });
      toast.success('Indexação iniciada');
      // Refetch stats after some time
      setTimeout(() => refetchStats(), 5000);
    } catch (error) {
      handleError(error, { showToast: true });
    }
  };

  const generateAIAnalysis = async () => {
    if (!statsData) return;
    
    setIsAnalyzing(true);
    try {
      // Fetch benchmark config
      let benchmarks = null;
      if (empresaId) {
        const { data: configData } = await supabase
          .from('config_benchmarks')
          .select('*')
          .eq('empresa_id', empresaId)
          .maybeSingle();
        
        if (configData) {
          benchmarks = {
            mttrAlvoHoras: Number(configData.mttr_alvo_horas),
            mtbfAlvoDias: Number(configData.mtbf_alvo_dias),
            taxaResolucaoAlvo: Number(configData.taxa_resolucao_alvo),
          };
        }
      }

      // Call AI with structured mode
      const { data: iaData, error: iaError } = await supabase.functions.invoke("assistente-ia", {
        body: {
          mode: 'report',
          empresa_id: empresaId,
          reportData: {
            periodo: statsData.periodo,
            metricas: statsData.metricas,
            equipamentosCriticos: statsData.equipamentosCriticos,
            problemasPorTag: statsData.problemasPorTag,
            problemasPorModelo: statsData.problemasPorModelo,
            benchmarks,
            periodoAnterior: previousMetrics || null,
          },
        },
      });

      if (iaError) throw iaError;

      const fullReportData: ReportData = {
        ...statsData,
        geradoEm: new Date(),
      };

      if (iaData?.structured && iaData?.analiseIA) {
        fullReportData.analiseIA = iaData.analiseIA as StructuredAIResponse;
      } else if (iaData?.analiseIATexto) {
        fullReportData.analiseIATexto = iaData.analiseIATexto;
      }

      setReportData(fullReportData);
      toast.success('Análise IA gerada com sucesso');

    } catch (error) {
      handleError(error, { showToast: true, logToConsole: true });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreatePreventive = (equipment: EquipmentStats) => {
    setWizardEquipment(equipment);
    setWizardOpen(true);
  };

  const handleCreateOS = (equipment: EquipmentStats) => {
    toast.info(`Criar OS preventiva para ${equipment.nome} - funcionalidade em desenvolvimento`);
  };

  const handleCreatePlanFromRec = (rec: AIRecommendation) => {
    const mockEquipment: EquipmentStats = {
      nome: rec.targetValue || rec.targetId || 'Equipamento',
      totalFalhas: 0,
      mttr: 0,
      mtbf: 0,
      tempoParadaTotal: 0,
      reincidencia: 0,
      healthStatus: 'warning',
      criticidadeScore: 50,
    };
    setWizardEquipment(mockEquipment);
    setWizardOpen(true);
  };

  const handleCreateOSFromRec = (rec: AIRecommendation) => {
    toast.info(`Criar OS preventiva: ${rec.title} - funcionalidade em desenvolvimento`);
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
    doc.text("Relatório Inteligente de Manutenção", margin, 30);
    
    yPos = 55;
    
    // Period info
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Período: ${reportData.periodo.label}`, margin, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${reportData.periodo.inicio} a ${reportData.periodo.fim}`, margin, yPos);
    
    yPos += 15;

    // KPIs Box
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 45, 3, 3, 'F');
    
    const kpiWidth = (pageWidth - 2 * margin) / 3;
    const kpis = [
      { label: "Total OS", value: reportData.metricas.totalOS.toString() },
      { label: "MTTR (horas)", value: reportData.metricas.mttr.toFixed(1) },
      { label: "MTBF (dias)", value: reportData.metricas.mtbf.toFixed(1) },
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

    // Second row KPIs
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 45, 3, 3, 'F');
    
    const kpis2 = [
      { label: "OS Fechadas", value: reportData.metricas.osFechadas.toString() },
      { label: "OS Abertas", value: reportData.metricas.osAbertas.toString() },
      { label: "Taxa Resolução", value: `${reportData.metricas.taxaResolucao.toFixed(1)}%` },
    ];
    
    kpis2.forEach((kpi, i) => {
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

    // Critical Equipment Section
    if (reportData.equipamentosCriticos.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text("Equipamentos Críticos", margin, yPos);
      yPos += 10;
      
      reportData.equipamentosCriticos.slice(0, 5).forEach((eq) => {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`• ${eq.nome}: ${eq.totalFalhas} falhas, MTTR ${eq.mttr}h, MTBF ${eq.mtbf}d`, margin + 5, yPos);
        yPos += 7;
      });
      
      yPos += 10;
    }

    // AI Analysis - New page
    doc.addPage();
    yPos = margin;
    
    doc.setFillColor(245, 158, 11);
    doc.rect(margin, yPos, 5, 20, 'F');
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text("Análise Inteligente", margin + 10, yPos + 13);
    yPos += 30;

    // Render AI analysis
    const analysisText = reportData.analiseIA?.executiveSummary || reportData.analiseIATexto || "Análise não disponível";
    const lines = analysisText.split('\n');
    doc.setFontSize(10);
    
    lines.forEach((line) => {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = margin;
      }
      
      doc.setFont("helvetica", "normal");
      const splitLines = doc.splitTextToSize(line, pageWidth - 2 * margin);
      splitLines.forEach((splitLine: string) => {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = margin;
        }
        doc.text(splitLine, margin, yPos);
        yPos += 6;
      });
    });

    // Recommendations if structured
    if (reportData.analiseIA?.recommendations?.length) {
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = margin;
      }
      
      yPos += 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Recomendações", margin, yPos);
      yPos += 10;
      
      reportData.analiseIA.recommendations.forEach((rec, i) => {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = margin;
        }
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`${i + 1}. ${rec.title}`, margin, yPos);
        yPos += 6;
        
        doc.setFont("helvetica", "normal");
        const rationaleLines = doc.splitTextToSize(rec.rationale, pageWidth - 2 * margin - 10);
        rationaleLines.forEach((line: string) => {
          doc.text(line, margin + 5, yPos);
          yPos += 5;
        });
        yPos += 5;
      });
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Gerado pelo Kraflo Open Source em ${format(reportData.geradoEm, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} | Página ${i} de ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    }

    doc.save(`relatorio-manutencao-${reportData.periodo.label.toLowerCase().replace(' ', '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success("PDF exportado com sucesso!");
  };

  const exportToMarkdown = () => {
    if (!reportData) return;

    let md = `# Relatório de Manutenção - Kraflo\n\n`;
    md += `**Período:** ${reportData.periodo.label} (${reportData.periodo.inicio} a ${reportData.periodo.fim})\n`;
    md += `**Gerado em:** ${format(reportData.geradoEm, "dd/MM/yyyy HH:mm")}\n\n`;

    md += `## KPIs Principais\n`;
    md += `| Métrica | Valor |\n`;
    md += `| :--- | :--- |\n`;
    md += `| Total de OS | ${reportData.metricas.totalOS} |\n`;
    md += `| MTTR (Horas) | ${reportData.metricas.mttr.toFixed(1)}h |\n`;
    md += `| MTBF (Dias) | ${reportData.metricas.mtbf.toFixed(1)}d |\n`;
    md += `| Taxa de Resolução | ${reportData.metricas.taxaResolucao.toFixed(1)}% |\n\n`;

    if (reportData.analiseIA?.executiveSummary || reportData.analiseIATexto) {
      md += `## Análise Executiva\n`;
      md += `${reportData.analiseIA?.executiveSummary || reportData.analiseIATexto}\n\n`;
    }

    if (reportData.analiseIA?.recommendations?.length) {
      md += `## Recomendações\n`;
      reportData.analiseIA.recommendations.forEach((rec, i) => {
        md += `### ${i + 1}. ${rec.title}\n`;
        md += `${rec.rationale}\n\n`;
      });
    }

    md += `---\n`;
    md += `*Este relatório foi empoderado pelo **Kraflo CMMS (Open Source)**. Junte-se à nossa comunidade para transformar a manutenção industrial.*`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-manutencao-${format(new Date(), 'yyyy-MM-dd')}.md`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Markdown exportado com sucesso!");
  };

  const renderMarkdown = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, index) => {
      if (line.startsWith("### ")) {
        return (
          <h3 key={index} className="text-base font-semibold text-primary mt-4 mb-2">
            {line.slice(4)}
          </h3>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h2 key={index} className="text-lg font-bold text-primary mt-4 mb-2">
            {line.slice(3)}
          </h2>
        );
      }
      if (line.startsWith("# ")) {
        return (
          <h1 key={index} className="text-xl font-bold text-primary mt-4 mb-2">
            {line.slice(2)}
          </h1>
        );
      }
      if (line.match(/^\d+\.\s/)) {
        return (
          <li key={index} className="ml-6 list-decimal text-sm">
            {formatInlineMarkdown(line.replace(/^\d+\.\s/, ""))}
          </li>
        );
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return (
          <li key={index} className="ml-6 list-disc text-sm">
            {formatInlineMarkdown(line.slice(2))}
          </li>
        );
      }
      if (!line.trim()) {
        return <br key={index} />;
      }
      return (
        <p key={index} className="mb-2 text-sm">
          {formatInlineMarkdown(line)}
        </p>
      );
    });
  };

  const formatInlineMarkdown = (text: string) => {
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong class='text-primary font-semibold'>$1</strong>");
    text = text.replace(/`([^`]+)`/g, "<code class='bg-secondary px-1 py-0.5 rounded text-xs'>$1</code>");
    const sanitizedHtml = DOMPurify.sanitize(text, {
      ALLOWED_TAGS: ['strong', 'code'],
      ALLOWED_ATTR: ['class'],
    });
    return <span dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
  };

  const isLoading = isLoadingStats || isAnalyzing;

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
              Relatório Inteligente
            </h2>
            <p className="text-sm text-muted-foreground">
              Análise de MTBF, MTTR e recomendações acionáveis
            </p>
          </div>
        </div>

        {reportData && (
          <div className="flex gap-2">
            <Button onClick={exportToPDF} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button onClick={exportToMarkdown} variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Markdown
            </Button>
          </div>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {periodOptions.map((option) => (
              <Button
                key={option.value}
                variant={selectedPeriod === option.value ? "default" : "outline"}
                className={`h-auto py-4 flex flex-col gap-2 ${
                  selectedPeriod === option.value 
                    ? "bg-primary text-primary-foreground" 
                    : "border-border hover:border-primary/50 hover:bg-primary/5"
                }`}
                onClick={() => handlePeriodSelect(option.value)}
                disabled={isLoading}
              >
                {isLoadingStats && selectedPeriod === option.value ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  option.icon
                )}
                <span className="font-mono text-sm">{option.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats loaded - show indexing coverage */}
      {statsData && !isLoadingStats && (
        <>
          {/* Indexing Coverage Banner */}
          <IndexingCoverageBanner
            total={statsData.cobertura.total}
            indexadas={statsData.cobertura.indexadas}
            percentual={statsData.cobertura.percentual}
            onRequestBackfill={handleRequestBackfill}
          />

          {/* KPIs Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col items-center text-center">
                  <FileText className="h-5 w-5 text-muted-foreground mb-2" />
                  <span className="text-2xl font-mono font-bold text-foreground">
                    {statsData.metricas.totalOS}
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
                    {statsData.metricas.osFechadas}
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
                    {statsData.metricas.osAbertas}
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
                    {statsData.metricas.mttr.toFixed(1)}h
                  </span>
                  <span className="text-xs text-muted-foreground">MTTR</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col items-center text-center">
                  <TrendingUp className="h-5 w-5 text-purple-500 mb-2" />
                  <span className="text-2xl font-mono font-bold text-foreground">
                    {statsData.metricas.mtbf.toFixed(1)}d
                  </span>
                  <span className="text-xs text-muted-foreground">MTBF</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col items-center text-center">
                  <Target className="h-5 w-5 text-green-500 mb-2" />
                  <span className="text-2xl font-mono font-bold text-foreground">
                    {statsData.metricas.taxaResolucao.toFixed(0)}%
                  </span>
                  <span className="text-xs text-muted-foreground">Resolução</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Equipment Health Table */}
          <EquipmentHealthTable
            equipments={statsData.equipamentosCriticos}
            onCreatePreventive={handleCreatePreventive}
            onCreateOS={handleCreateOS}
          />

          {/* Benchmark Comparison Card */}
          <BenchmarkComparisonCard
            currentMetrics={{
              mttr: statsData.metricas.mttr,
              mtbf: statsData.metricas.mtbf,
              taxaResolucao: statsData.metricas.taxaResolucao,
              totalOS: statsData.metricas.totalOS,
            }}
            previousMetrics={previousMetrics ? {
              mttr: previousMetrics.mttr,
              mtbf: previousMetrics.mtbf,
              taxaResolucao: previousMetrics.taxaResolucao,
              totalOS: previousMetrics.totalOS,
            } : undefined}
            benchmarks={internalBenchmarks}
            
          />

          {/* Tag Problems */}
          {statsData.problemasPorTag.length > 0 && (
            <TagProblemsCard tags={statsData.problemasPorTag} />
          )}

          {/* Generate AI Analysis Button */}
          {!reportData && (
            <Card className="bg-card border-border">
              <CardContent className="py-8">
                <div className="flex flex-col items-center justify-center text-center gap-4">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <Bot className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-mono text-lg font-semibold mb-2">
                      Análise IA Pronta
                    </h3>
                    <p className="text-muted-foreground max-w-md mb-4">
                      Gere recomendações acionáveis baseadas nos dados do período selecionado.
                    </p>
                    <Button 
                      onClick={generateAIAnalysis} 
                      disabled={isAnalyzing}
                      size="lg"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analisando...
                        </>
                      ) : (
                        <>
                          <Lightbulb className="h-4 w-4 mr-2" />
                          Gerar Análise IA
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Loading Stats State */}
      {isLoadingStats && selectedPeriod && (
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
                <p className="font-mono font-semibold text-foreground">Carregando Dados...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Calculando métricas do período
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report with AI Analysis */}
      {reportData && !isLoading && (
        <div ref={reportRef} className="space-y-6">
          {/* Period Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
              <Calendar className="h-3 w-3 mr-1" />
              {reportData.periodo.inicio} - {reportData.periodo.fim}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              Gerado em {format(reportData.geradoEm, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </Badge>
          </div>

          {/* Urgent Risks */}
          {reportData.analiseIA?.urgentRisks && reportData.analiseIA.urgentRisks.length > 0 && (
            <Card className="bg-destructive/5 border-destructive/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono text-destructive uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Riscos Urgentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reportData.analiseIA.urgentRisks.map((risk) => (
                    <div key={risk.id} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-destructive">{risk.title}</span>
                        <Badge variant="destructive" className="text-xs">
                          {risk.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{risk.description}</p>
                      {risk.equipamento && (
                        <Badge variant="outline" className="mt-2 text-xs">{risk.equipamento}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations Cards */}
          {reportData.analiseIA?.recommendations && (
            <RecommendationCards
              recommendations={reportData.analiseIA.recommendations}
              onCreatePlan={handleCreatePlanFromRec}
              onCreateOS={handleCreateOSFromRec}
              onAddToExisting={(rec) => toast.info(`Adicionar a plano existente: ${rec.title}`)}
            />
          )}

          {/* Executive Summary & Forecast */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Análise Executiva
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                {reportData.analiseIA?.executiveSummary ? (
                  <div className="prose-industrial text-foreground space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Resumo Executivo</h4>
                      <p className="text-sm text-muted-foreground">
                        {reportData.analiseIA.executiveSummary}
                      </p>
                    </div>
                    {reportData.analiseIA.nextPeriodForecast && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Previsão Próximo Período</h4>
                        <p className="text-sm text-muted-foreground">
                          {reportData.analiseIA.nextPeriodForecast}
                        </p>
                      </div>
                    )}
                  </div>
                ) : reportData.analiseIATexto ? (
                  <div className="prose-industrial text-foreground">
                    {renderMarkdown(reportData.analiseIATexto)}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Análise não disponível</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!statsData && !isLoadingStats && !selectedPeriod && (
        <Card className="bg-card border-border">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="p-4 bg-primary/10 rounded-full mb-4">
                <BarChart3 className="h-10 w-10 text-primary" />
              </div>
              <h3 className="font-mono text-lg font-semibold mb-2">
                Gere seu Relatório
              </h3>
              <p className="text-muted-foreground max-w-md">
                Selecione um período acima para ver métricas, equipamentos críticos e gerar 
                recomendações acionáveis com IA.
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
