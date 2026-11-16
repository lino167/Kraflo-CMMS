"use client"

/**
 * Draggable Widget Grid — uma grade de widgets que se reorganiza arrastando.
 *
 * O layout é uma sequência mais um tamanho por widget: um encaixe exato transforma a sequência num retângulo sem
 * buracos em qualquer número de colunas, e o Motion anima cada mudança.
 *
 * - Mouse e caneta arrastam na hora. No toque é preciso segurar um instante, para a página continuar rolando.
 * - Pelo teclado: foque um widget, segure Alt e use as setas.
 * - As cores vêm de variáveis CSS (--dwg-card, --dwg-border…), com um tema escuro de fábrica: dá para trocar pelo
 *   tema do projeto, claro ou escuro, sem mexer no componente.
 * - Funciona dentro de um elemento com transform: scale (um zoom, uma prévia encolhida): as medidas e o arraste
 *   descontam a escala.
 */

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { MotionConfig, motion, useDragControls } from "motion/react"

/* ------------------------------------------------------------------ *
 * Tipos
 * ------------------------------------------------------------------ */

/** Colunas × linhas: `sm` 1×1, `wide` 2×1, `tall` 1×2, `lg` 2×2. */
export type WidgetSize = "sm" | "wide" | "tall" | "lg"

export interface WidgetItem {
  /** Id estável e único. */
  id: string
  size: WidgetSize
  /** Nome acessível do widget. */
  label?: string
}

export interface DraggableWidgetGridProps {
  /** A arrumação inicial. Depois de montada, a grade cuida da ordem. */
  items?: WidgetItem[]
  /** Recebe a ordem nova depois de soltar um widget ou de movê-lo pelo teclado. */
  onChange?: (items: WidgetItem[]) => void
  /** Desenha o conteúdo de um widget. */
  renderItem?: (item: WidgetItem, size: WidgetSize) => ReactNode
  /** Liga o arraste e os movimentos pelo teclado. */
  editable?: boolean
  /** O máximo de colunas. */
  maxColumns?: number
  /** A largura desejada de uma célula, em px; o número de colunas sai dela. */
  cellSize?: number
  /** O espaço entre os widgets, em px. */
  gap?: number
  /** O raio dos cantos de um widget, em px. */
  radius?: number
  className?: string
}

const SPANS: { [K in WidgetSize]: { col: number; row: number } } = {
  sm: { col: 1, row: 1 },
  wide: { col: 2, row: 1 },
  tall: { col: 1, row: 2 },
  lg: { col: 2, row: 2 },
}

const SIZE_LABELS: { [K in WidgetSize]: string } = {
  sm: "pequeno",
  wide: "largo",
  tall: "alto",
  lg: "grande",
}

const DEFAULT_ITEMS: WidgetItem[] = [
  { id: "widget-1", size: "wide" },
  { id: "widget-2", size: "sm" },
  { id: "widget-3", size: "sm" },
  { id: "widget-4", size: "sm" },
  { id: "widget-5", size: "wide" },
  { id: "widget-6", size: "sm" },
  { id: "widget-7", size: "sm" },
  { id: "widget-8", size: "wide" },
  { id: "widget-9", size: "sm" },
]

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

function sizeOf(w: number, h: number): WidgetSize {
  if (w >= 2 && h >= 2) return "lg"
  if (w >= 2) return "wide"
  if (h >= 2) return "tall"
  return "sm"
}

/** Quanto o elemento está encolhido ou ampliado na tela (um transform: scale num ancestral); 1 sem transform. */
function scaleOf(el: HTMLElement | null) {
  if (!el || !el.offsetWidth) return 1
  return el.getBoundingClientRect().width / el.offsetWidth || 1
}

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

interface Placement {
  id: string
  col: number
  row: number
  w: number
  h: number
}

interface Box {
  col: number
  row: number
  w: number
  h: number
}

const overlaps = (a: Box, b: Box) =>
  a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h

