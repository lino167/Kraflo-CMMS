import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Wrench, Clock } from "lucide-react";
import { ServiceTypeBreakdown as ServiceTypeData } from "@/hooks/useDeepReportStats";

interface ServiceTypeBreakdownProps {
  data: ServiceTypeData[];
}

export function ServiceTypeBreakdown({ data }: ServiceTypeBreakdownProps) {
  if (data.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center gap-2">
            <Wrench className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Sem dados de tipos de serviço</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxTotal = Math.max(...data.map(d => d.total_os));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Tipos de Serviço
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => (
            <div key={item.tipo_servico || index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">
                    {item.tipo_servico}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {item.total_os} OS
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    MTTR: {item.mttr_avg.toFixed(1)}h
                  </span>
                  <span>{item.percentual.toFixed(1)}%</span>
                </div>
              </div>
              <Progress 
                value={(item.total_os / maxTotal) * 100} 
                className="h-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{item.os_fechadas} fechadas</span>
                <span>{item.total_os - item.os_fechadas} abertas</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
