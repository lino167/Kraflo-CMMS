/**
 * Tipos para o sistema de relatórios acionáveis
 */

// Status de saúde do equipamento
export type HealthStatus = 'critical' | 'warning' | 'good';

// Estatísticas por equipamento
export interface EquipmentStats {
  nome: string;
  tag?: string;
  fabricante?: string;
  modelo?: string;
  totalFalhas: number;
  mttr: number; // horas
  mtbf: number; // dias
  tempoParadaTotal: number; // horas
  reincidencia: number; // % de falhas repetidas em 30 dias
  ultimoEvento?: Date;
  healthStatus: HealthStatus;
  criticidadeScore: number;
}

// Estatísticas por tag
export interface TagStats {
  tag: string;
  totalFalhas: number;
  mttrMedio: number;
  equipamentos: string[];
}

// Estatísticas por modelo
export interface ModelStats {
  fabricante: string;
  modelo: string;
  totalFalhas: number;
  mttrMedio: number;
  equipamentos: string[];
}

// Recomendação estruturada da IA
export interface AIRecommendation {
  id: string;
  title: string;
  rationale: string;
  targetScope: 'equipment' | 'tag' | 'model';
  targetId?: string;
  targetValue?: string;
  suggestedIntervalDays: number;
  checklistSteps: string[];
  expectedImpact: {
    mttrDown?: number; // % redução
    mtbfUp?: number;   // % aumento
  };
  priority: 'alta' | 'media' | 'baixa';
}

// Risco urgente
export interface UrgentRisk {
  id: string;
  title: string;
  description: string;
  equipamento?: string;
  severity: 'critical' | 'high' | 'medium';
}

// Resposta estruturada da IA
export interface StructuredAIResponse {
  executiveSummary: string;
  urgentRisks: UrgentRisk[];
  recommendations: AIRecommendation[];
  nextPeriodForecast: string;
  benchmarkComparison?: {
    mttrVsAlvo: number; // % diferença
    mtbfVsAlvo: number;
    taxaVsAlvo: number;
    mttrVsPeriodoAnterior?: number;
    mtbfVsPeriodoAnterior?: number;
  };
}

// Dados completos do relatório
export interface ReportData {
  periodo: {
    inicio: string;
    fim: string;
    label: string;
    startDate: Date;
    endDate: Date;
  };
  metricas: {
    totalOS: number;
    osFechadas: number;
    osAbertas: number;
    mttr: number;
    mtbf: number;
    taxaResolucao: number;
  };
  cobertura: {
    total: number;
    indexadas: number;
    percentual: number;
  };
  equipamentosCriticos: EquipmentStats[];
  problemasPorTag: TagStats[];
  problemasPorModelo: ModelStats[];
  analiseIA?: StructuredAIResponse;
  analiseIATexto?: string; // fallback para texto livre
  geradoEm: Date;
}

// Configuração de benchmarks
export interface BenchmarkConfig {
  mttrAlvoHoras: number;
  mtbfAlvoDias: number;
  taxaResolucaoAlvo: number;
  pesoFalhas: number;
  pesoReincidencia: number;
  pesoMttr: number;
}

// Dados de OS para cálculos
export interface OSData {
  id: number;
  empresa_id: string;
  equipamento_nome: string;
  equipamento_tag?: string;
  localizacao?: string;
  tipo_manutencao?: string;
  descricao_problema?: string;
  diagnostico_solucao?: string;
  notas_finais?: string;
  status_os: string;
  data_abertura: string;
  data_fechamento?: string;
  index_status?: string;
  embedding_version?: number;
}

// Período selecionável
export type PeriodType = '7dias' | '2semanas' | '1mes' | '3meses' | '6meses';

export const PERIOD_OPTIONS: { value: PeriodType; label: string; days: number }[] = [
  { value: '7dias', label: '7 Dias', days: 7 },
  { value: '2semanas', label: '2 Semanas', days: 14 },
  { value: '1mes', label: '1 Mês', days: 30 },
  { value: '3meses', label: '3 Meses', days: 90 },
  { value: '6meses', label: '6 Meses', days: 180 },
];
