import { useSyncExternalStore } from 'react'

/**
 * Instalação do app na tela inicial.
 *
 * - Chrome, Edge e Samsung Internet (Android e computador) avisam por um evento (`beforeinstallprompt`)
 *   que dispara uma vez, cedo. Por isso este arquivo é importado na entrada do app (main.tsx): se esperasse
 *   a tela abrir, o evento já teria passado.
 * - O Safari do iPhone/iPad não tem esse evento: o técnico precisa seguir passos manuais (Compartilhar).
 */

interface EventoDeInstalacao extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type SituacaoInstalacao =
  /** Já aberto como app instalado. */
  | 'instalado'
  /** O navegador instala com um toque. */
  | 'pelo-navegador'
  /** iPhone/iPad: passos manuais no Safari. */
  | 'ios'
  /** Outros navegadores: instruções gerais. */
  | 'outro'

export function ehIOS(userAgent: string, pontosDeToque: number): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true
  // iPadOS 13+ se apresenta como Mac, mas tem tela de toque
  return /Macintosh/i.test(userAgent) && pontosDeToque > 1
}

export function classificarInstalacao(c: { standalone: boolean; temEvento: boolean; ios: boolean }): SituacaoInstalacao {
  if (c.standalone) return 'instalado'
  if (c.temEvento) return 'pelo-navegador'
  if (c.ios) return 'ios'
  return 'outro'
}

const DIAS_SEM_INSISTIR = 14
const CHAVE_DISPENSA = 'kraflo:instalar-dispensado'

/** O técnico fechou o aviso há pouco tempo: não insiste de novo. */
export function dispensadoRecentemente(agora: number, dispensadoEm: number | null): boolean {
  if (dispensadoEm === null || !Number.isFinite(dispensadoEm)) return false
  return agora - dispensadoEm < DIAS_SEM_INSISTIR * 86_400_000
}

/* ---------------- estado do navegador ---------------- */

let evento: EventoDeInstalacao | null = null
let instalado = false
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())

function estaInstalado(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true
}

if (typeof window !== 'undefined') {
  instalado = estaInstalado()
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // guarda para oferecer no momento certo, em vez do banner automático
    evento = e as EventoDeInstalacao
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    evento = null
    instalado = true
    avisar()
  })
}

function situacaoAtual(): SituacaoInstalacao {
  const nav = typeof navigator === 'undefined' ? null : navigator
  return classificarInstalacao({
    standalone: instalado,
    temEvento: evento !== null,
    ios: nav ? ehIOS(nav.userAgent, nav.maxTouchPoints ?? 0) : false,
  })
}

const assinar = (f: () => void) => {
  ouvintes.add(f)
  return () => {
    ouvintes.delete(f)
  }
}

export function useSituacaoInstalacao(): SituacaoInstalacao {
  return useSyncExternalStore(assinar, situacaoAtual, () => 'outro' as SituacaoInstalacao)
}

/** Abre o convite de instalação do navegador. `false` quando o navegador não oferece (iPhone, por exemplo). */
export async function instalarApp(): Promise<boolean> {
  if (!evento) return false
  const e = evento
  await e.prompt()
  const { outcome } = await e.userChoice
  evento = null // o evento só pode ser usado uma vez
  if (outcome === 'accepted') instalado = true // o aviso some já, sem esperar o navegador confirmar
  avisar()
  return outcome === 'accepted'
}

export function lerDispensa(): number | null {
  try {
    const v = localStorage.getItem(CHAVE_DISPENSA)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

export function gravarDispensa(agora: number): void {
  try {
    localStorage.setItem(CHAVE_DISPENSA, String(agora))
  } catch {
    // sem armazenamento: o aviso só volta a aparecer
  }
}
