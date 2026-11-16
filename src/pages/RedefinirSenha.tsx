import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, CheckCircle2, Loader2, Lock, MailWarning } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { chegadaPorLink } from '@/lib/chegada-recuperacao'
import { novaSenhaSchema } from '@/lib/recuperar-senha'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/sonner'

type Fase = 'verificando' | 'pronto' | 'invalido'

/** Espera pela sessão de recuperação que o Supabase cria a partir do link. */
const LIMITE_VERIFICACAO_MS = 6000

export default function RedefinirSenha() {
  const navigate = useNavigate()
  const [fase, setFase] = useState<Fase>(chegadaPorLink === 'recuperacao' ? 'verificando' : 'invalido')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (chegadaPorLink !== 'recuperacao') return
    let ativo = true

    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (ativo && evento === 'PASSWORD_RECOVERY') setFase('pronto')
    })
    // O evento pode ter passado antes desta página carregar: então vale uma sessão já criada pelo link.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (ativo && session) setFase('pronto')
    })
    const limite = window.setTimeout(() => {
      if (ativo) setFase((atual) => (atual === 'verificando' ? 'invalido' : atual))
    }, LIMITE_VERIFICACAO_MS)

    return () => {
      ativo = false
      window.clearTimeout(limite)
      data.subscription.unsubscribe()
    }
  }, [])

  // Tira o token do endereço assim que a sessão foi criada
  useEffect(() => {
    if (fase === 'pronto') window.history.replaceState(null, '', window.location.pathname)
  }, [fase])

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const validado = novaSenhaSchema.safeParse({ senha, confirmacao })
    if (!validado.success) {
      toast.error(validado.error.errors[0].message)
      return
    }
    setSalvando(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: validado.data.senha })
      if (error) {
        toast.error(
          /same|diferente|different/i.test(error.message)
            ? 'Escolha uma senha diferente da anterior.'
            : 'Não foi possível salvar a nova senha. Peça um novo link e tente de novo.',
        )
        return
      }
      // Quem tinha a senha antiga em outro aparelho precisa entrar de novo
      await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined)
      toast.success('Senha alterada com sucesso!')
      navigate('/', { replace: true })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-primary">
            <Bot className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-mono text-2xl font-bold text-foreground">KRAFLO</h1>
        </div>

        {fase === 'verificando' && (
          <Card className="border-border bg-card">
            <CardContent className="flex items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Conferindo o link…
            </CardContent>
          </Card>
        )}

        {fase === 'invalido' && (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailWarning className="h-5 w-5 text-yellow-400" /> Link inválido ou expirado
              </CardTitle>
              <CardDescription>
                O link de recuperação vale por pouco tempo e só pode ser usado uma vez. Peça um novo para continuar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/auth', { replace: true })}>
                Pedir um novo link
              </Button>
            </CardContent>
          </Card>
        )}

        {fase === 'pronto' && (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" /> Crie uma nova senha
              </CardTitle>
              <CardDescription>Use pelo menos 6 caracteres. Depois de salvar, você já entra no sistema.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={salvar} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nova-senha">Nova senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="nova-senha"
                      type="password"
                      autoComplete="new-password"
                      className="pl-10"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirma-senha">Repita a nova senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirma-senha"
                      type="password"
                      autoComplete="new-password"
                      className="pl-10"
                      value={confirmacao}
                      onChange={(e) => setConfirmacao(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={salvando}>
                  {salvando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
                    </>
                  ) : (
                    'Salvar nova senha'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
