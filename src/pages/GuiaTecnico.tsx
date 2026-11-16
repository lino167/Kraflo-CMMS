import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { ArrowLeft, Printer } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { PASSOS_ANDROID, PASSOS_IPHONE } from '@/lib/passos-instalacao'

/**
 * Guia do técnico: uma página para imprimir (ou salvar em PDF) e entregar à equipe.
 * Fica fora do menu e do tema escuro de propósito: sai em papel branco, legível e sem barras.
 * Se quem abre é administrador, o guia traz o QR code do convite da empresa.
 */

const LARANJA = 'bg-[#ff8c1a]'

function Passos({ passos }: { passos: string[] }) {
  return (
    <ol className="space-y-1.5">
      {passos.map((p, i) => (
        <li key={p} className="flex gap-2.5 text-[13px] leading-snug">
          <span className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${LARANJA} text-[11px] font-bold text-neutral-900`}>
            {i + 1}
          </span>
          <span>{p}</span>
        </li>
      ))}
    </ol>
  )
}

function Secao({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid space-y-2 print:space-y-1">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${LARANJA} text-sm text-neutral-900`}>{numero}</span>
        {titulo}
      </h2>
      <div className="space-y-2 pl-8">{children}</div>
    </section>
  )
}

export default function GuiaTecnico() {
  const navigate = useNavigate()
  const { isAdminEmpresa, profile } = useAuth()
  const empresaId = profile?.empresa_id ?? null
  const endereco = typeof window === 'undefined' ? '' : window.location.origin

  const { data: convite } = useQuery({
    queryKey: ['codigo-convite', empresaId],
    enabled: !!empresaId && isAdminEmpresa,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_codigo_convite')
      if (error) throw error
      return data as string | null
    },
  })
  const linkConvite = convite ? `${endereco}/auth?convite=${convite}` : ''

  const [qr, setQr] = useState<string | null>(null)
  useEffect(() => {
    let cancelado = false
    if (!linkConvite) {
      setQr(null)
      return
    }
    QRCode.toDataURL(linkConvite, { width: 360, margin: 1, errorCorrectionLevel: 'M' })
      .then((d) => !cancelado && setQr(d))
      .catch(() => !cancelado && setQr(null))
    return () => {
      cancelado = true
    }
  }, [linkConvite])

  const hoje = new Date().toLocaleDateString('pt-BR')

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white">
      <style>{`@page { size: A4; margin: 12mm; } @media print { body { background: #fff !important; } }`}</style>

      <div className="mx-auto flex max-w-[820px] items-center justify-between gap-2 px-4 pt-4 print:hidden">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-11 items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className={`flex h-11 items-center gap-2 rounded-md ${LARANJA} px-4 text-sm font-semibold text-neutral-900 hover:opacity-90`}
        >
          <Printer className="h-4 w-4" /> Imprimir ou salvar em PDF
        </button>
      </div>

      <main className="mx-auto my-4 max-w-[820px] space-y-5 bg-white p-8 text-neutral-900 shadow-sm print:my-0 print:max-w-none print:space-y-3 print:p-0 print:shadow-none">
        <header className="flex items-center gap-4 border-b-2 border-[#ff8c1a] pb-4 print:pb-2">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${LARANJA} text-3xl font-bold text-neutral-900`}>K</div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Guia do Técnico</h1>
            <p className="text-sm text-neutral-600">Como entrar e usar o Kraflo no celular, com ou sem sinal.</p>
          </div>
        </header>

        <Secao numero={1} titulo="Crie a sua conta">
          <div className="flex items-start gap-4">
            {qr ? (
              <div className="shrink-0 text-center">
                <img src={qr} alt="QR code do convite" className="h-32 w-32 rounded border border-neutral-300 print:h-28 print:w-28" />
                <p className="mt-1 font-mono text-sm font-bold tracking-[0.2em]">{convite}</p>
              </div>
            ) : (
              <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded border-2 border-dashed border-neutral-300 p-2 text-center text-[11px] text-neutral-500">
                Seu gestor vai entregar o QR code ou o link de convite
              </div>
            )}
            <ol className="space-y-1.5 text-[13px] leading-snug">
              <li>
                <b>1.</b> Aponte a câmera do celular para o QR code (ou abra o link que o gestor enviou).
              </li>
              <li>
                <b>2.</b> Preencha nome, e-mail e senha. O código da empresa já vem preenchido.
              </li>
              <li>
                <b>3.</b> Se chegar um e-mail de confirmação, abra e toque no link.
              </li>
              <li>
                <b>4.</b> Entre com o seu e-mail e a sua senha.
              </li>
            </ol>
          </div>
        </Secao>

        <Secao numero={2} titulo="Instale no celular">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold">Android</h3>
              <Passos passos={PASSOS_ANDROID} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold">iPhone</h3>
              <Passos passos={PASSOS_IPHONE} />
            </div>
          </div>
        </Secao>

        <Secao numero={3} titulo="Primeiro acesso (precisa de internet)">
          <ul className="list-disc space-y-1 pl-4 text-[13px] leading-snug">
            <li>Abra o app e entre na sua conta.</li>
            <li>
              Crie um <b>PIN</b> de 6 números ou mais e <b>anote em lugar seguro</b>. Ele protege os dados guardados no celular.
            </li>
            <li>
              Espere aparecer <i>"Dados de apoio de…"</i> no topo. Daí em diante dá para trabalhar sem sinal.
            </li>
          </ul>
        </Secao>

        <Secao numero={4} titulo="Abrir uma OS">
          <p className="text-[13px] leading-snug">
            Aba <b>Nova OS</b>: escolha a <b>máquina</b> (ou digite o nome) e confira a <b>TAG</b>. Escolha o <b>motivo da parada</b>, o tipo e a
            prioridade. Descreva o problema, tire uma <b>foto</b> se puder e toque em <b>Salvar OS</b>.
          </p>
        </Secao>

        <Secao numero={5} titulo="Fechar uma OS">
          <p className="text-[13px] leading-snug">
            Aba <b>Abertas</b> → toque em <b>Fechar OS</b>. Escolha a <b>causa raiz</b>, descreva o <b>diagnóstico e a solução</b>, o status final,
            as <b>peças usadas</b> (se houver) e as <b>notas finais</b> (obrigatórias). Tire uma foto do serviço e toque em <b>Fechar OS</b>.
          </p>
        </Secao>

        <Secao numero={6} titulo="Sem sinal? Tudo bem">
          <ul className="list-disc space-y-1 pl-4 text-[13px] leading-snug">
            <li>As OS ficam guardadas no celular e saem sozinhas quando o sinal voltar. Ou toque em <b>Sincronizar</b>.</li>
            <li>
              A aba <b>Envio</b> mostra o que ainda não foi enviado. <b>Não saia da conta</b> enquanto houver itens nela.
            </li>
            <li>
              O uso sem sinal vale por <b>7 dias</b>. Abra o app com internet pelo menos uma vez por semana.
            </li>
          </ul>
        </Secao>

        <Secao numero={7} titulo="Deu problema?">
          <ul className="list-disc space-y-1 pl-4 text-[13px] leading-snug">
            <li>
              <b>Esqueci a senha:</b> na tela de entrada, toque em <i>"Esqueci minha senha"</i> e siga o e-mail.
            </li>
            <li>
              <b>Esqueci o PIN:</b> não tem como recuperar. É preciso apagar os dados do celular e entrar de novo com internet (OS ainda não
              enviadas se perdem).
            </li>
            <li>
              <b>"Conflito" ou "Erro" na aba Envio:</b> toque em Reenviar. Se continuar, fale com o gestor.
            </li>
            <li>
              <b>Sol forte, tela difícil de ler:</b> toque no ícone do sol no topo do Modo Campo.
            </li>
          </ul>
        </Secao>

        <footer className="flex items-center justify-between border-t border-neutral-200 pt-3 text-[11px] text-neutral-500">
          <span>Kraflo · {endereco.replace(/^https?:\/\//, '')}</span>
          <span>Guia gerado em {hoje}</span>
        </footer>
      </main>
    </div>
  )
}
