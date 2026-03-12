import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function KPICardSkeleton() {
  return (
    <Card className="glass-panel border-white/5">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24 bg-white/10" />
        <Skeleton className="h-6 w-6 rounded-md bg-white/10" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2 bg-white/10" />
        <Skeleton className="h-3 w-32 bg-white/10" />
      </CardContent>
    </Card>
  );
}

export function ChartSkeleton() {
  return (
    <Card className="glass-panel border-white/5 h-full">
      <CardHeader>
        <Skeleton className="h-5 w-40 bg-white/10" />
        <Skeleton className="h-3 w-60 mt-1 bg-white/10" />
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-end justify-around gap-2 mt-4">
          {[60, 80, 45, 90, 55, 75, 40].map((h, i) => (
            <Skeleton
              key={i}
              className="w-full bg-white/5 rounded-t-sm"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TableSkeleton() {
  return (
    <Card className="glass-panel border-white/5">
      <CardHeader>
        <Skeleton className="h-5 w-48 bg-white/10" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 p-3 border border-white/5 rounded-xl bg-background/20">
            <Skeleton className="h-10 w-10 rounded-lg bg-white/10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 bg-white/10" />
              <Skeleton className="h-3 w-1/2 bg-white/5" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full bg-white/10" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-4 rounded-xl border-white/5 shadow-surface">
        <Skeleton className="h-10 w-64 bg-white/10" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 bg-white/10" />
          <Skeleton className="h-9 w-32 bg-white/10" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="glass-panel border border-white/10 p-1 rounded-xl w-full md:w-[600px] h-12 flex items-center px-1 space-x-2">
         <Skeleton className="h-8 w-1/3 bg-white/10 rounded-lg" />
         <Skeleton className="h-8 w-1/3 bg-white/10 rounded-lg" />
         <Skeleton className="h-8 w-1/3 bg-white/10 rounded-lg" />
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        <div className="col-span-2 xl:col-span-2"><KPICardSkeleton /></div>
        <div className="col-span-2 xl:col-span-2"><KPICardSkeleton /></div>
        <div className="col-span-2 xl:col-span-2"><KPICardSkeleton /></div>
        <div className="col-span-2 xl:col-span-2"><KPICardSkeleton /></div>
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <KPICardSkeleton />
         <KPICardSkeleton />
         <KPICardSkeleton />
         <KPICardSkeleton />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
