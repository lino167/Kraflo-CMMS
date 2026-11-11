import { useEffect, useState } from 'react'
import { Loader2, Lock, ShieldCheck } from 'lucide-react'
import { idbStore } from '@/lib/offline/store'
import { secureStore } from '@/lib/offline/local'
import { PIN_MIN_LENGTH, pinOwner, setupPin, unlockWithPin, wipeLocalData } from '@/lib/offline/pin'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PinGateProps {
  /** Usuário logado (null quando offline com sessão expirada) */
  ownerId: string | null
  onUnlocked: () => void
}

type Mode = 'loading' | 'create' | 'unlock' | 'other-user' | 'need-login'

/** Pede o PIN que protege os dados offline. Sem ele, nada do aparelho é lido. */
export function PinGate({ ownerId, onUnlocked }: PinGateProps) {
  const [mode, setMode] = useState<Mode>('loading')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void pinOwner(idbStore).then((owner) => {
      if (cancelled) return
      if (!owner) setMode(ownerId ? 'create' : 'need-login')
      else if (ownerId && owner !== ownerId) setMode('other-user')
      else setMode('unlock')
    })
    return () => {
      cancelled = true
    }
  }, [ownerId])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!ownerId) return
    if (pin !== confirm) return setError('Os dois PINs não são iguais.')
    setBusy(true)
    try {
      secureStore.unlock(await setupPin(idbStore, pin, ownerId))
      onUnlocked()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o PIN.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const result = await unlockWithPin(idbStore, pin)
    setBusy(false)
    setPin('')
    if (result.ok) {
      secureStore.unlock(result.key)
      onUnlocked()
    } else if (result.wiped) {
      setError('PIN incorreto muitas vezes. Os dados offline deste aparelho foram apagados.')
      setMode(ownerId ? 'create' : 'need-login')
    } else {
      setError(`PIN incorreto. Restam ${result.remaining} tentativa(s) antes de apagar os dados offline.`)
    }
  }

  async function handleReset() {
    if (!window.confirm('Isso apaga os dados offline deste aparelho, incluindo lançamentos de OS ainda não enviados. Continuar?')) return
    await wipeLocalData(idbStore)
    secureStore.lock()
    setError(null)
    setPin('')
    setConfirm('')
    setMode(ownerId ? 'create' : 'need-login')
  }

  if (mode === 'loading') {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm pt-6">
      <Card className="glass-panel border-white/10">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/20 p-2">
              {mode === 'create' ? <ShieldCheck className="h-5 w-5 text-primary" /> : <Lock className="h-5 w-5 text-primary" />}
            </div>
            <div>
              <h1 className="font-semibold">{mode === 'create' ? 'Crie um PIN para o Modo Campo' : 'Modo Campo bloqueado'}</h1>
              <p className="text-xs text-muted-foreground">
                {mode === 'create' && 'O PIN protege as OS e os dados guardados neste aparelho para uso sem internet.'}
                {mode === 'unlock' && 'Informe seu PIN para acessar os dados guardados neste aparelho.'}
                {mode === 'other-user' && 'Este aparelho tem dados offline de outro usuário.'}
                {mode === 'need-login' && 'Conecte-se à internet e entre na sua conta para ativar o Modo Campo neste aparelho.'}
              </p>
            </div>
          </div>

          {mode === 'create' && (
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pin-novo">PIN ({PIN_MIN_LENGTH} dígitos ou mais)</Label>
                <Input id="pin-novo" type="password" inputMode="numeric" autoComplete="new-password" className="h-11" value={pin} onChange={(e) => { setPin(e.target.value); setError(null) }} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin-confirma">Repita o PIN</Label>
                <Input id="pin-confirma" type="password" inputMode="numeric" autoComplete="new-password" className="h-11" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(null) }} />
              </div>
              {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
              <Button type="submit" className="h-11 w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar PIN
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Sem o PIN não é possível recuperar os dados offline: se esquecer, será preciso apagá-los e entrar de novo com internet.
              </p>
            </form>
          )}

          {mode === 'unlock' && (
            <form onSubmit={handleUnlock} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
                <Input id="pin" type="password" inputMode="numeric" autoComplete="off" autoFocus className="h-11" value={pin} onChange={(e) => setPin(e.target.value)} />
              </div>
              {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
              <Button type="submit" className="h-11 w-full" disabled={busy || pin.length === 0}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Desbloquear
              </Button>
              <button type="button" className="w-full text-center text-xs text-muted-foreground underline" onClick={handleReset}>
                Esqueci o PIN
              </button>
            </form>
          )}

          {mode === 'other-user' && (
            <Button variant="outline" className="h-11 w-full" onClick={handleReset}>
              Apagar dados e usar com a minha conta
            </Button>
          )}

          {mode === 'need-login' && error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
