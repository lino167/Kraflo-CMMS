/**
 * Card de comparação com benchmarks internos e período anterior
 */

import React from "react";
import { TrendingUp, TrendingDown, Minus, Target, BarChart2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InternalBenchmarks, calcVariation, isVariationGood } from "@/hooks/useInternalBenchmarks";

interface BenchmarkComparisonCardProps {
  currentMetrics: {
    mttr: number;
    mtbf: number;
    taxaResolucao: number;
    totalOS: number;
  };
  previousMetrics?: {
    mttr: number;
    mtbf: number;
    taxaResolucao: number;
    totalOS: number;
  };
  benchmarks?: InternalBenchmarks;
  periodLabel: string;
}

export function BenchmarkComparisonCard({
  currentMetrics,
  previousMetrics,
  benchmarks,
  periodLabel,
}: BenchmarkComparisonCardProps) {
  // Determinar referência de comparação
  const referenceLabel = benchmarks?.isConfigured 
    ? "Meta Configurada" 
    : "Mediana 6 Meses";

  const referenceMttr = benchmarks?.isConfigured && benchmarks.configuredBenchmarks
    ? benchmarks.configuredBenchmarks.mttrAlvoHoras
    : benchmarks?.mttrMediana || 0;

  const referenceMtbf = benchmarks?.isConfigured && benchmarks.configuredBenchmarks
    ? benchmarks.configuredBenchmarks.mtbfAlvoDias
    : benchmarks?.mtbfMediana || 0;

  const referenceTaxa = benchmarks?.isConfigured && benchmarks.configuredBenchmarks
    ? benchmarks.configuredBenchmarks.taxaResolucaoAlvo
    : benchmarks?.taxaResolucaoMediana || 0;

  // Calcular variações
  const mttrVsRef = referenceMttr > 0 ? calcVariation(currentMetrics.mttr, referenceMttr) : null;
  const mtbfVsRef = referenceMtbf > 0 ? calcVariation(currentMetrics.mtbf, referenceMtbf) : null;
  const taxaVsRef = referenceTaxa > 0 ? calcVariation(currentMetrics.taxaResolucao, referenceTaxa) : null;

  const mttrVsPrev = previousMetrics && previousMetrics.mttr > 0 
    ? calcVariation(currentMetrics.mttr, previousMetrics.mttr) 
    : null;
  const mtbfVsPrev = previousMetrics && previousMetrics.mtbf > 0 
    ? calcVariation(currentMetrics.mtbf, previousMetrics.mtbf) 
    : null;
  const taxaVsPrev = previousMetrics && previousMetrics.taxaResolucao > 0 
    ? calcVariation(currentMetrics.taxaResolucao, previousMetrics.taxaResolucao) 
    : null;
  const osVsPrev = previousMetrics && previousMetrics.totalOS > 0
    ? calcVariation(currentMetrics.totalOS, previousMetrics.totalOS)
    : null;

  const renderVariation = (
    value: number | null, 
    metric: 'mttr' | 'mtbf' | 'taxa',
    suffix: string = '%'
  ) => {
    if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
    
    const isGood = isVariationGood(metric, value);
    const Icon = value === 0 ? Minus : (isGood ? TrendingDown : TrendingUp);
    
    // Para MTTR: TrendingDown (diminuiu) é bom
    // Para MTBF/Taxa: TrendingUp (aumentou) é bom
    const displayIcon = metric === 'mttr'
      ? (value < 0 ? TrendingDown : value > 0 ? TrendingUp : Minus)
      : (value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus);
    
    const colorClass = isGood 
      ? "text-green-500" 
      : value === 0 
        ? "text-muted-foreground" 
        : "text-destructive";

    const IconComponent = displayIcon;
    return (
      <span className={`flex items-center gap-1 text-xs font-mono ${colorClass}`}>
        <IconComponent className="h-3 w-3" />
        {value > 0 ? '+' : ''}{value.toFixed(1)}{suffix}
      </span>
    );
  };

  if (!benchmarks && !previousMetrics) {
    return null;
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Comparativo de Performance
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  {benchmarks?.isConfigured ? (
                    "Comparação com metas configuradas pela empresa."
                  ) : (
                    "Sem metas configuradas. Usando a mediana dos últimos 6 meses como referência interna."
                  )}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        {/* Info Banner */}
        {!benchmarks?.isConfigured && (
          <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Usando benchmarks internos:</span> Os valores de referência são calculados automaticamente com base na mediana dos últimos 6 meses da sua operação.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* MTTR */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">MTTR</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {referenceMttr > 0 ? `Ref: ${referenceMttr.toFixed(1)}h` : 'Sem ref.'}
              </Badge>
            </div>
            <div className="text-lg font-mono font-bold">{currentMetrics.mttr.toFixed(1)}h</div>
            <div className="flex flex-col gap-1">
              {mttrVsRef !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">vs {referenceLabel}:</span>
                  {renderVariation(mttrVsRef, 'mttr')}
                </div>
              )}
              {mttrVsPrev !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">vs Período Ant.:</span>
                  {renderVariation(mttrVsPrev, 'mttr')}
                </div>
              )}
            </div>
          </div>

          {/* MTBF */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">MTBF</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {referenceMtbf > 0 ? `Ref: ${referenceMtbf.toFixed(1)}d` : 'Sem ref.'}
              </Badge>
            </div>
            <div className="text-lg font-mono font-bold">{currentMetrics.mtbf.toFixed(1)}d</div>
            <div className="flex flex-col gap-1">
              {mtbfVsRef !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">vs {referenceLabel}:</span>
                  {renderVariation(mtbfVsRef, 'mtbf')}
                </div>
              )}
              {mtbfVsPrev !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">vs Período Ant.:</span>
                  {renderVariation(mtbfVsPrev, 'mtbf')}
                </div>
              )}
            </div>
          </div>

          {/* Taxa de Resolução */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Taxa Resolução</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {referenceTaxa > 0 ? `Ref: ${referenceTaxa.toFixed(0)}%` : 'Sem ref.'}
              </Badge>
            </div>
            <div className="text-lg font-mono font-bold">{currentMetrics.taxaResolucao.toFixed(0)}%</div>
            <div className="flex flex-col gap-1">
              {taxaVsRef !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">vs {referenceLabel}:</span>
                  {renderVariation(taxaVsRef, 'taxa')}
                </div>
              )}
              {taxaVsPrev !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">vs Período Ant.:</span>
                  {renderVariation(taxaVsPrev, 'taxa')}
                </div>
              )}
            </div>
          </div>

          {/* Volume OS */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Volume OS</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {benchmarks?.osMediaMensal ? `Média: ${benchmarks.osMediaMensal}/mês` : 'Sem ref.'}
              </Badge>
            </div>
            <div className="text-lg font-mono font-bold">{currentMetrics.totalOS}</div>
            <div className="flex flex-col gap-1">
              {osVsPrev !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">vs Período Ant.:</span>
                  <span className={`flex items-center gap-1 text-xs font-mono ${
                    osVsPrev > 20 ? 'text-amber-500' : osVsPrev < -20 ? 'text-green-500' : 'text-muted-foreground'
                  }`}>
                    {osVsPrev > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : osVsPrev < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {osVsPrev > 0 ? '+' : ''}{osVsPrev.toFixed(1)}%
                  </span>
                </div>
              )}
              {previousMetrics && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Período Ant.:</span>
                  <span className="text-xs text-muted-foreground">{previousMetrics.totalOS} OS</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
