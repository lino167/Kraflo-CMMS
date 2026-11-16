import { useState } from 'react'
import { Download, Smartphone, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  dispensadoRecentemente,
  gravarDispensa,
  instalarApp,
  lerDispensa,
  useSituacaoInstalacao,
} from '@/lib/instalar-app'
import { PASSOS_ANDROID, PASSOS_IPHONE } from '@/lib/passos-instalacao'

function Passos({ titulo, passos }: { titulo: string; passos: string[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold">{titulo}</h3>
      <ol className="space-y-2">
        {passos.map((p, i) => (
          <li key={p} className="flex gap-3 text-sm text-muted-foreground">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {i + 1}
            </span>
            <span className="pt-0.5">{p}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * Convite para instalar o Kraflo na tela inicial. Some sozinho depois de instalado e, se o técnico fechar,
 * não volta por 14 dias.
 */
export function InstalarApp() {
  const situacao = useSituacaoInstalacao()
  const [dispensado, setDispensado] = useState(() => dispensadoRecentemente(Date.now(), lerDispensa()))
  const [passosAbertos, setPassosAbertos] = useState(false)

  if (situacao === 'instalado' || dispensado) return null

  const instalaComUmToque = situacao === 'pelo-navegador'

  const aoInstalar = async () => {
    const aceito = await instalarApp()
    if (aceito) toast.success('Kraflo instalado! Procure o ícone na tela inicial.')
  }

  return (
    <>
      <Card className="glass-panel border-primary/30">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-base font-semibold">Instale o Kraflo no celular</p>
              <p className="text-sm text-muted-foreground">Abre mais rápido, em tela cheia, e funciona sem sinal.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {instalaComUmToque ? (
                <Button className="h-11 text-base" onClick={() => void aoInstalar()}>
                  <Download className="mr-2 h-5 w-5" /> Instalar app
                </Button>
              ) : (
                <Button className="h-11 text-base" onClick={() => setPassosAbertos(true)}>
                  <Download className="mr-2 h-5 w-5" /> Como instalar
                </Button>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Dispensar o aviso de instalação"
            onClick={() => {
              gravarDispensa(Date.now())
              setDispensado(true)
            }}
          >
            <X className="h-5 w-5" />
          </Button>
        </CardContent>
      </Card>

      <Dialog open={passosAbertos} onOpenChange={setPassosAbertos}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Instalar o Kraflo</DialogTitle>
            <DialogDescription>
              {situacao === 'ios' ? 'No iPhone a instalação é feita pelo Safari.' : 'Escolha o seu celular.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {situacao === 'ios' ? (
              <Passos titulo="iPhone / iPad" passos={PASSOS_IPHONE} />
            ) : (
              <>
                <Passos titulo="Android" passos={PASSOS_ANDROID} />
                <Passos titulo="iPhone / iPad" passos={PASSOS_IPHONE} />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
