import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useShallow } from 'zustand/shallow'
import { ROWS, COLS, type PieceType } from '@shared/types'
import { PIECE_DEFINITIONS, getPieceColor } from '@shared/engine/pieces'
import { useStaggerStore, type StaggerGap } from '../store/staggerStore'
import { useNavStore } from '../store/navStore'
import { useSettingsStore } from '../store/settingsStore'
import { useRunHistoryStore } from '../store/runHistoryStore'
import { STAGGER, gapCountForBatch, DISPLAY_ROTATION } from '../lib/staggerCurve'
import { PieceShape } from './PieceShape'
import { NeonButton, ScanlineOverlay, LivesCounter } from './ui'
import { RunHistoryGraph } from './RunHistoryGraph'

const CELL = 28
const CELL_PITCH = CELL + 2   // cell + 2px grid gap
const BOARD_PAD = 12          // p-3 around the board

// Combo chip: hold the multiplier fully visible for COMBO_HOLD_MS after the last
// streak step, then let it fade away over COMBO_FADE_MS in the signature style.
const COMBO_HOLD_MS = 2000
const COMBO_FADE_MS = 900

// Floating white labels (the per-pick "+points" and the "+N" in the earned-life
// heart) sit over bright piece/heart color. Contrast comes from a soft DOWNWARD
// drop shadow — never a hard stroke/outline (§9: shadow for legibility, and glow
// never substitutes for contrast).
const FLOAT_TEXT_SHADOW = '0 2px 5px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.95)'

/** Reveal-bloom flood color per piece type (hex of each piece's Tailwind class —
 *  I=cyan-400, O=yellow-400, T=purple-500, S=green-400, Z=red-500, J=blue-500,
 *  L=orange-400). On EASY, gaps bloom in their own piece color during reveal so
 *  the player can track shape AND color, easing the memory load. */
const PIECE_BLOOM_HEX: Record<PieceType, string> = {
  I: '#22d3ee', O: '#facc15', T: '#a855f7', S: '#4ade80', Z: '#ef4444', J: '#3b82f6', L: '#fb923c',
}

/** The uniform branded pink the reveal floods on MEDIUM (the signature Afterglow
 *  magenta — shape only, no colour crutch). */
const REVEAL_MAGENTA = '#FF2D9B'

/** A bloom instance: one tetromino lit at a single tick, with a per-cell decay
 *  DURATION that lengthens along the board diagonal (r+c) so the four cells flash
 *  together and then wink out in a wave. Each instance animates to completion
 *  CONCURRENTLY with later ones (the overlapping cascade). `color` floods the
 *  whole bloom (EASY/MEDIUM); `paint` swaps the bright color flood for HARD's
 *  self-colored graphite "impasto" surface (see .vt-paint), no color crutch. */
interface Bloom { id: number; color: string; paint: boolean; cells: { key: string; durMs: number }[] }

function bloomForGap(id: number, gap: StaggerGap, color: string, paint: boolean): Bloom {
  const cells = [...gap.cells]
    .sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[1] - b[1])
    .map(([r, c], i) => ({ key: `${r},${c}`, durMs: STAGGER.REVEAL_BLOOM_MS + i * STAGGER.REVEAL_WAVE_MS }))
  return { id, color, paint, cells }
}

/** Smoothly tween a displayed number toward `value`. Increases ease up over
 *  `durationMs` (so every banked pick — and the end-of-batch speed bonus — counts
 *  up with a little joy); a decrease (e.g. a fresh run resetting to 0) snaps. */
function useCountUp(value: number, durationMs = 600): number {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)
  const rafRef = useRef(0)
  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    const from = displayRef.current
    if (value <= from) { displayRef.current = value; setDisplay(value); return }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = Math.round(from + (value - from) * eased)
      displayRef.current = v
      setDisplay(v)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, durationMs])
  return display
}