const contains = (outer: Box, inner: Box) =>
  inner.col >= outer.col &&
  inner.row >= outer.row &&
  inner.col + inner.w <= outer.col + outer.w &&
  inner.row + inner.h <= outer.row + outer.h

function spanOf(item: WidgetItem, columns: number) {
  return { w: Math.min(SPANS[item.size].col, columns), h: SPANS[item.size].row }
}

/**
 * Posiciona todos os widgets. Tenta primeiro um encaixe exato (sem buracos e sem esticar ninguém); se não houver,
 * cai num empacotador por linhas que alarga widgets para fechar os buracos.
 */
function layout(items: WidgetItem[], columns: number): Placement[] {
  if (columns < 1 || items.length === 0) return []
  return tile(items, columns) ?? pack(items, columns)
}

const TILING_BUDGET = 20000

/**
 * Encaixe exato. A primeira célula vazia, na ordem de leitura, fica com o primeiro widget que cabe nela e ainda
 * deixa os outros caberem.
 */
function tile(items: WidgetItem[], columns: number): Placement[] | null {
  const spans = items.map((item) => spanOf(item, columns))
  const area = spans.reduce((n, s) => n + s.w * s.h, 0)
  const rows = Math.ceil(area / columns)
  const grid: boolean[] = new Array(rows * columns).fill(false)
  const used: boolean[] = new Array(items.length).fill(false)
  const out: Placement[] = []
  let budget = TILING_BUDGET

  const fits = (w: number, h: number, r: number, c: number) => {
    if (c + w > columns || r + h > rows) return false
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (grid[y * columns + x]) return false
    return true
  }
  const mark = (w: number, h: number, r: number, c: number, v: boolean) => {
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) grid[y * columns + x] = v
  }

  const place = (count: number): boolean => {
    if (count === items.length) return true
    if (--budget < 0) return false
    const i = grid.indexOf(false)
    if (i < 0) return false
    const r = Math.floor(i / columns)
    const c = i % columns
    // nesta célula, widgets do mesmo formato dão no mesmo: basta tentar um de cada
    const tried = new Set([] as string[])
    for (let k = 0; k < items.length; k++) {
      if (used[k]) continue
      const { w, h } = spans[k]
      const shape = `${w}x${h}`
      if (tried.has(shape) || !fits(w, h, r, c)) continue
      tried.add(shape)
      used[k] = true
      mark(w, h, r, c, true)
      out.push({ id: items[k].id, col: c, row: r, w, h })
      if (place(count + 1)) return true
      out.pop()
      mark(w, h, r, c, false)
      used[k] = false
    }
    return false
  }

  return place(0) ? out : null
}

/** O plano B: enche as linhas na ordem e depois alarga widgets para fechar cada linha. */
function pack(items: WidgetItem[], columns: number): Placement[] {
  const out: Placement[] = []
  let row = 0
  let queue = items.map((item) => ({ id: item.id, ...spanOf(item, columns) }))

  while (queue.length > 0) {
    const height = Math.max(...queue.slice(0, columns).map((q) => q.h))
    const cells: boolean[] = new Array(height * columns).fill(false)
    const band: Placement[] = []
    const rest: typeof queue = []

    for (const q of queue) {
      let spot = -1
      for (let i = 0; i < cells.length && spot < 0; i++) {
        const r = Math.floor(i / columns)
        const c = i % columns
        if (c + q.w > columns || r + q.h > height) continue
        let free = true
        for (let y = r; y < r + q.h && free; y++)
          for (let x = c; x < c + q.w && free; x++) if (cells[y * columns + x]) free = false
        if (free) spot = i
      }
      if (spot < 0 || rest.length > 0) {
        rest.push(q)
        continue
      }
      const r = Math.floor(spot / columns)
      const c = spot % columns
      for (let y = r; y < r + q.h; y++) for (let x = c; x < c + q.w; x++) cells[y * columns + x] = true
      band.push({ id: q.id, col: c, row: r, w: q.w, h: q.h })
    }

    // cada célula que sobrou vazia é ocupada por um vizinho que cresce para a direita ou para baixo
    for (let i = 0; i < cells.length; i++) {
      if (cells[i]) continue
      const r = Math.floor(i / columns)
      const c = i % columns
      const left = band.find((p) => p.col + p.w === c && p.row <= r && p.row + p.h > r && p.h === 1)
      const above = band.find((p) => p.row + p.h === r && p.col === c && p.w === 1)
      const grow = left ?? above
      if (!grow) continue
      if (grow === left) grow.w += 1
      else grow.h += 1
      cells[i] = true
    }

    out.push(...band.map((p) => ({ ...p, row: p.row + row })))
    row += height
    queue = rest
  }
  return out
}

