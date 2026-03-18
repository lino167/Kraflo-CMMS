import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendDataPoint } from "@/hooks/useDeepReportStats";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface TrendChartsProps {
  monthly: TrendDataPoint[];
  quarterly: TrendDataPoint[];
  yearly: TrendDataPoint[];
}

export function TrendCharts({ monthly, quarterly, yearly }: TrendChartsProps) {
  const hasData = monthly.length > 0 || quarterly.length > 0 || yearly.length > 0;

  if (!hasData) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center gap-2">
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Sem dados de tendência disponíveis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Tendências Históricas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="monthly" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="monthly" className="text-xs">Mensal</TabsTrigger>
            <TabsTrigger value="quarterly" className="text-xs">Trimestral</TabsTrigger>
            <TabsTrigger value="yearly" className="text-xs">Anual</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly">
            {monthly.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 10 }} 
                      className="fill-muted-foreground"
                    />
                    <YAxis 
                      yAxisId="left" 
                      tick={{ fontSize: 10 }} 
                      className="fill-muted-foreground"
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      tick={{ fontSize: 10 }}
                      className="fill-muted-foreground"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="totalOs" 
                      name="Total OS" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="mttrHours" 
                      name="MTTR (h)" 
                      stroke="hsl(var(--destructive))" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">Sem dados mensais</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="quarterly">
            {quarterly.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quarterly}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 10 }} 
                      className="fill-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }} 
                      className="fill-muted-foreground"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="totalOs" 
                      name="Total OS" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="osFechadas" 
                      name="OS Fechadas" 
                      fill="hsl(var(--chart-2))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">Sem dados trimestrais</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="yearly">
            {yearly.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearly}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 10 }} 
                      className="fill-muted-foreground"
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fontSize: 10 }} 
                      className="fill-muted-foreground"
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10 }} 
                      className="fill-muted-foreground"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar 
                      yAxisId="left"
                      dataKey="totalOs" 
                      name="Total OS" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="resolutionRate" 
                      name="Taxa Resolução (%)" 
                      stroke="hsl(var(--chart-3))" 
                      strokeWidth={2}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">Sem dados anuais</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
