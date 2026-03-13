import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDeepReportStats } from '../useDeepReportStats';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: {
        period: { type: '1m', days: 30, startDate: '', endDate: '' },
        windowStats: { totalOs: 0, osFechadas: 0, osAbertas: 0, mttrHours: 0, resolutionRate: 0 },
        serviceTypeBreakdown: [],
        criticalEquipment: [],
        tagAnalysis: [],
        trends: { monthly: [], quarterly: [], yearly: [] },
        indexingCoverage: { total: 0, indexed: 0, percentage: 0 },
        benchmarks: null,
        generatedAt: new Date().toISOString()
      }, error: null }))
    }
  }
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('useDeepReportStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty data when no OS are found', async () => {
    const { result } = renderHook(() => useDeepReportStats({ period: '1m' }), { wrapper });
    
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.windowStats.totalOs).toBe(0);
  });
});