/** Reordena `items` na ordem de leitura do layout deles. */
function canonical(items: WidgetItem[], columns: number): WidgetItem[] {
  const places = layout(items, columns)
  if (places.length !== items.length) return items
  const byId = new Map(items.map((item) => [item.id, item]))
  const sorted = [...places]
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((p) => byId.get(p.id) as WidgetItem)
  if (sorted.every((item, i) => item === items[i])) return items
  // só adota a ordem de leitura quando ela dá exatamente o mesmo layout
  const at = new Map(places.map((p) => [p.id, p]))
  const same = layout(sorted, columns).every((p) => {
    const q = at.get(p.id)
    return q && q.col === p.col && q.row === p.row && q.w === p.w && q.h === p.h
  })
  return same ? sorted : items
}

function moveTo(items: WidgetItem[], id: string, index: number) {
  const from = items.findIndex((item) => item.id === id)
  if (from < 0 || from === index || index < 0 || index >= items.length) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(index, 0, moved)
  return next
}

const sameOrder = (a: WidgetItem[], b: WidgetItem[]) =>
  a.length === b.length && a.every((item, i) => item.id === b[i].id)

/* ------------------------------------------------------------------ *
 * Onde o widget arrastado cai
 * ------------------------------------------------------------------ */

/** O retângulo de um widget na tela, no layout parado. */
interface Slot {
  left: number
  top: number
  right: number
  bottom: number
}

interface Candidate {
  order: WidgetItem[]
  slot: Slot
}

/** Quanto do lugar o centro do widget arrastado precisa invadir para ficar com ele. */
const ENTER = 0.18

/**
 * Escolhe a arrumação cujo lugar para `id` fica mais perto do centro do widget arrastado, ou null para manter a
 * atual.
 *
 * Os candidatos são medidos até um lugar encolhido por `ENTER`, e o lugar atual inteiro. Assim cada troca aceita
 * diminui de verdade essa distância, e a grade nunca fica oscilando entre duas arrumações.
 */
function choose(home: Slot, candidates: Candidate[], cx: number, cy: number): WidgetItem[] | null {
  const distance = (s: Slot, inset: number) => {
    const ix = (s.right - s.left) * inset
    const iy = (s.bottom - s.top) * inset
    const dx = Math.max(s.left + ix - cx, 0, cx - (s.right - ix))
    const dy = Math.max(s.top + iy - cy, 0, cy - (s.bottom - iy))
    return Math.hypot(dx, dy)
  }
  const toCentre = (s: Slot) => Math.hypot((s.left + s.right) / 2 - cx, (s.top + s.bottom) / 2 - cy)

  let best = distance(home, 0)
  if (best === 0) return null
  let pick: WidgetItem[] | null = null
  let bestCentre = Infinity
  for (const { order, slot } of candidates) {
    const d = distance(slot, ENTER)
    const c = toCentre(slot)
    // no empate fica o primeiro candidato; as trocas de grupo vêm antes na lista
    if (d < best || (d === best && pick && c < bestCentre)) {
      best = d
      bestCentre = c
      pick = order
    }
  }
  return pick
}

