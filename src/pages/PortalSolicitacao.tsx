import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Bot, CheckCircle2, Loader2, Send } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { getErrorMessage } from '@/lib/error-handler'
import { solicitacaoPortalSchema } from '@/lib/estoque'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface PortalEquipamento {
  nome: string
  tag: string | null
  setor: string | null
}

interface PortalInfo {
  valido: boolean
  empresa_nome?: string
  equipamentos?: PortalEquipamento[]
}

const OUTRO = '__outro__'
const PRIORIDADES = [
  { value: 'Baixa', hint: 'Pode esperar' },
  { value: 'Média', hint: 'Atrapalha, mas a máquina roda' },
  { value: 'Alta', hint: 'Produção reduzida' },
  { value: 'Urgente', hint: 'Máquina parada ou risco à segurança' },
] as const

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <div className="rounded-lg bg-primary p-2">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-mono text-lg font-bold tracking-tighter">KRAFLO</span>
      </div>
      <div className="w-full max-w-lg">{children}</div>
    </div>
  )
}

export default function PortalSolicitacao() {
  const { token = '' } = useParams()
  const [searchParams] = useSearchParams()
  const tagInicial = searchParams.get('tag')

  const [equipamentoSel, setEquipamentoSel] = useState<string>('')
  const [equipamentoLivre, setEquipamentoLivre] = useState('')
  const [prioridade, setPrioridade] = useState<string>('Média')
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [protocolo, setProtocolo] = useState<string | null>(null)

  const { data: info, isLoading, isError } = useQuery({
    queryKey: ['portal-info', token],
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_portal_info', { p_token: token })
      if (error) throw error
      return data as unknown as PortalInfo
    },
  })

  const equipamentos = useMemo(() => info?.equipamentos ?? [], [info])

  // QR code da máquina: já chega com o equipamento escolhido
  useEffect(() => {
    if (!equipamentos.length || equipamentoSel) return
    const idx = tagInicial ? equipamentos.findIndex((e) => e.tag === tagInicial) : -1
    if (idx >= 0) setEquipamentoSel(String(idx))
  }, [equipamentos, tagInicial, equipamentoSel])

  const selecionado = equipamentoSel && equipamentoSel !== OUTRO ? equipamentos[Number(equipamentoSel)] : null
  const usaTextoLivre = equipamentos.length === 0 || equipamentoSel === OUTRO

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const parsed = solicitacaoPortalSchema.safeParse({
      equipamento_nome: usaTextoLivre ? equipamentoLivre : (selecionado?.nome ?? ''),
      equipamento_tag: selecionado?.tag ?? undefined,
      localizacao: (form.get('localizacao') as string) || selecionado?.setor || undefined,
      descricao: form.get('descricao'),
      prioridade,
      solicitante_nome: form.get('solicitante_nome'),
      solicitante_contato: form.get('solicitante_contato') || undefined,
    })

    if (!parsed.success) {
      setErros(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])))
      return
    }
    setErros({})
    setErroEnvio(null)
    setEnviando(true)

    const { data, error } = await supabase.rpc('fn_portal_criar_solicitacao', {
      p_token: token,
      p_equipamento_nome: parsed.data.equipamento_nome,
      p_descricao: parsed.data.descricao,
      p_solicitante_nome: parsed.data.solicitante_nome,
      p_equipamento_tag: parsed.data.equipamento_tag,
      p_localizacao: parsed.data.localizacao,
      p_prioridade: parsed.data.prioridade,
      p_solicitante_contato: parsed.data.solicitante_contato,
    })
    setEnviando(false)

    if (error) {
      setErroEnvio(getErrorMessage(error))
      return
    }
    setProtocolo((data as { protocolo?: string } | null)?.protocolo ?? '')
  }

  if (isLoading) {
    return (
      <PortalShell>
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalShell>
    )
  }

  if (isError || !info?.valido) {
    return (
      <PortalShell>
        <Card className="glass-panel border-white/10">
          <CardContent className="space-y-3 p-8 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-yellow-400" />
            <h1 className="text-lg font-semibold">Link indisponível</h1>
            <p className="text-sm text-muted-foreground">
              {isError
                ? 'Não foi possível carregar o portal. Verifique sua conexão e tente novamente.'
                : 'Este link de solicitação é inválido ou expirou. Peça um novo link à equipe de manutenção.'}
            </p>
          </CardContent>
        </Card>
      </PortalShell>
    )
  }

  if (protocolo !== null) {
    return (
      <PortalShell>
        <Card className="glass-panel border-white/10">
          <CardContent className="space-y-4 p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <h1 className="text-xl font-semibold">Solicitação enviada</h1>
            <p className="text-sm text-muted-foreground">
              A equipe de manutenção de {info.empresa_nome} recebeu seu chamado e fará a triagem.
            </p>
            {protocolo && (
              <p className="rounded-lg bg-secondary/30 p-3 font-mono text-sm">
                Protocolo <span className="font-bold text-primary">{protocolo}</span>
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setProtocolo(null)
                setEquipamentoLivre('')
              }}
            >
              Abrir outra solicitação
            </Button>
          </CardContent>
        </Card>
      </PortalShell>
    )
  }

  return (
    <PortalShell>
      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle>Solicitar manutenção</CardTitle>
          <CardDescription>{info.empresa_nome} — descreva o problema e a equipe de manutenção será avisada.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            onChange={() => Object.keys(erros).length && setErros({})}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="equipamento">Equipamento</Label>
              {equipamentos.length > 0 && (
                <Select value={equipamentoSel} onValueChange={setEquipamentoSel}>
                  <SelectTrigger id="equipamento">
                    <SelectValue placeholder="Selecione o equipamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipamentos.map((eq, i) => (
                      <SelectItem key={`${eq.tag}-${i}`} value={String(i)}>
                        {eq.tag ? `${eq.tag} — ` : ''}
                        {eq.nome}
                        {eq.setor ? ` (${eq.setor})` : ''}
                      </SelectItem>
                    ))}
                    <SelectItem value={OUTRO}>Outro / não está na lista</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {usaTextoLivre && (
                <Input
                  id={equipamentos.length ? 'equipamento_livre' : 'equipamento'}
                  aria-label="Nome do equipamento"
                  placeholder="Nome do equipamento ou local"
                  value={equipamentoLivre}
                  onChange={(e) => setEquipamentoLivre(e.target.value)}
                />
              )}
              {erros.equipamento_nome && <p className="text-xs text-destructive">{erros.equipamento_nome}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">O que está acontecendo?</Label>
              <Textarea
                id="descricao"
                name="descricao"
                rows={4}
                maxLength={2000}
                placeholder="Ex.: vazamento de óleo no redutor, barulho forte ao ligar..."
              />
              {erros.descricao && <p className="text-xs text-destructive">{erros.descricao}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prioridade">Urgência</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger id="prioridade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.value} — {p.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="localizacao">Local (opcional)</Label>
              <Input id="localizacao" name="localizacao" maxLength={150} placeholder={selecionado?.setor || 'Galpão, linha, sala...'} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="solicitante_nome">Seu nome</Label>
                <Input id="solicitante_nome" name="solicitante_nome" maxLength={120} autoComplete="name" />
                {erros.solicitante_nome && <p className="text-xs text-destructive">{erros.solicitante_nome}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="solicitante_contato">Contato (opcional)</Label>
                <Input id="solicitante_contato" name="solicitante_contato" maxLength={120} placeholder="Ramal ou telefone" />
              </div>
            </div>

            {erroEnvio && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {erroEnvio}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar solicitação
            </Button>
          </form>
        </CardContent>
      </Card>
    </PortalShell>
  )
}