// ── Board ─────────────────────────────────────────────────────────────────────
// The Vanishing Tiles board is the dark VOID throughout (.vt-dim) — gaps are concealed
// within one uniform near-black field, never a readable hole. A gap is only ever
// exposed by a live BLOOM: the whole tetromino's cells get .vt-bloom at the same
// tick, flood the gap's PIECE COLOR (--bloom-color; an experiment to ease the
// difficulty curve by carrying shape + color), then decay along a luminous ghost
// tail back to the void — fading away in a WAVE (each cell sets its own duration +
// delay). On HARD the bloom is .vt-paint instead: a self-colored graphite
// "impasto" surface (no bright flood) that barely lifts off the void. Filled/
// placed gaps keep their piece color (a correct pick lighting out of the dark),
// ringed with a soft glow.
function StaggerBoard({
  gaps, bloomByCell,
}: { gaps: StaggerGap[]; bloomByCell: Map<string, { id: number; durMs: number; color: string; paint: boolean }> }) {
  const colorByCell = new Map<string, PieceType>()
  gaps.forEach(g => {
    if (g.filled) g.cells.forEach(([r, c]) => colorByCell.set(`${r},${c}`, g.pieceType))
  })

  return (
    <div
      className="inline-grid gap-[2px] p-3 bg-[#04040a] rounded-xl shadow-[inset_0_2px_6px_#000,inset_0_0_0_1px_rgba(255,255,255,0.03)]"
      style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL}px)` }}
    >
      {Array.from({ length: ROWS * COLS }, (_, i) => {
        const r = Math.floor(i / COLS)
        const c = i % COLS
        const key = `${r},${c}`
        const piece = colorByCell.get(key)
        if (piece) {
          // A correct pick lighting up out of the dark — keep its piece identity,
          // add a soft glow ring. (Never recolored to lime.)
          return (
            <motion.div
              key={i}
              initial={{ scale: 0.5, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`w-7 h-7 rounded-sm ${getPieceColor(piece)} ring-1 ring-white/25 shadow-[0_0_8px_rgba(255,255,255,0.25)]`}
            />
          )
        }
        // Uniform dark void; a blooming gap's cells all flash at once then decay
        // back to the void in a wave (per-cell duration). Past blooms stay mounted
        // and keep decaying — keyed by their instance id — so they overlap.
        const bloom = bloomByCell.get(key)
        if (bloom) {
          // HARD paints in graphite (.vt-paint, self-colored); EASY/MEDIUM flood
          // the bright --bloom-color (.vt-bloom).
          return (
            <div
              key={`${i}-bloom-${bloom.id}`}
              className={`w-7 h-7 rounded-sm ${bloom.paint ? 'vt-paint' : 'vt-bloom'}`}
              style={{
                animationDuration: `${bloom.durMs}ms`,
                ...(bloom.paint ? {} : { ['--bloom-color']: bloom.color }),
              } as CSSProperties}
            />
          )
        }
        return <div key={i} className="w-7 h-7 rounded-sm vt-dim" />
      })}
    </div>
  )
}

// ── Countdown ───────────────────────────────────────────────────────────────
// Each number burns bright the instant it appears, then dissipates (Afterglow
// Smear: blurs + swells + fades to nothing) over the beat, just as the next
// number takes its place. The CSS animation length (.vt-num-decay, 850ms) is
// kept in lockstep with BEAT_MS.
const BEAT_MS = 850
function StaggerCountdown({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(3)
  useEffect(() => {
    if (count <= 0) {
      const t = window.setTimeout(onDone, 350)
      return () => clearTimeout(t)
    }
    const t = window.setTimeout(() => setCount(c => c - 1), BEAT_MS)
    return () => clearTimeout(t)
  }, [count, onDone])
  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      {count > 0 && (
        <span
          key={count}
          className="absolute vt-num-decay font-silk font-black leading-none text-vt-cyan text-[6rem]"
        >
          {count}
        </span>
      )}
    </div>
  )
}

// ── Piece tray ────────────────────────────────────────────────────────────────
function PieceTray({ onPick, disabled }: { onPick: (t: PieceType) => void; disabled: boolean }) {
  return (
    <div className="w-full max-w-sm rounded-xl p-3 bg-vt-panel border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex justify-between items-center mb-2 pointer-events-none select-none">
        <span className="font-silk text-[10px] tracking-[0.15em] uppercase text-vt-cyan text-glow-vt-cyan">Pieces</span>
        <span className="text-[10px] text-vt-dim tracking-[0.04em]">tap to place from memory</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {PIECE_DEFINITIONS.map(def => (
          <button
            key={def.type}
            data-piece-option={def.type}
            disabled={disabled}
            onClick={() => onPick(def.type as PieceType)}
            className="flex items-center justify-center h-12 p-1 rounded-md border bg-vt-raised
              border-vt-cyan/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]
              hover:border-vt-cyan hover:shadow-vt-cyan cursor-pointer transition
              disabled:opacity-40 disabled:pointer-events-none"
          >
            <PieceShape pieceType={def.type as PieceType} rotation={DISPLAY_ROTATION[def.type]} cellSize={8} />
          </button>
        ))}
      </div>
    </div>
  )
}

// ── HUD ─────────────────────────────────────────────────────────────────────

// ── Screen ────────────────────────────────────────────────────────────────────
export function StaggerScreen() {
  const {
    phase, batchIndex, gaps, score, lives, selectDuration, selectStartTime, paused,
    shapesRecalled, currentCombo, bestCombo, totalPicks, correctPicks,
    startRun, beginReveal, beginSelecting, pickPiece, advanceBatch, timeoutBatch,
    pause, resume, exit,
  } = useStaggerStore(useShallow(s => ({
    phase: s.phase, batchIndex: s.batchIndex, gaps: s.gaps, score: s.score,
    lives: s.lives, selectDuration: s.selectDuration, selectStartTime: s.selectStartTime, paused: s.paused,
    shapesRecalled: s.shapesRecalled, currentCombo: s.currentCombo, bestCombo: s.bestCombo, totalPicks: s.totalPicks, correctPicks: s.correctPicks,
    startRun: s.startRun, beginReveal: s.beginReveal, beginSelecting: s.beginSelecting,
    pickPiece: s.pickPiece, advanceBatch: s.advanceBatch, timeoutBatch: s.timeoutBatch,
    pause: s.pause, resume: s.resume, exit: s.exit,
  })))
  const goHome = useNavStore(s => s.goHome)
  const difficulty = useSettingsStore(s => s.settings.difficulty)

  const { records, recordRun } = useRunHistoryStore(useShallow(s => ({ records: s.records, recordRun: s.recordRun })))

  // Once-per-game-over run recording (guard ref prevents double-fire under StrictMode).
  const recordedRef = useRef(false)
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)

  useEffect(() => {
    if (phase === 'gameOver' && !recordedRef.current) {
      recordedRef.current = true
      const accuracy = totalPicks ? Math.round((correctPicks / totalPicks) * 100) : 0
      const run = recordRun({ score, recalled: shapesRecalled, combo: bestCombo, accuracy })
      setCurrentRunId(run.id)
    } else if (phase !== 'gameOver') {
      recordedRef.current = false
      setCurrentRunId(null)
    }
  }, [phase, score, shapesRecalled, bestCombo, totalPicks, correctPicks, recordRun])

  const [blooms, setBlooms] = useState<Bloom[]>([])
  const [barPct, setBarPct] = useState(0)
  const [barColor, setBarColor] = useState<'magenta' | 'amber' | 'lime'>('magenta')
  const [barTransition, setBarTransition] = useState('width 180ms ease-out')
  const [clockMs, setClockMs] = useState(0)
  const [xMark, setXMark] = useState(false)
  const [cleared, setCleared] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // Smoothly counted-up score: every banked pick (and the end-of-batch speed
  // bonus) ticks the displayed number up rather than snapping.
  const displayScore = useCountUp(score)

  // Combo: a streak of correct recalls (tracked in the store). Each correct pick
  // floats the "+points" it earned over the just-filled gap; the running ×N
  // multiplier shows as a chip above the board.
  const [combos, setCombos] = useState<{ id: number; pts: number; x: number; y: number }[]>([])
  const comboId = useRef(0)

  // Combo chip lifecycle: a fresh streak step pops the chip in and holds it for
  // COMBO_HOLD_MS, then it fades out in our signature fade style (vt-fade-away:
  // hold → opacity/blur to nothing) and unmounts. Each new step re-arms the hold,
  // so the chip lingers a beat after the last correct pick. A broken streak
  // (currentCombo < 3) clears it immediately — the streak shattered.
  const [comboChip, setComboChip] = useState<{ value: number; fading: boolean } | null>(null)
  const comboTimers = useRef<number[]>([])
  useEffect(() => {
    comboTimers.current.forEach(clearTimeout)
    comboTimers.current = []
    if (currentCombo >= 3) {
      setComboChip({ value: currentCombo, fading: false })
      comboTimers.current.push(window.setTimeout(
        () => setComboChip(c => (c ? { ...c, fading: true } : c)), COMBO_HOLD_MS))
      comboTimers.current.push(window.setTimeout(
        () => setComboChip(null), COMBO_HOLD_MS + COMBO_FADE_MS))
    } else {
      setComboChip(null)
    }
    return () => { comboTimers.current.forEach(clearTimeout); comboTimers.current = [] }
  }, [currentCombo])

  // Earn-a-life: when the shared life pool grows mid-run (every 5000 pts), pop a
  // celebratory heart burst over the board.
  const [lifeBursts, setLifeBursts] = useState<{ id: number; n: number }[]>([])
  const lifeBurstId = useRef(0)
  const prevLives = useRef(lives)
  useEffect(() => {
    const delta = lives - prevLives.current
    if (phase === 'selecting' && delta > 0) {
      const id = (lifeBurstId.current += 1)
      setLifeBursts(prev => [...prev, { id, n: delta }])
      window.setTimeout(() => setLifeBursts(prev => prev.filter(b => b.id !== id)), 1500)
    }
    prevLives.current = lives
  }, [lives, phase])

  // A fresh run / game over / a broken board clears any lingering bursts.
  useEffect(() => {
    if (phase === 'countdown' || phase === 'gameOver' || phase === 'idle') {
      setCombos([])
      setComboChip(null)
    }
  }, [phase])

  // Reveal driver (shape-bloom): bloom each gap as a WHOLE tetromino — all its
  // cells get .vt-bloom at the same tick, flood magenta, then decay along a
  // ghost tail back to the void (fading away in a per-cell wave). Decays cascade
  // (the next shape blooms before the last finishes dying), draining the bar one
  // step per gap as a COUNT, then hand off to selecting. Because .vt-bloom
  // forwards-fills back to the void, past gaps leave no readable hole.
  useEffect(() => {
    if (phase !== 'reveal' || gaps.length === 0) return
    let cancelled = false
    const timers: number[] = []
    const n = gaps.length
    // Difficulty shapes the reveal: EASY floods each gap in its own piece colour;
    // MEDIUM floods the uniform branded pink; HARD paints in graphite "impasto"
    // (self-colored, no bright flood) so the murky low-contrast tiles are the
    // whole challenge. All tiers play at the same (normal) reveal speed.
    const paint = difficulty === 'hard'
    const colorFor = (gap: StaggerGap) =>
      difficulty === 'easy' ? PIECE_BLOOM_HEX[gap.pieceType] : REVEAL_MAGENTA
    // Step between piece flashes. The bloom out-runs this step, so the next piece
    // flashes while the previous is still decaying — the overlapping cascade.
    const step = STAGGER.REVEAL_STEP_MS
    // How long one bloom lives on screen: its longest-wave cell, plus a hair.
    const lifetime = STAGGER.REVEAL_BLOOM_MS + 3 * STAGGER.REVEAL_WAVE_MS + 80
    // Memorize bar DRAINS: starts full and empties one step per gap as the
    // sequence plays out (a visual count of memorize time spent).
    setBarColor('magenta'); setBarTransition('width 180ms ease-out'); setBarPct(100)
    setBlooms([])
    let id = 0

    const show = (idx: number) => {
      if (cancelled) return
      if (idx >= n) {
        // Let the final piece finish its decay before recall lights-out.
        timers.push(window.setTimeout(beginSelecting, Math.max(0, STAGGER.REVEAL_BLOOM_MS - step)))
        return
      }
      const myId = ++id
      // Add a fresh bloom that runs CONCURRENTLY with earlier still-decaying ones
      // (the overlap), and self-removes once its full decay completes.
      setBlooms(prev => [...prev, bloomForGap(myId, gaps[idx], colorFor(gaps[idx]), paint)])
      setBarPct((1 - (idx + 1) / n) * 100)
      timers.push(window.setTimeout(() => {
        if (!cancelled) setBlooms(prev => prev.filter(b => b.id !== myId))
      }, lifetime))
      timers.push(window.setTimeout(() => show(idx + 1), step))
    }
    // A short breath before the first gap (also paces continuous next batches).
    timers.push(window.setTimeout(() => show(0), 350))
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [phase, batchIndex, gaps, beginSelecting, difficulty])

  // Selecting expiry: end the batch when the select clock runs out (lives are the
  // only fail condition). Paused → freeze: the effect tears down and re-arms when
  // `resume` re-dates selectStartTime.
  useEffect(() => {
    if (phase !== 'selecting' || paused) return
    let cancelled = false
    setCleared(false)
    const remaining = Math.max(0, selectStartTime + selectDuration - Date.now())
    const expiry = window.setTimeout(() => {
      if (cancelled) return
      // A cleared batch is handled by the clear beat; only a genuinely-unfinished
      // batch reaches here, and running out of time costs a life.
      if (!useStaggerStore.getState().gaps.every(g => g.filled)) timeoutBatch()
    }, remaining)
    return () => { cancelled = true; clearTimeout(expiry) }
  }, [phase, paused, batchIndex, selectStartTime, selectDuration, timeoutBatch])

  // Recall clock + bar drain: tick the remaining time every 100ms, draining the
  // amber bar and feeding the in-bar seconds off the SAME live clock (so the bar
  // and the temperature arc track real time, not a fragile CSS-only transition).
  // Bails while cleared so onPick's lime payoff drain isn't overwritten.
  useEffect(() => {
    if (phase !== 'selecting' || paused || cleared) return
    setBarColor('amber'); setBarTransition('width 120ms linear')
    const tick = () => {
      const rem = Math.max(0, selectStartTime + selectDuration - Date.now())
      setClockMs(rem)
      setBarPct(selectDuration > 0 ? (rem / selectDuration) * 100 : 0)
    }
    tick()
    const id = window.setInterval(tick, 100)
    return () => clearInterval(id)
  }, [phase, paused, cleared, selectStartTime, selectDuration])

  const onPick = (type: PieceType) => {
    if (cleared || paused) return
    const res = pickPiece(type)
    if (res.gameOver) return
    if (!res.ok) {
      setXMark(true)
      boardRef.current?.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' },
         { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
        { duration: 240 },
      )
      window.setTimeout(() => setXMark(false), 440)
      return
    }
    // Correct recall. Float the "+points" earned (base × combo) over the filled
    // gap; the running ×N multiplier lives in the chip by the score.
    if (res.gap) {
      const cells = res.gap.cells
      const avgR = cells.reduce((a, [r]) => a + r, 0) / cells.length
      const avgC = cells.reduce((a, [, c]) => a + c, 0) / cells.length
      const x = BOARD_PAD + avgC * CELL_PITCH + CELL / 2
      const y = BOARD_PAD + avgR * CELL_PITCH + CELL / 2
      const id = (comboId.current += 1)
      setCombos(prev => [...prev, { id, pts: res.gained, x, y }])
      window.setTimeout(() => setCombos(prev => prev.filter(p => p.id !== id)), 700)
    }
    if (res.batchCleared) {
      setCleared(true)
      // Freeze the green bar where it currently sits, then — after a quick beat —
      // visibly rush it down to empty. The leftover-time speed bonus is already
      // banked, so the score count-up rises as the bar drains: time → points.
      const el = barRef.current, parent = el?.parentElement
      const frozenPct = el && parent
        ? (el.getBoundingClientRect().width / parent.getBoundingClientRect().width) * 100
        : barPct
      setBarColor('lime'); setBarTransition('none'); setBarPct(frozenPct)
      // A relaxed, savor-it drain — fast enough to feel like a reward, slow
      // enough to enjoy the leftover time pouring into the score. The bar goes
      // lime for the exhale (amber→lime payoff arc).
      window.setTimeout(() => { setBarTransition('width 1400ms cubic-bezier(0.33,1,0.68,1)'); setBarPct(0) }, 220)
      window.setTimeout(() => { setCleared(false); advanceBatch() }, 1900)
    }
  }

  if (phase === 'idle') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center vt-vignette select-none">
        <NeonButton variant="primary" onClick={startRun}>Start Staggered Vanishing Tiles</NeonButton>
      </div>
    )
  }

  // All currently-animating bloom cells (every active instance, so past pieces
  // keep decaying while new ones flash). Empty outside reveal → board stays dark.
  const bloomByCell = new Map<string, { id: number; durMs: number; color: string; paint: boolean }>()
  if (phase === 'reveal') {
    for (const b of blooms) for (const cell of b.cells) bloomByCell.set(cell.key, { id: b.id, durMs: cell.durMs, color: b.color, paint: b.paint })
  }
  const phaseLabel =
    phase === 'reveal' ? 'MEMORIZE' :
    phase === 'selecting' ? (cleared ? 'CLEAR!' : 'RECALL') : ''

  // Timer-bar phase color (the §1 temperature arc): magenta filling on reveal,
  // amber draining on recall, red pulse under 25% as the clock heats up, lime on
  // the clear-payoff drain.
  // "Low" tracks real remaining time (not the bar's width state), so the bar +
  // label only heat to red in the final quarter of the recall clock.
  const barLow = barColor === 'amber' && !cleared && selectDuration > 0 && clockMs / selectDuration < 0.25
  const barClass =
    barColor === 'magenta' ? 'bg-vt-magenta shadow-vt-magenta' :
    barColor === 'lime' ? 'bg-vt-lime shadow-vt-lime' :
    barLow ? 'bg-vt-red shadow-vt-red animate-[redpulse_0.5s_cubic-bezier(0.7,0,0.3,1)_infinite]' :
    'bg-vt-amber shadow-vt-amber'

  // Phase label color tracks the bar's temperature (magenta → amber → red → lime).
  const phaseLabelClass =
    phase === 'reveal' ? 'text-vt-magenta text-glow-vt-magenta' :
    cleared ? 'text-vt-lime text-glow-vt-lime' :
    barLow ? 'text-vt-red text-glow-vt-red' :
    phase === 'selecting' ? 'text-vt-amber text-glow-vt-amber' :
    'text-vt-dim'

  // Countdown subtitle: the selected tier on the heat arc (green/amber/red).
  const modeLabel = `${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)} Mode`
  const modeColor =
    difficulty === 'easy' ? 'text-vt-lime text-glow-vt-lime' :
    difficulty === 'hard' ? 'text-vt-red text-glow-vt-red' :
    'text-vt-amber text-glow-vt-amber'

  return (
    <div className="min-h-screen flex flex-col items-center vt-vignette text-vt-text px-4 pt-12 pb-8 select-none">
      {/* HUD + timer — hidden at game over (the summary covers score; lives/shapes are moot) */}
      {phase !== 'gameOver' && (
        <>
          <div className="w-full max-w-sm flex items-end justify-between mb-2 pointer-events-none">
            {/* Phase count sits ABOVE the score; the score is the loudest text on
                screen and stands on its own — no label. */}
            <div>
              <div className="mb-0.5 font-grotesk text-[10px] tracking-[0.14em] uppercase text-vt-cyan">Phase {batchIndex + 1}</div>
              <div className="font-silk font-bold text-3xl text-vt-cyan text-glow-vt-cyan leading-none tabular-nums">{displayScore}</div>
            </div>
            <div className="text-right">
              <LivesCounter lives={lives} cap={STAGGER.START_LIVES} />
              <div className="mt-1.5 font-grotesk font-semibold text-sm text-vt-text tabular-nums">
                {gaps.filter(g => g.filled).length} / {gaps.length || gapCountForBatch(batchIndex)}
                <span className="font-grotesk text-[10px] text-vt-dim ml-1.5 tracking-[0.12em] uppercase">items</span>
              </div>
            </div>
          </div>

          {/* Timer / count bar — phase-colored (magenta → amber → red → lime). */}
          <div className="w-full max-w-sm h-2 rounded-full bg-black overflow-hidden mb-2 shadow-[inset_0_1px_2px_#000]">
            <div
              ref={barRef}
              className={`h-full rounded-full ${barClass}`}
              style={{ width: `${barPct}%`, transition: barTransition }}
            />
          </div>

          {/* Phase label (centered) above the grid; the running COMBO multiplier
              rides the right of this row — labeled, so it never reads as score×N.
              It pops in on each streak step, holds, then fades in the signature
              style (see comboChip lifecycle above). */}
          <div className="relative w-full max-w-sm h-4 mt-1 mb-2 pointer-events-none">
            <div className={`text-center font-grotesk text-[11px] tracking-[0.22em] uppercase transition-colors ${phaseLabelClass}`}>{phaseLabel}</div>
            {comboChip && (
              <span
                key={comboChip.fading ? `fade-${comboChip.value}` : comboChip.value}
                className={`absolute right-0 top-1/2 -translate-y-1/2 font-silk font-bold text-[11px] tracking-[0.1em] text-vt-lime text-glow-vt-lime whitespace-nowrap ${comboChip.fading ? 'vt-fade-away' : 'combo-pop'}`}
                style={comboChip.fading ? { animationDuration: `${COMBO_FADE_MS}ms` } : undefined}
              >
                COMBO ×{comboChip.value}
              </span>
            )}
          </div>
        </>
      )}

      {/* Board + overlays */}
      <div className="relative">
        <div ref={boardRef}>
          <StaggerBoard gaps={gaps} bloomByCell={bloomByCell} />
        </div>

        {/* Combo bursts — a "Combo N" flourish floats up from each filled gap. */}
        <AnimatePresence>
          {combos.map(cb => (
            <motion.div
              key={cb.id}
              initial={{ opacity: 0, scale: 0.4, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: -22 }}
              exit={{ opacity: 0, scale: 1.5, y: -46 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2
                font-silk font-bold text-sm whitespace-nowrap text-white"
              style={{
                left: cb.x,
                top: cb.y,
                // White lifted off any piece color by a soft drop shadow (not a
                // stroke) so it stays legible without an outline.
                textShadow: FLOAT_TEXT_SHADOW,
              }}
            >
              +{cb.pts}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Earn-a-life celebration — a heart blooms and rises off the board. */}
        <AnimatePresence>
          {lifeBursts.map(lb => (
            <motion.div
              key={lb.id}
              initial={{ opacity: 0, scale: 0.3, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: -6 }}
              exit={{ opacity: 0, scale: 1.7, y: -52 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
            >
              <span className="relative flex items-center justify-center">
                <span className="text-7xl leading-none text-vt-red text-glow-vt-red">♥</span>
                <span
                  className="absolute -translate-y-[3px] font-silk font-bold text-lg text-white"
                  style={{ textShadow: FLOAT_TEXT_SHADOW }}
                >
                  +{lb.n}
                </span>
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {phase === 'countdown' && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-vt-void pointer-events-none">
            <div className="flex flex-col items-center gap-1 mb-2">
              <div className="font-silk text-base text-vt-cyan text-glow-vt-cyan uppercase tracking-[0.12em]">Vanishing Tiles</div>
              <div className={`font-grotesk text-[11px] uppercase tracking-[0.22em] ${modeColor}`}>{modeLabel}</div>
            </div>
            <StaggerCountdown onDone={beginReveal} />
          </div>
        )}

        {/* Wrong pick: a red border flashes around the board (with the shake). */}
        <AnimatePresence>
          {xMark && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute inset-0 rounded-xl pointer-events-none shadow-[inset_0_0_0_2px_#FF3B47,0_0_24px_rgba(255,59,71,0.28)]"
            />
          )}
        </AnimatePresence>

        {phase === 'gameOver' && (
          <div className="fixed inset-0 z-40 flex flex-col items-center bg-vt-void overflow-y-auto px-6 py-10">
            <ScanlineOverlay />
            <div className="font-silk text-base text-vt-text uppercase tracking-[0.15em] mb-1.5">Game Over</div>
            <div className="font-grotesk text-[11px] tracking-[0.18em] uppercase text-vt-magenta text-glow-vt-magenta mb-5 vt-fade-away">Memory Fades</div>
            <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Final score</div>
            <div className="font-silk font-bold text-4xl text-vt-amber text-glow-vt-amber mb-6 tabular-nums">{score}</div>

            {/* Run-stats trio — items recalled / best combo / accuracy. */}
            <div className="flex w-full max-w-[300px] border-y border-white/10 mb-6">
              <div className="flex-1 text-center py-3.5">
                <div className="font-silk font-bold text-base text-vt-magenta text-glow-vt-magenta tabular-nums">{shapesRecalled}</div>
                <div className="font-grotesk text-[9px] tracking-[0.1em] uppercase text-vt-faint mt-1.5">Items recalled</div>
              </div>
              <div className="flex-1 text-center py-3.5 border-x border-white/10">
                <div className="font-silk font-bold text-base text-vt-lime text-glow-vt-lime tabular-nums">{bestCombo > 0 ? `×${bestCombo}` : 'N/A'}</div>
                <div className="font-grotesk text-[9px] tracking-[0.1em] uppercase text-vt-faint mt-1.5">Best combo</div>
              </div>
              <div className="flex-1 text-center py-3.5">
                <div className="font-silk font-bold text-base text-vt-cyan text-glow-vt-cyan tabular-nums">
                  {totalPicks === 0 ? 0 : Math.round((correctPicks / totalPicks) * 100)}%
                </div>
                <div className="font-grotesk text-[9px] tracking-[0.1em] uppercase text-vt-faint mt-1.5">Accuracy</div>
              </div>
            </div>

            {currentRunId && (
              <div className="w-full max-w-[300px] mb-6 pointer-events-auto">
                <RunHistoryGraph records={records} currentId={currentRunId} />
              </div>
            )}

            <div className="flex flex-col gap-3 w-44 pointer-events-auto">
              <NeonButton variant="primary" fullWidth onClick={startRun}>Play again</NeonButton>
              <NeonButton variant="ghost" fullWidth onClick={() => { exit(); goHome() }}>Home</NeonButton>
            </div>
          </div>
        )}
      </div>

      {/* Tray */}
      <div className="mt-4 min-h-[88px] w-full flex justify-center">
        {phase === 'selecting' && <PieceTray onPick={onPick} disabled={cleared || paused} />}
      </div>

      {/* Pause — freeze the run (full width). (Replay-the-sequence was removed:
          replaying after picks left correct pieces on the board, a confusing
          experience to be redesigned later.) */}
      {phase === 'selecting' && (
        <div className="mt-3 w-full max-w-sm">
          <button
            aria-label="Pause"
            disabled={cleared}
            onClick={() => pause()}
            className="w-full flex items-center justify-center gap-2 rounded-md border-2 bg-vt-raised py-3 px-4 text-sm font-grotesk font-semibold uppercase tracking-[0.1em]
              border-vt-cyan text-vt-cyan hover:bg-vt-cyan/10 hover:shadow-vt-cyan
              transition active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
          >
            <span className="flex gap-[3px]">
              <span className="block w-[3px] h-3.5 rounded-sm bg-current" />
              <span className="block w-[3px] h-3.5 rounded-sm bg-current" />
            </span>
            Pause
          </button>
        </div>
      )}

      {/* Hard pause — covers the whole screen so no memorizing happens while
          frozen; resume picks the clock back up, exit bails to the landing page. */}
      {paused && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8
          bg-vt-void text-vt-text px-6">
          <ScanlineOverlay />
          <div className="font-silk text-lg text-vt-cyan text-glow-vt-cyan uppercase tracking-[0.2em]">Paused</div>
          <div className="flex flex-col gap-3 w-52">
            <NeonButton variant="primary" fullWidth onClick={() => resume()}>Resume</NeonButton>
            <NeonButton variant="danger" fullWidth onClick={() => { exit(); goHome() }}>Exit to Home</NeonButton>
          </div>
        </div>
      )}
    </div>
  )
}
