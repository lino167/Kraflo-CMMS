import React from 'react';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface State {
  erro: Error | null;
}

/**
 * Evita a tela preta quando uma tela falha ao carregar (ex.: aba aberta sem internet
 * cujo arquivo ainda não está no cache). Mostra um aviso e leva de volta às OS.
 */
export class RouteErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error) {
    console.error('Falha ao renderizar a tela:', erro);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
        <WifiOff className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">
          {offline ? 'Esta tela precisa de internet' : 'Não foi possível abrir esta tela'}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {offline
            ? 'Sem conexão, use a aba de OS: abrir, fechar e sincronizar funcionam normalmente.'
            : 'Tente novamente em instantes.'}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => { window.location.href = '/campo'; }}>Ir para as OS</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>Tentar de novo</Button>
        </div>
      </div>
    );
  }
}
