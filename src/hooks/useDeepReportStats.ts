export type { DeepPeriodType, ServiceTypeBreakdown, TrendDataPoint } from "@/lib/report-types";
import { useQuery } from "@tanstack/react-query";
import { ReportService } from "@/domain/reportService";
import { DeepPeriodType } from "@/lib/report-types";

export const DEEP_PERIOD_OPTIONS: { value: DeepPeriodType; label: string; days: number }[] = [
  { value: '7d', label: '7 Dias', days: 7 },
  { value: '14d', label: '2 Semanas', days: 14 },
  { value: '1m', label: '1 Mês', days: 30 },
  { value: '3m', label: '3 Meses', days: 90 },
  { value: '6m', label: '6 Meses', days: 180 },
];

interface UseDeepReportStatsOptions {
  period: DeepPeriodType;
  enabled?: boolean;
}

export function useDeepReportStats({ period, enabled = true }: UseDeepReportStatsOptions) {
  return useQuery({
    queryKey: ['deep-report-stats', period],
    queryFn: () => ReportService.getDeepReport(period),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (was cacheTime)
  });
}
