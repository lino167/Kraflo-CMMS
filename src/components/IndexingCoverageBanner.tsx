/**
 * Banner de cobertura de indexação
 * Exibe % de OS indexadas e CTA para backfill se < 95%
 */

import { AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import { toast } from '@/components/ui/sonner';

interface IndexingCoverageBannerProps {
  total: number;
  indexadas: number;
  percentual: number;
  onRequestBackfill?: () => Promise<void>;
  isLoading?: boolean;
}

export function IndexingCoverageBanner({
  total,
  indexadas,
  percentual,
  onRequestBackfill,
  isLoading = false,
}: IndexingCoverageBannerProps) {
  const [isBackfilling, setIsBackfilling] = useState(false);

  const handleBackfill = async () => {
    if (!onRequestBackfill) return;
    
    setIsBackfilling(true);
    try {
      await onRequestBackfill();
      toast.success('Indexação iniciada com sucesso');
    } catch (error) {
      toast.error('Erro ao iniciar indexação');
    } finally {
      setIsBackfilling(false);
    }
  };

  if (isLoading) {
    return (
      <Alert className="border-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Verificando cobertura...</AlertTitle>
        <AlertDescription>
          Analisando status de indexação das OS do período.
        </AlertDescription>
      </Alert>
    );
  }

  if (total === 0) {
    return null;
  }

  const isLowCoverage = percentual < 95;
  const isCritical = percentual < 70;

  if (!isLowCoverage) {
    return (
      <Alert className="border-green-500/50 bg-green-500/5">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-700">Cobertura adequada</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span className="text-green-600">
            {indexadas} de {total} OS indexadas ({percentual}%)
          </span>
          <Progress value={percentual} className="w-32 h-2" />
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert 
      variant={isCritical ? 'destructive' : 'default'} 
      className={isCritical ? '' : 'border-yellow-500/50 bg-yellow-500/5'}
    >
      <AlertTriangle className={`h-4 w-4 ${isCritical ? '' : 'text-yellow-600'}`} />
      <AlertTitle className={isCritical ? '' : 'text-yellow-700'}>
        {isCritical ? 'Cobertura crítica' : 'Cobertura baixa'} de indexação
      </AlertTitle>
      <AlertDescription>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
          <div className="space-y-1">
            <p className={isCritical ? '' : 'text-yellow-600'}>
              Apenas {indexadas} de {total} OS do período estão indexadas ({percentual}%).
            </p>
            <p className="text-sm text-muted-foreground">
              A análise IA pode ser imprecisa sem indexação completa.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={percentual} className="w-24 h-2" />
            {onRequestBackfill && (
              <Button 
                size="sm" 
                variant={isCritical ? 'default' : 'outline'}
                onClick={handleBackfill}
                disabled={isBackfilling}
              >
                {isBackfilling ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Indexar agora
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
