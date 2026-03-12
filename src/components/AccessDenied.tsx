import { ShieldX, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

interface AccessDeniedProps {
  message?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
}

export function AccessDenied({ 
  message = 'Você não tem permissão para acessar este recurso.', 
  showBackButton = true,
  showHomeButton = true,
}: AccessDeniedProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-card border-border">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="font-mono text-xl text-foreground">
            Acesso Não Autorizado
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3 justify-center">
          {showBackButton && (
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          )}
          {showHomeButton && (
            <Button 
              onClick={() => navigate('/')}
              className="w-full sm:w-auto"
            >
              <Home className="h-4 w-4 mr-2" />
              Ir para Home
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