/**
 * Todas as arrumações a um movimento de `items`:
 * - trocas de grupo: uma área do formato do widget arrastado, cheia de widgets menores, troca de lugar com ele e
 *   mantém a arrumação de dentro;
 * - movimentos na sequência: o widget arrastado vai para outra posição.
 */
function candidatesFor(
  items: WidgetItem[],
  id: string,
  columns: number,
  toSlot: (box: Box) => Slot,
): Candidate[] {
  const places = layout(items, columns)
  const me = places.find((p) => p.id === id)
  if (!me) return []
  const byId = new Map(items.map((item) => [item.id, item]))
  const rows = Math.max(...places.map((p) => p.row + p.h))
  const out: Candidate[] = []

  for (let row = 0; row + me.h <= rows; row++) {
    for (let col = 0; col + me.w <= columns; col++) {
      const area = { col, row, w: me.w, h: me.h }
      if (overlaps(area, me)) continue
      const group = places.filter((p) => overlaps(p, area))
      if (group.length < 2 || !group.every((p) => contains(area, p))) continue
      const moved = places.map((p) =>
        p.id === id
          ? { ...p, col, row }
          : group.includes(p)
            ? { ...p, col: p.col - col + me.col, row: p.row - row + me.row }
            : p,
      )
      moved.sort((a, b) => a.row - b.row || a.col - b.col)
      out.push({
        order: moved.map((p) => byId.get(p.id) as WidgetItem),
        slot: toSlot(area),
      })
    }
  }

  const from = items.findIndex((item) => item.id === id)
  for (let i = 0; i < items.length; i++) {
    if (i === from) continue
    const order = moveTo(items, id, i)
    const p = layout(order, columns).find((q) => q.id === id)
    if (p) out.push({ order, slot: toSlot(p) })
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Movimento
 * ------------------------------------------------------------------ */

const SPRING = { type: "spring", visualDuration: 0.38, bounce: 0.16 } as const
const LIFT = { type: "spring", visualDuration: 0.26, bounce: 0.32 } as const
const LIFT_SCALE = 1.06
/** O tempo mínimo entre duas reorganizações durante um arraste. */
const SETTLE_MS = 40
/** Quanto tempo o contorno de quem acabou de cair fica aceso. */
const LANDED_MS = 620
/** Toque: quanto tempo segurar até o widget levantar. */
const LONG_PRESS_MS = 350
/** Toque: quanto o dedo pode andar enquanto segura antes de virar rolagem. */
const PRESS_SLOP = 8
// as duas com o mesmo número de camadas, para a sombra poder ser animada de uma para a outra
const SHADOW_REST = "0px 1px 2px 0px rgba(0,0,0,0.12), 0px 0px 0px 0px rgba(0,0,0,0)"
const SHADOW_LIFTED = "0px 28px 60px -16px rgba(0,0,0,0.45), 0px 10px 24px -8px rgba(0,0,0,0.3)"

/* ------------------------------------------------------------------ *
 * Widget
 * ------------------------------------------------------------------ */

interface Press {
  timer: number
  pointerId: number
  x: number
  y: number
}

type Phase = "idle" | "holding" | "lifted"

interface WidgetHandlers {
  start: (id: string) => void
  drag: () => void
  end: (id: string) => void
  key: (e: ReactKeyboardEvent, id: string) => void
  /** true enquanto o clique que vem depois de soltar deve ser ignorado. */
  swallow: () => boolean
  /** Ignora o próximo clique (quando o dedo sai da tela depois de um arraste). */
  suppressClick: () => void
}

const Widget = memo(function Widget({
  item,
  col,
  row,
  w,
  h,
  columns,
  rows,
  editable,
  held,
  raised,
  landed,
  handlers,
  hintId,
  position,
  count,
  renderItem,
}: {
  item: WidgetItem
  col: number
  row: number
  w: number
  h: number
  columns: number
  rows: number
  editable: boolean
  held: boolean
  raised: boolean
  landed: boolean
  handlers: WidgetHandlers
  hintId: string
  /** A posição na ordem de leitura, a partir de 1, para as tecnologias assistivas. */
  position: number
  count: number
  renderItem?: (item: never, size: WidgetSize) => ReactNode
}) {
  const controls = useDragControls()
  const node = useRef(null as HTMLDivElement | null)
  const press = useRef(null as Press | null)
  const lifted = useRef(false)
  const cleanup = useRef(null as (() => void) | null)
  const [phase, setPhase] = useState("idle" as Phase)

  const release = useCallback(() => {
    if (press.current) window.clearTimeout(press.current.timer)
    press.current = null
    lifted.current = false
    cleanup.current?.()
    cleanup.current = null
    setPhase("idle")
  }, [])

  useEffect(() => {
    const el = node.current
    if (!el) return
    // levantado, o dedo arrasta o widget em vez de rolar a página
    const block = (e: TouchEvent) => {
      if (lifted.current) e.preventDefault()
    }
    el.addEventListener("touchmove", block, { passive: false })
    return () => {
      el.removeEventListener("touchmove", block)
      if (press.current) window.clearTimeout(press.current.timer)
      cleanup.current?.()
    }
  }, [])

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!editable || e.button !== 0 || !e.isPrimary) return
    if (e.pointerType !== "touch") {
      controls.start(e)
      return
    }
    if (press.current || lifted.current) return
    const origin = e.nativeEvent
    const pointerId = e.pointerId
    setPhase("holding")
    press.current = {
      pointerId,
      x: e.clientX,
      y: e.clientY,
      timer: window.setTimeout(() => {
        press.current = null
        lifted.current = true
        setPhase("lifted")
        navigator.vibrate?.(10)
        controls.start(origin)
        const done = (ev: PointerEvent) => {
          if (ev.pointerId !== pointerId) return
          handlers.suppressClick()
          release()
        }
        window.addEventListener("pointerup", done)
        window.addEventListener("pointercancel", done)
        cleanup.current = () => {
          window.removeEventListener("pointerup", done)
          window.removeEventListener("pointercancel", done)
        }
      }, LONG_PRESS_MS),
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const p = press.current
    if (p && e.pointerId === p.pointerId && Math.hypot(e.clientX - p.x, e.clientY - p.y) > PRESS_SLOP) release()
  }

  const onPointerEnd = (e: ReactPointerEvent) => {
    if (press.current?.pointerId === e.pointerId) release()
  }

  const delay = (col / Math.max(columns, 1) + row / Math.max(rows, 1)) * 0.26

  return (
    <motion.div
      ref={node}
      role="listitem"
      className="dwg-item"
      data-slot="widget"
      data-widget-id={item.id}
      data-editable={editable || undefined}
      tabIndex={editable ? 0 : undefined}
      aria-label={item.label ?? `Widget ${SIZE_LABELS[item.size]}`}
      aria-describedby={editable ? hintId : undefined}
      aria-posinset={position}
      aria-setsize={count}
      layout="position"
      drag={editable}
      dragListener={false}
      dragControls={controls}
      dragSnapToOrigin
      dragMomentum={false}
      onDragStart={() => handlers.start(item.id)}
      onDrag={handlers.drag}
      onDragEnd={() => handlers.end(item.id)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onContextMenu={(e) => {
        if (phase !== "idle") e.preventDefault()
      }}
      onKeyDown={(e) => handlers.key(e, item.id)}
      onClickCapture={(e) => {
        if (handlers.swallow() || (editable && (e.target as HTMLElement).closest("a"))) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      animate={{
        scale: phase === "holding" ? 0.97 : phase === "lifted" ? LIFT_SCALE : 1,
        boxShadow: phase === "lifted" ? SHADOW_LIFTED : SHADOW_REST,
      }}
      whileDrag={{
        scale: LIFT_SCALE,
        boxShadow: SHADOW_LIFTED,
        transition: LIFT,
      }}
      transition={SPRING}
      style={{
        gridColumn: `${col + 1} / span ${w}`,
        gridRow: `${row + 1} / span ${h}`,
        zIndex: held ? 20 : raised ? 10 : 0,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          type: "spring",
          visualDuration: 0.6,
          bounce: 0.12,
          delay,
        }}
        className="dwg-card"
        data-landed={landed || undefined}
      >
        {renderItem?.(item as never, sizeOf(w, h))}
      </motion.div>
    </motion.div>
  )
})

/* ------------------------------------------------------------------ *
 * Grade
 * ------------------------------------------------------------------ */

export function DraggableWidgetGrid({
  items: initialItems,
  onChange,
  renderItem,
  editable = true,
  maxColumns = 4,
  cellSize = 215,
  gap = 12,
  radius = 24,
  className = "",
}: DraggableWidgetGridProps) {
  const [items, setItems] = useState(() => initialItems ?? DEFAULT_ITEMS)
  const grid = useRef(null as HTMLDivElement | null)
  const hintId = useId()
  const minColumns = Math.min(2, Math.max(1, maxColumns))

  // as medidas são as do layout (clientWidth), não as da tela: um transform: scale em volta não muda as colunas
  const [metrics, setMetrics] = useState({ unit: 0, columns: 0 })
  useIsoLayoutEffect(() => {
    const el = grid.current
    if (!el) return
    const measure = () => {
      const width = el.clientWidth
      if (width < 1) return
      const columns = Math.max(minColumns, Math.min(maxColumns, Math.round(width / cellSize)))
      const unit = (width - gap * (columns - 1)) / columns
      setMetrics((was) =>
        was.columns === columns && Math.abs(was.unit - unit) < 0.5 ? was : { unit, columns },
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [maxColumns, minColumns, cellSize, gap])

  const columns = metrics.columns || Math.max(minColumns, maxColumns)
  const placements = useMemo(() => layout(items, columns), [items, columns])
  const rows = placements.reduce((n, p) => Math.max(n, p.row + p.h), 0)

  // os valores mais recentes, para os eventos que duram mais que uma renderização
  const latest = useRef({ items, metrics, onChange })
  latest.current.metrics = metrics
  latest.current.onChange = onChange
  useIsoLayoutEffect(() => {
    latest.current.items = items
  }, [items])

  const commit = useCallback((next: WidgetItem[]) => {
    latest.current.items = next
    setItems(next)
  }, [])

  // o lugar na tela: as medidas do layout vezes a escala em que a grade aparece
  const toSlot = useCallback(
    (box: Box): Slot => {
      const el = grid.current
      const { unit } = latest.current.metrics
      const rect = el?.getBoundingClientRect()
      const k = scaleOf(el)
      const colStep = (unit + gap) * k
      const rowStep = (Math.round(unit) + gap) * k
      const left = (rect?.left ?? 0) + box.col * colStep
      const top = (rect?.top ?? 0) + box.row * rowStep
      return {
        left,
        top,
        right: left + box.w * colStep - gap * k,
        bottom: top + box.h * rowStep - gap * k,
      }
    },
    [gap],
  )

  // o Motion mede o arraste e as animações de layout na tela; dentro de um ancestral com escala, as distâncias
  // voltam para o tamanho do layout, senão o widget andaria mais (ou menos) que o ponteiro
  const transformPagePoint = useCallback((point: { x: number; y: number }) => {
    const k = scaleOf(grid.current)
    return k === 1 ? point : { x: point.x / k, y: point.y / k }
  }, [])

  /* O estado do arraste. O React só renderiza de novo ao levantar, ao reorganizar e ao soltar. */
  const [held, setHeld] = useState(null as string | null)
  const [raised, setRaised] = useState(null as string | null)
  const [landed, setLanded] = useState(null as string | null)
  const dragging = useRef(null as string | null)
  const startOrder = useRef(null as WidgetItem[] | null)
  const frame = useRef(0)
  const lastMove = useRef(0)
  const swallowUntil = useRef(0)
  const ring = useRef(0)
  const refocus = useRef(null as string | null)

  const step = useCallback(
    (force = false) => {
      frame.current = 0
      const id = dragging.current
      const { items: current, metrics: m } = latest.current
      const el = id
        ? (grid.current?.querySelector(`[data-widget-id="${CSS.escape(id)}"]`) as HTMLElement | null)
        : null
      if (!id || !el || !m.columns) return
      const now = performance.now()
      if (!force && now - lastMove.current < SETTLE_MS) {
        // tenta de novo no próximo quadro, para um widget parado no lugar também se acomodar
        frame.current = requestAnimationFrame(() => step())
        return
      }
      const me = layout(current, m.columns).find((p) => p.id === id)
      if (!me) return
      const r = el.getBoundingClientRect()
      const order = choose(
        toSlot(me),
        candidatesFor(current, id, m.columns, toSlot),
        r.left + r.width / 2,
        r.top + r.height / 2,
      )
      if (!order) return
      lastMove.current = now
      commit(canonical(order, m.columns))
    },
    [toSlot, commit],
  )

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current)
      window.clearTimeout(ring.current)
    },
    [],
  )

  // o foco do teclado continua no widget depois que ele muda de lugar
  useIsoLayoutEffect(() => {
    const id = refocus.current
    if (!id) return
    refocus.current = null
    const el = grid.current?.querySelector(`[data-widget-id="${CSS.escape(id)}"]`) as HTMLElement | null
    el?.focus()
  }, [items])

  const handlers: WidgetHandlers = useMemo(
    () => ({
      start: (id) => {
        dragging.current = id
        startOrder.current = latest.current.items
        lastMove.current = 0
        setHeld(id)
        setRaised(id)
        // o clique que sai ao soltar não pode chegar ao conteúdo do widget
        window.addEventListener(
          "pointerup",
          () => {
            swallowUntil.current = performance.now() + 300
          },
          { once: true, capture: true },
        )
      },
      drag: () => {
        if (!frame.current) frame.current = requestAnimationFrame(() => step())
      },
      end: (id) => {
        cancelAnimationFrame(frame.current)
        step(true)
        frame.current = 0
        dragging.current = null
        setHeld(null)
        setLanded(id)
        window.clearTimeout(ring.current)
        ring.current = window.setTimeout(() => {
          setLanded(null)
          setRaised(null)
        }, LANDED_MS)
        const before = startOrder.current
        startOrder.current = null
        const after = latest.current.items
        if (before && !sameOrder(before, after)) latest.current.onChange?.(after)
      },
      key: (e, id) => {
        if (!editable || !e.altKey) return
        if ((e.target as HTMLElement).closest("input, textarea, select")) return
        const delta =
          e.key === "ArrowRight" || e.key === "ArrowDown"
            ? 1
            : e.key === "ArrowLeft" || e.key === "ArrowUp"
              ? -1
              : 0
        if (!delta) return
        e.preventDefault()
        const { items: current, metrics: m } = latest.current
        const cols = m.columns || maxColumns
        const from = current.findIndex((item) => item.id === id)
        // anda até o layout mudar de verdade
        for (let to = from + delta; to >= 0 && to < current.length; to += delta) {
          const next = canonical(moveTo(current, id, to), cols)
          if (sameOrder(next, current)) continue
          refocus.current = id
          commit(next)
          latest.current.onChange?.(next)
          return
        }
      },
      swallow: () => performance.now() < swallowUntil.current,
      suppressClick: () => {
        swallowUntil.current = performance.now() + 300
      },
    }),
    [step, commit, editable, maxColumns],
  )

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  /*
   * A ordem no DOM não muda; só muda o lugar na grade. Mover elementos no DOM reinicia a animação de entrada do
   * Motion em algumas versões do React, e os widgets reorganizados sumiam e voltavam. A posição que se vê vai para as
   * tecnologias assistivas pelo aria-posinset.
   */
  const domOrder = useRef(items.map((item) => item.id))
  for (const item of items) if (!domOrder.current.includes(item.id)) domOrder.current.push(item.id)
  const placementById = new Map(placements.map((p) => [p.id, p]))
  const visualIndex = new Map(
    [...placements].sort((a, b) => a.row - b.row || a.col - b.col).map((p, i) => [p.id, i]),
  )

  return (
    <MotionConfig reducedMotion="user" transformPagePoint={transformPagePoint}>
      <div
        className={"dwg-root" + (className ? " " + className : "")}
        style={{ "--dwg-radius": `${radius}px` } as CSSProperties}
      >
        {/* o CSS cru: como filho de texto, o SSR do React 18 escaparia as aspas e quebraria os seletores */}
        <style dangerouslySetInnerHTML={{ __html: DWG_CSS }} />
        {editable && (
          <p id={hintId} className="dwg-sr">
            Arraste para reorganizar. Na tela de toque, toque e segure antes de arrastar. Pelo teclado, segure Alt e
            use as setas.
          </p>
        )}
        <div
          ref={grid}
          role="list"
          className="dwg-grid"
          data-slot="widget-grid"
          style={{
            gap,
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            // células quadradas: a altura da linha é a largura da coluna
            gridAutoRows: metrics.unit ? `${Math.round(metrics.unit)}px` : `minmax(${cellSize * 0.75}px, auto)`,
          }}
        >
          {domOrder.current.map((id) => {
            const item = byId.get(id)
            const p = placementById.get(id)
            if (!item || !p) return null
            return (
              <Widget
                key={id}
                position={(visualIndex.get(id) ?? 0) + 1}
                count={placements.length}
                item={item}
                col={p.col}
                row={p.row}
                w={p.w}
                h={p.h}
                columns={columns}
                rows={rows}
                editable={editable}
                held={held === p.id}
                raised={raised === p.id}
                landed={landed === p.id}
                handlers={handlers}
                hintId={hintId}
                renderItem={renderItem as (item: never, size: WidgetSize) => ReactNode}
              />
            )
          })}
        </div>
      </div>
    </MotionConfig>
  )
}

export default DraggableWidgetGrid

const DWG_CSS = `
/* o que o projeto pode trocar com uma classe (largura, margem): na camada base, que vem antes das classes de
   componente e dos utilitários (Tailwind v4) e perde para o CSS fora de camada (Tailwind v3, CSS Modules, CSS comum) */
@layer base {
  .dwg-root { position: relative; width: 100%; }
}
.dwg-root { box-sizing: border-box; }
.dwg-grid { display: grid; box-sizing: border-box; width: 100%; }

/* o widget: quem se move e levanta. As cores saem das variáveis --dwg-*, com o tema escuro de fábrica */
.dwg-item { position: relative; box-sizing: border-box; min-width: 0; border-radius: var(--dwg-radius); outline: none; }
.dwg-item:focus-visible { outline: 2px solid var(--dwg-ring, #d4d4d8); outline-offset: 2px; }
.dwg-item a, .dwg-item img { -webkit-user-drag: none; }
.dwg-item[data-editable] {
  cursor: grab;
  touch-action: pan-y pinch-zoom;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
.dwg-item[data-editable]:active { cursor: grabbing; }

/* o cartão de dentro: o fundo, o contorno e o conteúdo */
.dwg-card {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: var(--dwg-radius);
  clip-path: inset(0 round var(--dwg-radius));
  background: var(--dwg-card, #141417);
  color: var(--dwg-card-foreground, #fafafa);
  box-shadow: inset 0 0 0 1px var(--dwg-border, #27272a);
  transition: box-shadow .3s cubic-bezier(.4, 0, .2, 1);
}
/* quem acabou de cair fica com o contorno aceso por um instante */
.dwg-card[data-landed] { box-shadow: inset 0 0 0 2px var(--dwg-landed, rgba(250, 250, 250, .4)); }

.dwg-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`
