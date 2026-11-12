import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Copy, Link2, Loader2, RefreshCw, Send, Unlink, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage } from '@/lib/error-handler'
import { QRCodeDialog } from '@/components/QRCodeDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

async function copiar(texto: string, aviso: string) {
  try {
    await navigator.clipboard.writeText(texto)
    toast.success(aviso)
  } catch {
    toast.error('Não foi possível copiar')
  }
}

export default function Conta() {
  const { user, profile, isAdminEmpresa } = useAuth()
  const queryClient = useQueryClient()
  const empresaId = profile?.empresa_id
  const [codigoTelegram, setCodigoTelegram] = useState<string | null>(null)
  const [qrAberto, setQrAberto] = useState(false)

  const { data: convite, isLoading: conviteLoading } = useQuery({
    queryKey: ['codigo-convite', empresaId],
    enabled: !!empresaId && isAdminEmpresa,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_codigo_convite')
      if (error) throw error
      return data
    },
  })

  const { data: equipe = [], isLoading: equipeLoading } = useQuery({
    queryKey: ['equipe', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tecnicos')
        .select('id_telegram, nome_completo, funcao, user_id, telegram_user_id')
        .eq('empresa_id', empresaId!)
        .order('nome_completo')
      if (error) throw error
      return data
    },
  })

  const eu = equipe.find((t) => t.user_id === user?.id)
  const linkConvite = convite ? `${window.location.origin}/auth?convite=${convite}` : ''

  const trocarConvite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('fn_regenerar_codigo_convite')
      if (error) throw error
      return data
    },
    onSuccess: (novo) => {
      queryClient.setQueryData(['codigo-convite', empresaId], novo)
      toast.success('Código trocado. O anterior não vale mais.')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const gerarCodigoTelegram = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('fn_gerar_codigo_telegram')
      if (error) throw error
      return data
    },
    onSuccess: (code) => setCodigoTelegram(code),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const desvincular = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('fn_desvincular_telegram')
      if (error) throw error
    },
    onSuccess: () => {
      setCodigoTelegram(null)
      queryClient.invalidateQueries({ queryKey: ['equipe'] })
      toast.success('Telegram desvinculado')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold uppercase tracking-tight">Conta e Equipe</h1>
        <p className="text-sm text-muted-foreground">
          {profile?.nome_completo} · {user?.email}
        </p>
      </div>

      {!empresaId && (
        <Card className="glass-panel border-yellow-500/30">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Sua conta não está ligada a nenhuma empresa. Peça um código de convite ao administrador e crie a conta com ele.
          </CardContent>
        </Card>
      )}

      {isAdminEmpresa && empresaId && (
        <Card className="glass-panel border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4 text-primary" /> Convidar para a equipe
            </CardTitle>
            <CardDescription>
              Quem criar conta com este código entra na sua empresa como técnico. Só o código dá acesso: digitar o nome da empresa não.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {conviteLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : convite ? (
              <>
                <p className="rounded-lg bg-secondary/30 p-3 text-center font-mono text-2xl font-bold tracking-[0.3em]" aria-label="Código de convite">
                  {convite}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Button variant="outline" size="sm" onClick={() => copiar(convite, 'Código copiado')}>
                    <Copy className="mr-1.5 h-4 w-4" /> Código
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copiar(linkConvite, 'Link copiado')}>
                    <Link2 className="mr-1.5 h-4 w-4" /> Link
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setQrAberto(true)}>
                    QR code
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={trocarConvite.isPending}
                    onClick={() => {
                      if (window.confirm('Trocar o código? Quem ainda não se cadastrou com o código atual vai precisar do novo.')) {
                        trocarConvite.mutate()
                      }
                    }}
                  >
                    <RefreshCw className="mr-1.5 h-4 w-4" /> Trocar
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Código indisponível.</p>
            )}
          </CardContent>
        </Card>
      )}

      {empresaId && (
        <Card className="glass-panel border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-primary" /> Telegram (opcional)
            </CardTitle>
            <CardDescription>
              Vincule seu Telegram para abrir e fechar OS pelo bot. O Modo Campo funciona sem isso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {eu?.telegram_user_id ? (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-green-400">
                  <CheckCircle2 className="h-4 w-4" /> Telegram vinculado
                </span>
                <Button variant="outline" size="sm" disabled={desvincular.isPending} onClick={() => desvincular.mutate()}>
                  <Unlink className="mr-1.5 h-4 w-4" /> Desvincular
                </Button>
              </div>
            ) : codigoTelegram ? (
              <div className="space-y-2">
                <p className="text-sm">Envie esta mensagem ao bot em até 10 minutos:</p>
                <button
                  type="button"
                  className="w-full rounded-lg bg-secondary/30 p-3 text-center font-mono text-lg font-bold"
                  onClick={() => copiar(`/vincular ${codigoTelegram}`, 'Mensagem copiada')}
                >
                  /vincular {codigoTelegram}
                </button>
                <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['equipe'] })}>
                  Já enviei, atualizar
                </Button>
              </div>
            ) : (
              <Button size="sm" disabled={gerarCodigoTelegram.isPending || !eu} onClick={() => gerarCodigoTelegram.mutate()}>
                {gerarCodigoTelegram.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vincular Telegram
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {empresaId && (
        <Card className="glass-panel border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Equipe ({equipe.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {equipeLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <ul className="divide-y divide-white/5">
                {equipe.map((t) => (
                  <li key={t.id_telegram} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {t.nome_completo}
                        {t.user_id === user?.id && <span className="text-muted-foreground"> (você)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{t.funcao || 'Sem função informada'}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {!t.user_id && <Badge variant="outline" className="text-[10px]">sem conta</Badge>}
                      {t.telegram_user_id && <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">Telegram</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <QRCodeDialog
        open={qrAberto}
        onOpenChange={setQrAberto}
        title="Convite para a equipe"
        subtitle="Aponte a câmera para criar a conta já na empresa"
        items={linkConvite ? [{ label: 'Convite', hint: 'Abre o cadastro com o código preenchido', url: linkConvite }] : []}
      />
    </div>
  )
}
