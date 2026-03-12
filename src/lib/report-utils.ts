/**
 * Utilitários para cálculo de estatísticas de equipamentos
 */

import { 
  OSData, 
  EquipmentStats, 
  TagStats, 
  ModelStats, 
  HealthStatus,
  BenchmarkConfig 
} from './report-types';

const DEFAULT_BENCHMARK: BenchmarkConfig = {
  mttrAlvoHoras: 4.0,
  mtbfAlvoDias: 30.0,
  taxaResolucaoAlvo: 95.0,
  pesoFalhas: 1.0,
  pesoReincidencia: 1.5,
  pesoMttr: 1.0,
};

/**
 * Calcula o score de criticidade de um equipamento
 * score = (falhas * peso_falhas * reincidencia * peso_reincidencia * mttr * peso_mttr) / max(mtbf, 1)
 */
export function computeCriticalityScore(
  stats: { totalFalhas: number; reincidencia: number; mttr: number; mtbf: number },
  config: BenchmarkConfig = DEFAULT_BENCHMARK
): number {
  const { pesoFalhas, pesoReincidencia, pesoMttr } = config;
  const reincidenciaFactor = 1 + (stats.reincidencia / 100);
  
  const score = (
    (stats.totalFalhas * pesoFalhas) *
    (reincidenciaFactor * pesoReincidencia) *
    (stats.mttr * pesoMttr)
  ) / Math.max(stats.mtbf, 1);
  
  return Math.round(score * 100) / 100;
}

/**
 * Determina o status de saúde baseado no score de criticidade
 */
export function getHealthStatus(score: number): HealthStatus {
  if (score >= 5) return 'critical';
  if (score >= 2) return 'warning';
  return 'good';
}

/**
 * Calcula estatísticas por equipamento a partir de uma lista de OS
 */
export function computeEquipmentStats(
  osList: OSData[],
  periodDays: number,
  config: BenchmarkConfig = DEFAULT_BENCHMARK
): EquipmentStats[] {
  const equipMap = new Map<string, {
    nome: string;
    tag?: string;
    falhas: { data: Date; tempoReparo: number }[];
    tempoParadaTotal: number;
    ultimoEvento?: Date;
  }>();

  // Agrupar por equipamento
  osList.forEach(os => {
    const nome = os.equipamento_nome;
    const current = equipMap.get(nome) || {
      nome,
      tag: os.equipamento_tag || undefined,
      falhas: [],
      tempoParadaTotal: 0,
      ultimoEvento: undefined,
    };

    const abertura = new Date(os.data_abertura);
    let tempoReparo = 0;

    if (os.data_fechamento) {
      const fechamento = new Date(os.data_fechamento);
      tempoReparo = (fechamento.getTime() - abertura.getTime()) / (1000 * 60 * 60);
      current.tempoParadaTotal += tempoReparo;
    }

    current.falhas.push({ data: abertura, tempoReparo });

    if (!current.ultimoEvento || abertura > current.ultimoEvento) {
      current.ultimoEvento = abertura;
    }

    if (!current.tag && os.equipamento_tag) {
      current.tag = os.equipamento_tag;
    }

    equipMap.set(nome, current);
  });

  // Calcular métricas
  const results: EquipmentStats[] = [];

  equipMap.forEach((data, nome) => {
    const totalFalhas = data.falhas.length;
    
    // MTTR: tempo médio de reparo
    const falhasComReparo = data.falhas.filter(f => f.tempoReparo > 0);
    const mttr = falhasComReparo.length > 0
      ? falhasComReparo.reduce((sum, f) => sum + f.tempoReparo, 0) / falhasComReparo.length
      : 0;

    // MTBF: tempo médio entre falhas
    const mtbf = totalFalhas > 1 ? periodDays / totalFalhas : periodDays;

    // Reincidência: falhas que ocorreram em menos de 30 dias da anterior
    let reincidencias = 0;
    const sortedFalhas = [...data.falhas].sort((a, b) => a.data.getTime() - b.data.getTime());
    for (let i = 1; i < sortedFalhas.length; i++) {
      const diffDays = (sortedFalhas[i].data.getTime() - sortedFalhas[i-1].data.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 30) {
        reincidencias++;
      }
    }
    const reincidencia = totalFalhas > 1 ? (reincidencias / (totalFalhas - 1)) * 100 : 0;

    const criticidadeScore = computeCriticalityScore({ totalFalhas, reincidencia, mttr, mtbf }, config);
    const healthStatus = getHealthStatus(criticidadeScore);

    results.push({
      nome,
      tag: data.tag,
      totalFalhas,
      mttr: Math.round(mttr * 10) / 10,
      mtbf: Math.round(mtbf * 10) / 10,
      tempoParadaTotal: Math.round(data.tempoParadaTotal * 10) / 10,
      reincidencia: Math.round(reincidencia * 10) / 10,
      ultimoEvento: data.ultimoEvento,
      healthStatus,
      criticidadeScore,
    });
  });

  // Ordenar por criticidade (maior primeiro)
  return results.sort((a, b) => b.criticidadeScore - a.criticidadeScore);
}

/**
 * Calcula estatísticas por tag
 */
export function computeTagStats(osList: OSData[]): TagStats[] {
  const tagMap = new Map<string, { falhas: number; temposReparo: number[]; equipamentos: Set<string> }>();

  osList.forEach(os => {
    const tag = os.equipamento_tag;
    if (!tag) return;

    const current = tagMap.get(tag) || { falhas: 0, temposReparo: [], equipamentos: new Set() };
    current.falhas++;
    current.equipamentos.add(os.equipamento_nome);

    if (os.data_fechamento) {
      const abertura = new Date(os.data_abertura);
      const fechamento = new Date(os.data_fechamento);
      const tempoReparo = (fechamento.getTime() - abertura.getTime()) / (1000 * 60 * 60);
      current.temposReparo.push(tempoReparo);
    }

    tagMap.set(tag, current);
  });

  const results: TagStats[] = [];
  tagMap.forEach((data, tag) => {
    const mttrMedio = data.temposReparo.length > 0
      ? data.temposReparo.reduce((sum, t) => sum + t, 0) / data.temposReparo.length
      : 0;

    results.push({
      tag,
      totalFalhas: data.falhas,
      mttrMedio: Math.round(mttrMedio * 10) / 10,
      equipamentos: Array.from(data.equipamentos),
    });
  });

  return results.sort((a, b) => b.totalFalhas - a.totalFalhas);
}

/**
 * Calcula estatísticas por modelo (placeholder - requer dados de fabricante/modelo nas OS)
 */
export function computeModelStats(_osList: OSData[]): ModelStats[] {
  // Por enquanto retorna vazio - precisaria de join com tabela de equipamentos
  return [];
}

/**
 * Calcula cobertura de indexação
 */
export function computeIndexingCoverage(
  osList: OSData[],
  currentVersion: number = 1
): { total: number; indexadas: number; percentual: number } {
  const total = osList.length;
  const indexadas = osList.filter(os => 
    os.index_status === 'indexed' && 
    (os.embedding_version || 1) >= currentVersion
  ).length;

  return {
    total,
    indexadas,
    percentual: total > 0 ? Math.round((indexadas / total) * 100) : 100,
  };
}

/**
 * Calcula métricas gerais do período
 */
export function computePeriodMetrics(osList: OSData[], periodDays: number) {
  const osFechadas = osList.filter(os => 
    os.status_os === 'Fechada' || os.status_os === 'Liberado para produção'
  );
  const osAbertas = osList.filter(os => 
    os.status_os !== 'Fechada' && os.status_os !== 'Liberado para produção'
  );

  // MTTR
  let totalRepairTime = 0;
  let repairCount = 0;
  osFechadas.forEach(os => {
    if (os.data_abertura && os.data_fechamento) {
      const abertura = new Date(os.data_abertura);
      const fechamento = new Date(os.data_fechamento);
      const diffHours = (fechamento.getTime() - abertura.getTime()) / (1000 * 60 * 60);
      totalRepairTime += diffHours;
      repairCount++;
    }
  });
  const mttr = repairCount > 0 ? totalRepairTime / repairCount : 0;

  // MTBF
  const mtbf = osList.length > 1 ? periodDays / osList.length : periodDays;

  // Taxa de resolução
  const taxaResolucao = osList.length > 0 ? (osFechadas.length / osList.length) * 100 : 0;

  return {
    totalOS: osList.length,
    osFechadas: osFechadas.length,
    osAbertas: osAbertas.length,
    mttr: Math.round(mttr * 10) / 10,
    mtbf: Math.round(mtbf * 10) / 10,
    taxaResolucao: Math.round(taxaResolucao * 10) / 10,
  };
}

/**
 * Compara com período anterior
 */
export function computeBenchmarkComparison(
  currentMetrics: { mttr: number; mtbf: number; taxaResolucao: number },
  previousMetrics?: { mttr: number; mtbf: number; taxaResolucao: number },
  config: BenchmarkConfig = DEFAULT_BENCHMARK
) {
  const comparison = {
    mttrVsAlvo: ((currentMetrics.mttr - config.mttrAlvoHoras) / config.mttrAlvoHoras) * 100,
    mtbfVsAlvo: ((currentMetrics.mtbf - config.mtbfAlvoDias) / config.mtbfAlvoDias) * 100,
    taxaVsAlvo: ((currentMetrics.taxaResolucao - config.taxaResolucaoAlvo) / config.taxaResolucaoAlvo) * 100,
    mttrVsPeriodoAnterior: undefined as number | undefined,
    mtbfVsPeriodoAnterior: undefined as number | undefined,
  };

  if (previousMetrics) {
    if (previousMetrics.mttr > 0) {
      comparison.mttrVsPeriodoAnterior = ((currentMetrics.mttr - previousMetrics.mttr) / previousMetrics.mttr) * 100;
    }
    if (previousMetrics.mtbf > 0) {
      comparison.mtbfVsPeriodoAnterior = ((currentMetrics.mtbf - previousMetrics.mtbf) / previousMetrics.mtbf) * 100;
    }
  }

  return comparison;
}
