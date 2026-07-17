import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useShallow } from 'zustand/shallow'
import { ROWS, COLS, type PieceType } from '@shared/types'
import { PIECE_DEFINITIONS, getPieceColor } from '@shared/engine/pieces'
import { useStaggerStore, type StaggerGap } from '../store/staggerStore'
import { useNavStore } from '../store/navStore'
import { useSettingsStore } from '../store/settingsStore'
import { useRunHistoryStore } from '../store/runHistoryStore'
import { STAGGER, CLOCK_URGENT, gapCountForBatch, urgentHeat, urgentTickIntervalMs, DISPLAY_ROTATION } from '../lib/staggerCurve'
import { submitStaggerRun } from '../lib/api'
import { sfx } from '../lib/sfx'
import { PieceShape } from './PieceShape'
import { NeonButton, ScanlineOverlay, LivesCounter, PauseOverlay } from './ui'
import { RunHistoryGraph } from './RunHistoryGraph'

const CELL = 28
const CELL_PITCH = CELL + 2   // cell + 2px grid gap
const BOARD_PAD = 12          // p-3 around the board

// Streak chip: hold the multiplier fully visible for STREAK_HOLD_MS after the last
// streak step, then let it fade away over STREAK_FADE_MS in the signature style.
const STREAK_HOLD_MS = 2000
const STREAK_FADE_MS = 900

// Time → score "Lift" payoff (the cleared-batch animation): after a short
// anticipation BEAT the timer bar rushes to empty over LIFT_MS while a single
// big "+bonus" lifts off the bar and dissolves into the score, and the score
// counts up by exactly that bonus over the SAME window — remaining time visibly
// turning into points.
const LIFT_BEAT_MS = 260
const LIFT_MS = 1300

// Hard-mode out-of-order hint: on a right-shape-wrong-order miss the PHASE LABEL
// (the central MEMORIZE/RECALL/CLEAR! line above the grid) swaps to "IN ORDER",
// runs the two-pulse white↔magenta blink (700ms, .vt-order-flash in index.css),
// then holds magenta for the rest of this window before reverting to RECALL.
const ORDER_HINT_MS = 1500

// Floating white labels (the per-pick "+points" and the "+N" in the earned-life
// heart) sit over bright piece/heart color. Contrast comes from a soft DOWNWARD
// drop shadow — never a hard stroke/outline (§9: shadow for legibility, and glow
// never substitutes for contrast).
const FLOAT_TEXT_SHADOW = '0 2px 5px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.95)'

/** Reveal-bloom flood color per piece type (hex of each piece's Tailwind class —
 *  I=cyan-400, O=yellow-400, T=purple-500, S=green-400, Z=red-500, J=blue-500,
 *  L=orange-400). On EASY, gaps bloom in their own piece color during reveal
 *  so the player can track shape AND color, easing the memory load. The recall
 *  tray always uses these same piece colors, in every mode. */
const PIECE_BLOOM_HEX: Record<PieceType, string> = {
  I: '#22d3ee', O: '#facc15', T: '#a855f7', S: '#4ade80', Z: '#ef4444', J: '#3b82f6', L: '#fb923c',
}

/** The uniform branded pink the reveal floods on MEDIUM and HARD (the signature
 *  Afterglow magenta — shape only, no colour crutch). The recall tray always
 *  shows each piece's own color, in every mode. */
const REVEAL_MAGENTA = '#FF2D9B'

/** A bloom instance: one tetromino lit at a single tick, with a per-cell decay
 *  DURATION that lengthens along the board diagonal (r+c) so the four cells flash
 *  together and then wink out in a wave. Each instance animates to completion
 *  CONCURRENTLY with later ones (the overlapping cascade). `color` floods the
 *  whole bloom (EASY in piece color, MEDIUM/HARD in the branded magenta). */
interface Bloom { id: number; color: string; cells: { key: string; holdMs: number; decayMs: number }[] }

function bloomForGap(
  id: number, gap: StaggerGap, color: string, bloomMs: number, decayMs: number, waveMs: number,
): Bloom {
  const cells = [...gap.cells]
    .sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[1] - b[1])
    .map(([r, c], i) => ({ key: `${r},${c}`, holdMs: bloomMs, decayMs: decayMs + i * waveMs }))
  return { id, color, cells }
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
// tick, flood a color (the gap's PIECE COLOR on EASY, the branded magenta on
// MEDIUM/HARD via --bloom-color), then decay along a luminous ghost tail back to the
// void — fading away in a WAVE (each cell sets its own duration + delay). Filled/
// placed gaps keep their piece color (a correct pick lighting out of the dark),
// ringed with a soft glow.
function StaggerBoard({
  gaps, bloomByCell,
}: {
  gaps: StaggerGap[]
  bloomByCell: Map<string, { id: number; holdMs: number; decayMs: number; color: string }>
}) {
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
          // Every tier floods --bloom-color (.vt-bloom) — piece color on
          // EASY, the branded magenta on MEDIUM/HARD.
          return (
            <div
              key={`${i}-bloom-${bloom.id}`}
              className="w-7 h-7 rounded-sm vt-bloom"
              style={{
                animationDuration: `${bloom.holdMs}ms, ${bloom.decayMs}ms`,
                animationDelay: `0ms, ${bloom.holdMs}ms`,
                ['--bloom-color']: bloom.color,
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
// Each number burns bright the instant it appears, holds at full strength for
// ~72% of its beat, then dissipates (Afterglow Smear: blurs + swells + fades
// to nothing) in the final stretch, just as the next number takes its place.
// The CSS animation length (.vt-num-decay, 850ms) is kept in lockstep with
// BEAT_MS.
//
// The countdown is anchored OVER the board/grid (not a full-screen void) so
// the player sees the mode's frame before the gaps reveal: the mode label
// sits just above the 3·2·1. Fires at run start.
const BEAT_MS = 850
function StaggerCountdown({
  modeLabel, modeColor, onDone,
}: { modeLabel: string; modeColor: string; onDone: () => void }) {
  const [count, setCount] = useState(3)
  useEffect(() => {
    if (count <= 0) {
      // The fourth beat: 3 · 2 · 1 · GO — the decisive note the countdown
      // resolves into, right as the reveal takes over.
      sfx.go()
      const t = window.setTimeout(onDone, 350)
      return () => clearTimeout(t)
    }
    sfx.count()
    const t = window.setTimeout(() => setCount(c => c - 1), BEAT_MS)
    return () => clearTimeout(t)
  }, [count, onDone])
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl bg-black/70 backdrop-blur-[2px] pointer-events-none">
      <div className={`font-grotesk text-[11px] uppercase tracking-[0.22em] mb-2 ${modeColor}`}>{modeLabel}</div>
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
    </div>
  )
}

// ── Piece tray ────────────────────────────────────────────────────────────────
// The recall tray always shows each piece's own color, in every mode
// (PieceShape's default) — the monochrome-pink tray treatment is reveal-only.
function PieceTray({
  onPick, disabled, demoTarget, demoWrong,
}: {
  onPick: (t: PieceType) => void
  disabled: boolean
  /** Demo guidance (T3): while set, the target button wears the spotlight ring +
   *  TAP cue and every other button drops behind the "veil" (dimmed, still
   *  tappable — a wrong tap gets the gentle correction, not a disable). */
  demoTarget?: PieceType | null
  demoWrong?: PieceType | null
}) {
  return (
    <div className="w-full max-w-sm rounded-xl p-3 bg-vt-panel border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className={`flex justify-between items-center mb-2 pointer-events-none select-none${demoTarget ? ' opacity-40' : ''}`}>
        <span className="font-silk text-[10px] tracking-[0.15em] uppercase text-vt-cyan text-glow-vt-cyan">Pieces</span>
        <span className="text-[10px] text-vt-dim tracking-[0.04em]">tap to place from memory</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {PIECE_DEFINITIONS.map(def => {
          const isTarget = demoTarget === def.type
          const demoClass = !demoTarget ? ''
            : isTarget ? ' vt-demo-spot border-vt-cyan relative z-30'
            : demoWrong === def.type ? ' vt-demo-shake'
            : ' opacity-25 saturate-50'
          return (
            <button
              key={def.type}
              data-piece-option={def.type}
              disabled={disabled}
              onClick={() => onPick(def.type as PieceType)}
              className={`relative flex items-center justify-center h-12 p-1 rounded-md border bg-vt-raised
                border-vt-cyan/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]
                hover:border-vt-cyan hover:shadow-vt-cyan cursor-pointer transition
                disabled:opacity-40 disabled:pointer-events-none${demoClass}`}
            >
              {isTarget && (
                <span className="vt-demo-tapcue absolute left-1/2 bottom-[calc(100%-10px)] z-40 flex flex-col items-center pointer-events-none">
                  <span className="font-silk text-[8px] tracking-[0.1em] text-white" style={{ textShadow: FLOAT_TEXT_SHADOW }}>TAP</span>
                  <span className="mt-px w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]" />
                </span>
              )}
              <PieceShape pieceType={def.type as PieceType} rotation={DISPLAY_ROTATION[def.type]} cellSize={8} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── HUD ─────────────────────────────────────────────────────────────────────

// ── Screen ────────────────────────────────────────────────────────────────────
export function StaggerScreen() {
  const {
    phase, demo, mode, batchIndex, gaps, revealPlan, score, lives, selectDuration, selectStartTime, paused,
    shapesRecalled, currentStreak, bestStreak, totalPicks, correctPicks,
    startRun, beginRunFromDemo, beginReveal, beginSelecting, pickPiece, bankSpeedBonus, advanceBatch, timeoutBatch,
    pause, resume, exit,
  } = useStaggerStore(useShallow(s => ({
    phase: s.phase, demo: s.demo, mode: s.mode, batchIndex: s.batchIndex, gaps: s.gaps, revealPlan: s.revealPlan, score: s.score,
    lives: s.lives, selectDuration: s.selectDuration, selectStartTime: s.selectStartTime, paused: s.paused,
    // "Streak" is player-facing copy only — the underlying store fields are still `currentCombo`/`bestCombo`.
    shapesRecalled: s.shapesRecalled, currentStreak: s.currentCombo, bestStreak: s.bestCombo, totalPicks: s.totalPicks, correctPicks: s.correctPicks,
    startRun: s.startRun, beginRunFromDemo: s.beginRunFromDemo, beginReveal: s.beginReveal, beginSelecting: s.beginSelecting,
    pickPiece: s.pickPiece, bankSpeedBonus: s.bankSpeedBonus, advanceBatch: s.advanceBatch, timeoutBatch: s.timeoutBatch,
    pause: s.pause, resume: s.resume, exit: s.exit,
  })))
  const goHome = useNavStore(s => s.goHome)
  const goLeaderboard = useNavStore(s => s.goLeaderboard)
  const { hideDemo, setHideDemo } = useSettingsStore(useShallow(s => ({ hideDemo: s.settings.hideDemo, setHideDemo: s.setHideDemo })))

  // Demo-only UI state: the gentle-correction piece (soft headshake + coach
  // line, no red/shake/life) and the end beat ("You're ready" + opt-out).
  const [demoWrong, setDemoWrong] = useState<PieceType | null>(null)
  const [demoDone, setDemoDone] = useState(false)
  const demoWrongTimer = useRef<number | undefined>(undefined)

  // Reveal/decay timing for this run — the STAGGER constants. Held in a ref so
  // the reveal driver reads the LATEST values as each beat fires without
  // re-arming the whole effect and flickering.
  const timing = {
    stepMs: STAGGER.REVEAL_STEP_MS,
    bloomMs: STAGGER.REVEAL_BLOOM_MS,
    decayMs: STAGGER.REVEAL_DECAY_MS,
    waveMs: STAGGER.REVEAL_WAVE_MS,
  }
  const timingRef = useRef(timing)
  timingRef.current = timing

  const { records, recordRun } = useRunHistoryStore(useShallow(s => ({ records: s.records, recordRun: s.recordRun })))

  // Once-per-game-over run recording (guard ref prevents double-fire under StrictMode).
  const recordedRef = useRef(false)
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)

  useEffect(() => {
    if (phase === 'gameOver' && !recordedRef.current) {
      recordedRef.current = true
      // The run's farewell (rides the same once-per-game-over guard as the
      // recording, so StrictMode never plays it twice).
      sfx.gameOver()
      const accuracy = totalPicks ? Math.round((correctPicks / totalPicks) * 100) : 0
      const run = recordRun({ mode, score, recalled: shapesRecalled, combo: bestStreak, accuracy })
      setCurrentRunId(run.id)
      // Server-side per-(user, mode) stats — fire-and-forget so a network
      // failure never blocks the game-over screen (localStorage above is the
      // source of truth for the graph).
      submitStaggerRun({ mode, score, bestStreak, accuracy, gapsRecalled: shapesRecalled })
        .catch((err) => console.warn('Failed to record stagger run server-side', err))
    } else if (phase !== 'gameOver') {
      recordedRef.current = false
      setCurrentRunId(null)
    }
  }, [phase, mode, score, shapesRecalled, bestStreak, totalPicks, correctPicks, recordRun])

  const [blooms, setBlooms] = useState<Bloom[]>([])
  const [barPct, setBarPct] = useState(0)
  const [barColor, setBarColor] = useState<'magenta' | 'amber' | 'lime'>('magenta')
  const [barTransition, setBarTransition] = useState('width 180ms ease-out')
  const [clockMs, setClockMs] = useState(0)
  const [xMark, setXMark] = useState(false)
  const [cleared, setCleared] = useState(false)
  // Out-of-order hint (hard mode): a counter so back-to-back hints restart the
  // label's animation (the counter keys the label element → remount → replay).
  const [orderHint, setOrderHint] = useState(0)
  const orderHintTimer = useRef<number | undefined>(undefined)
  const boardRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const scoreRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  // The leftover-time "+bonus" that lifts off the bar and dissolves into the score
  // on a cleared batch (the "Lift" payoff). Null when no payoff is in flight.
  const [liftFlyer, setLiftFlyer] = useState<{ value: number; x0: number; y0: number; x1: number; y1: number } | null>(null)

  // Score count-up duration: snappy (600ms) per pick, stretched to the drain
  // window (LIFT_MS) while the cleared-batch speed bonus pours in, so the number
  // climbs in lockstep with the bar emptying.
  const [scoreCountMs, setScoreCountMs] = useState(600)

  // Smoothly counted-up score: every banked pick (and the lifted speed bonus)
  // ticks the displayed number up rather than snapping.
  const displayScore = useCountUp(score, scoreCountMs)

  // Streak: a run of correct recalls (tracked in the store). Each correct pick
  // floats the "+points" it earned over the just-filled gap; the running ×N
  // multiplier shows as a chip above the board.
  const [streakBursts, setStreakBursts] = useState<{ id: number; pts: number; x: number; y: number; demo?: boolean }[]>([])
  const streakBurstId = useRef(0)

  // Streak chip lifecycle: a fresh streak step pops the chip in and holds it for
  // STREAK_HOLD_MS, then it fades out in our signature fade style (vt-fade-away:
  // hold → opacity/blur to nothing) and unmounts. Each new step re-arms the hold,
  // so the chip lingers a beat after the last correct pick. A broken streak
  // (currentStreak < 3) clears it immediately — the streak shattered.
  const [streakChip, setStreakChip] = useState<{ value: number; fading: boolean } | null>(null)
  const streakTimers = useRef<number[]>([])
  useEffect(() => {
    streakTimers.current.forEach(clearTimeout)
    streakTimers.current = []
    if (currentStreak >= 3) {
      setStreakChip({ value: currentStreak, fading: false })
      streakTimers.current.push(window.setTimeout(
        () => setStreakChip(c => (c ? { ...c, fading: true } : c)), STREAK_HOLD_MS))
      streakTimers.current.push(window.setTimeout(
        () => setStreakChip(null), STREAK_HOLD_MS + STREAK_FADE_MS))
    } else {
      setStreakChip(null)
    }
    return () => { streakTimers.current.forEach(clearTimeout); streakTimers.current = [] }
  }, [currentStreak])

  // Earn-a-life: when the shared life pool grows mid-run (every 5000 pts), pop a
  // celebratory heart burst over the board.
  const [lifeBursts, setLifeBursts] = useState<{ id: number; n: number }[]>([])
  const lifeBurstId = useRef(0)
  const prevLives = useRef(lives)
  useEffect(() => {
    const delta = lives - prevLives.current
    if (phase === 'selecting' && delta > 0) {
      sfx.lifeGained()
      const id = (lifeBurstId.current += 1)
      setLifeBursts(prev => [...prev, { id, n: delta }])
      window.setTimeout(() => setLifeBursts(prev => prev.filter(b => b.id !== id)), 1500)
    }
    prevLives.current = lives
  }, [lives, phase])

  // A fresh run / game over / a broken board clears any lingering bursts.
  useEffect(() => {
    if (phase === 'countdown' || phase === 'gameOver' || phase === 'idle') {
      setStreakBursts([])
      setStreakChip(null)
      setLiftFlyer(null)
      setScoreCountMs(600)
      setDemoWrong(null)
      setDemoDone(false)
    }
  }, [phase])

  // Reveal driver (shape-bloom): bloom each gap in turn — the gap's cells all get
  // .vt-bloom at the same tick, flood the piece color (EASY) or magenta
  // (MEDIUM/HARD), then decay along a ghost tail back to the void (fading away in a
  // per-cell wave).
  // Decays cascade (the next gap blooms before the last finishes dying), draining
  // the bar one step per gap as a COUNT, then hand off to selecting. Because the
  // reveals forwards-fill back to the void, past gaps leave no readable hole.
  useEffect(() => {
    if (phase !== 'reveal' || gaps.length === 0) return
    let cancelled = false
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    // The reveal plays as a sequence of gaps, in revealPlan's shuffled order; fall
    // back to index order if a batch somehow arrived without a plan (e.g. legacy state).
    const order = revealPlan.length ? revealPlan : gaps.map((_, i) => i)
    const n = order.length
    // Difficulty shapes the reveal: EASY floods each gap in its own piece
    // colour; MEDIUM and HARD flood the uniform branded pink (shape only, no
    // colour crutch). All tiers play at the same (normal) reveal speed.
    const colorFor = (gap: StaggerGap) =>
      mode === 'easy' ? PIECE_BLOOM_HEX[gap.pieceType] : REVEAL_MAGENTA
    // Reveal/decay timing is read LIVE from timingRef per gap. `step` (gap-to-gap
    // spacing) outruns one bloom's lifetime, so the next gap flashes while the
    // previous is still decaying.
    // Memorize bar DRAINS: starts full and empties one step per gap as the
    // sequence plays out (a visual count of memorize time spent). The demo's
    // bar stays inert/empty — its whole point is that no clock exists yet.
    if (demo) { setBarPct(0) } else { setBarColor('magenta'); setBarTransition('width 180ms ease-out'); setBarPct(100) }
    setBlooms([])
    let id = 0

    const show = (idx: number) => {
      if (cancelled) return
      if (idx >= n) {
        // Let the final gap finish its decay before recall lights-out.
        const { stepMs, bloomMs, decayMs } = timingRef.current
        at(Math.max(0, bloomMs + decayMs - stepMs), beginSelecting)
        return
      }
      if (!demo) setBarPct((1 - (idx + 1) / n) * 100)
      const gi = order[idx]
      const { stepMs, bloomMs, decayMs, waveMs } = timingRef.current
      const lifetime = bloomMs + decayMs + 3 * waveMs + 80
      const myId = ++id
      if (!cancelled) {
        setBlooms(prev => [...prev, bloomForGap(myId, gaps[gi], colorFor(gaps[gi]), bloomMs, decayMs, waveMs)])
        // Each bloom climbs one pentatonic step — the reveal sequence plays as
        // a rising melody, so pitch order doubles as a memory hook for order.
        sfx.bloom(idx)
      }
      // Clear this gap's bloom once it has fully decayed.
      at(lifetime, () => {
        if (!cancelled) setBlooms(prev => prev.filter(b => b.id !== myId))
      })
      at(stepMs, () => show(idx + 1))
    }
    // A short breath before the first gap (also paces continuous next batches).
    at(350, () => show(0))
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [phase, batchIndex, gaps, revealPlan, beginSelecting, mode, demo])

  // Selecting expiry: end the batch when the select clock runs out (lives are the
  // only fail condition). Paused → freeze: the effect tears down and re-arms when
  // `resume` re-dates selectStartTime.
  useEffect(() => {
    if (phase !== 'selecting' || paused || demo) return
    let cancelled = false
    setCleared(false)
    const remaining = Math.max(0, selectStartTime + selectDuration - Date.now())
    const expiry = window.setTimeout(() => {
      if (cancelled) return
      // A cleared batch is handled by the clear beat; only a genuinely-unfinished
      // batch reaches here, and running out of time costs a life.
      if (!useStaggerStore.getState().gaps.every(g => g.filled)) {
        sfx.timeout()
        timeoutBatch()
      }
    }, remaining)
    return () => { cancelled = true; clearTimeout(expiry) }
  }, [phase, paused, demo, batchIndex, selectStartTime, selectDuration, timeoutBatch])

  // Recall clock + bar drain: tick the remaining time every 100ms, draining the
  // amber bar and feeding the in-bar seconds off the SAME live clock (so the bar
  // and the temperature arc track real time, not a fragile CSS-only transition).
  // Bails while cleared so onPick's lime payoff drain isn't overwritten.
  useEffect(() => {
    if (phase !== 'selecting' || paused || cleared || demo) return
    setBarColor('amber'); setBarTransition('width 120ms linear')
    const tick = () => {
      const rem = Math.max(0, selectStartTime + selectDuration - Date.now())
      setClockMs(rem)
      setBarPct(selectDuration > 0 ? (rem / selectDuration) * 100 : 0)
    }
    tick()
    const id = window.setInterval(tick, 100)
    return () => clearInterval(id)
  }, [phase, paused, cleared, demo, selectStartTime, selectDuration])

  // Urgency ticker: the moment the recall clock enters its red zone (the same
  // CLOCK_URGENT.FRACTION that flips the bar red), a clock tick starts and
  // accelerates + pitches up as expiry nears (sfx.urgentTick(heat)). A
  // self-scheduling timeout chain: before the threshold it sleeps until the
  // crossing; inside it, each tick books the next at the shrinking interval.
  // Pause / clear / timeout / game over all tear the chain down via the deps
  // (paused freezes the clock — resume re-dates selectStartTime and re-arms).
  useEffect(() => {
    if (phase !== 'selecting' || paused || cleared || demo || selectDuration <= 0) return
    let timer: number
    const schedule = () => {
      const rem = selectStartTime + selectDuration - Date.now()
      if (rem <= 0) return
      const threshold = selectDuration * CLOCK_URGENT.FRACTION
      if (rem > threshold) {
        timer = window.setTimeout(schedule, rem - threshold)
        return
      }
      const heat = urgentHeat(rem / selectDuration)
      sfx.urgentTick(heat)
      timer = window.setTimeout(schedule, urgentTickIntervalMs(heat))
    }
    schedule()
    return () => clearTimeout(timer)
  }, [phase, paused, cleared, demo, selectStartTime, selectDuration])

  // Fire the leftover-time "+bonus" flyer from the right end of the (frozen) timer
  // bar up to the score readout. Skipped under reduced motion — the score still
  // counts up, just without the traveling flyer.
  const spawnLiftFlyer = (value: number, barRect: DOMRect | null) => {
    if (reduceMotion) return
    const sc = scoreRef.current?.getBoundingClientRect()
    if (!barRect || !sc) return
    setLiftFlyer({
      value,
      x0: barRect.right,
      y0: barRect.top + barRect.height / 2,
      x1: sc.left + sc.width / 2,
      y1: sc.top + sc.height / 2,
    })
  }

  // Any exit from the demo (skip, or the end beat's Start-the-run) resets the
  // demo's score/stats in the store and fires the real countdown.
  const leaveDemo = () => {
    window.clearTimeout(demoWrongTimer.current)
    setDemoWrong(null)
    setDemoDone(false)
    setCleared(false)
    beginRunFromDemo()
  }

  const onPick = (type: PieceType) => {
    if (cleared || paused) return
    const res = pickPiece(type)

    if (demo) {
      window.clearTimeout(demoWrongTimer.current)
      if (!res.ok) {
        // Gentle correction: soft headshake on the tapped piece + coach line —
        // no red flash, no board shake, no sfx sting, nothing lost.
        setDemoWrong(type)
        demoWrongTimer.current = window.setTimeout(() => setDemoWrong(null), 1400)
        return
      }
      setDemoWrong(null)
      sfx.pickCorrect(res.combo)
      if (res.gap) {
        const cells = res.gap.cells
        const avgR = cells.reduce((a, [r]) => a + r, 0) / cells.length
        const avgC = cells.reduce((a, [, c]) => a + c, 0) / cells.length
        const id = (streakBurstId.current += 1)
        setStreakBursts(prev => [...prev, {
          id, pts: res.gained, demo: true,
          x: BOARD_PAD + avgC * CELL_PITCH + CELL / 2,
          y: BOARD_PAD + avgR * CELL_PITCH + CELL / 2,
        }])
        window.setTimeout(() => setStreakBursts(prev => prev.filter(p => p.id !== id)), 1100)
      }
      if (res.batchCleared) {
        // No lift payoff (no clock → no bonus): hold long enough for the snap-in
        // AND the 👍 NICE! burst to play all the way through before the end
        // overlay takes over (the burst lives ~1100ms).
        setCleared(true)
        sfx.batchClear()
        window.setTimeout(() => setDemoDone(true), 1400)
      }
      return
    }
    // gameOver only ever rides a miss: give the final pick its miss buzz too
    // (the gameOver farewell itself fires from the phase effect above).
    if (res.gameOver) { sfx.pickWrong(); return }
    // Any resolved pick ends a live "IN ORDER" hint; a right-shape-wrong-order
    // miss (re)starts it — the phase label swaps to the hint for ORDER_HINT_MS
    // as a central cue for WHY the pick missed, on top of the standard miss
    // feedback below.
    window.clearTimeout(orderHintTimer.current)
    if (res.outOfOrder) {
      setOrderHint(n => n + 1)
      orderHintTimer.current = window.setTimeout(() => setOrderHint(0), ORDER_HINT_MS)
    } else {
      setOrderHint(0)
    }
    if (!res.ok) {
      sfx.pickWrong()
      setXMark(true)
      boardRef.current?.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' },
         { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
        { duration: 240 },
      )
      window.setTimeout(() => setXMark(false), 440)
      return
    }
    // Correct recall. Float the "+points" earned (base × streak) over the filled
    // gap; the running ×N multiplier lives in the chip by the score.
    sfx.pickCorrect(res.combo)
    if (res.gap) {
      const cells = res.gap.cells
      const avgR = cells.reduce((a, [r]) => a + r, 0) / cells.length
      const avgC = cells.reduce((a, [, c]) => a + c, 0) / cells.length
      const x = BOARD_PAD + avgC * CELL_PITCH + CELL / 2
      const y = BOARD_PAD + avgR * CELL_PITCH + CELL / 2
      const id = (streakBurstId.current += 1)
      setStreakBursts(prev => [...prev, { id, pts: res.gained, x, y }])
      window.setTimeout(() => setStreakBursts(prev => prev.filter(p => p.id !== id)), 700)
    }
    if (res.batchCleared) {
      setCleared(true)
      sfx.batchClear()
      const bonus = res.speedBonus
      // Freeze the lime bar where it currently sits (the leftover time), holding it
      // for a short anticipation beat before the payoff.
      const el = barRef.current, parent = el?.parentElement
      const frozenPct = el && parent
        ? (el.getBoundingClientRect().width / parent.getBoundingClientRect().width) * 100
        : barPct
      setBarColor('lime'); setBarTransition('none'); setBarPct(frozenPct)
      // Release: the bar rushes to empty while the leftover time LIFTS off it as a
      // single big "+bonus" that floats up and dissolves into the score, and the
      // score counts up by exactly that bonus — all over the same LIFT_MS window,
      // so remaining time is read as turning into points.
      window.setTimeout(() => {
        const barRect = barRef.current?.getBoundingClientRect() ?? null
        setBarTransition(`width ${LIFT_MS}ms cubic-bezier(0.33,1,0.68,1)`)
        setBarPct(0)
        if (bonus > 0) {
          sfx.bonusLift()
          spawnLiftFlyer(bonus, barRect)
          setScoreCountMs(LIFT_MS)
          bankSpeedBonus(bonus)
        }
      }, LIFT_BEAT_MS)
      window.setTimeout(() => {
        setScoreCountMs(600)
        setCleared(false)
        advanceBatch()
      }, LIFT_BEAT_MS + LIFT_MS + 240)
    }
  }

  if (phase === 'idle') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center vt-vignette select-none">
        <NeonButton variant="primary" onClick={() => startRun(mode)}>Start Staggered Vanishing Tiles</NeonButton>
      </div>
    )
  }

  // All currently-animating bloom cells (every active instance, so past pieces
  // keep decaying while new ones flash). Empty outside reveal → board stays dark.
  const bloomByCell = new Map<string, { id: number; holdMs: number; decayMs: number; color: string }>()
  if (phase === 'reveal') {
    for (const b of blooms) for (const cell of b.cells) bloomByCell.set(cell.key, { id: b.id, holdMs: cell.holdMs, decayMs: cell.decayMs, color: b.color })
  }
  // Demo guidance: the next gap to recall, in reveal order (every mode — which
  // quietly pre-teaches Hard's IN ORDER rule before it's ever enforced).
  const demoTarget = demo && phase === 'selecting' && !cleared && !demoDone
    ? (() => { const next = revealPlan.find(i => !gaps[i].filled); return next !== undefined ? gaps[next].pieceType : null })()
    : null
  // Demo coach copy owns the central line (the transient-cue slot) while the
  // demo is in flight; the normal phase words return with the real run.
  const demoCoach =
    !demo ? null :
    phase === 'reveal' ? 'WATCH THE SHAPES' :
    phase === 'selecting' && !cleared
      ? (demoWrong ? 'NOT THAT ONE — TRY THE GLOWING PIECE'
        : gaps.some(g => g.filled) ? 'NICE — ONE MORE' : 'TAP THE FIRST SHAPE YOU SAW')
      : null

  // Out-of-order hint takes over the phase label mid-recall (never over CLEAR!).
  const orderHintActive = orderHint > 0 && phase === 'selecting' && !cleared
  // Streak takeover of the central line: only mid-recall, and outranked by both
  // the IN ORDER hint and the CLEAR! beat.
  const streakTakeover = streakChip !== null && phase === 'selecting' && !cleared && !orderHintActive
  const phaseLabel = demoCoach ?? (
    phase === 'reveal' ? 'MEMORIZE' :
    phase === 'selecting' ? (cleared ? 'CLEAR!' : orderHintActive ? 'IN ORDER' : 'RECALL') : '')

  // Timer-bar phase color (the §1 temperature arc): magenta filling on reveal,
  // amber draining on recall, red pulse under 25% as the clock heats up, lime on
  // the clear-payoff drain.
  // "Low" tracks real remaining time (not the bar's width state), so the bar +
  // label only heat to red in the final quarter of the recall clock — the same
  // CLOCK_URGENT.FRACTION the urgency ticker starts on.
  const barLow = barColor === 'amber' && !cleared && selectDuration > 0 && clockMs / selectDuration < CLOCK_URGENT.FRACTION
  const barClass =
    barColor === 'magenta' ? 'bg-vt-magenta shadow-vt-magenta' :
    barColor === 'lime' ? 'bg-vt-lime shadow-vt-lime' :
    barLow ? 'bg-vt-red shadow-vt-red animate-[redpulse_0.5s_cubic-bezier(0.7,0,0.3,1)_infinite]' :
    'bg-vt-amber shadow-vt-amber'

  // Phase label color tracks the bar's temperature (magenta → amber → red → lime).
  // The out-of-order hint is magenta: the blink animation plays over it, then
  // this base color is what the label holds until the hint expires.
  const phaseLabelClass =
    demo && demoWrong && phase === 'selecting' && !cleared ? 'text-white' :
    phase === 'reveal' ? 'text-vt-magenta text-glow-vt-magenta' :
    cleared ? 'text-vt-lime text-glow-vt-lime' :
    orderHintActive ? 'text-vt-magenta text-glow-vt-magenta' :
    barLow ? 'text-vt-red text-glow-vt-red' :
    phase === 'selecting' ? 'text-vt-amber text-glow-vt-amber' :
    'text-vt-dim'

  // Countdown subtitle: the selected tier on the heat arc (green/amber/red).
  const modeLabel = `${mode.charAt(0).toUpperCase()}${mode.slice(1)} Mode`
  const modeColor =
    mode === 'easy' ? 'text-vt-lime text-glow-vt-lime' :
    mode === 'hard' ? 'text-vt-red text-glow-vt-red' :
    'text-vt-amber text-glow-vt-amber'

  return (
    <div className="min-h-screen flex flex-col items-center vt-vignette text-vt-text px-4 pt-12 pb-8 select-none">
      {/* HUD + timer — hidden at game over (the summary covers score; lives/shapes are moot) */}
      {phase !== 'gameOver' && (
        <>
          {/* Flat metadata bar (the Training-header grammar): the unlabeled
              score spans the bar's full height on the left; items and lives
              are label-above / value-below columns, bottoms on the score's
              baseline. A [1fr_auto_1fr] grid (not flex justify-between) so the
              items column stays pinned to the bar's true center — equal side
              tracks absorb the score growing wider, instead of it shoving the
              middle to the right. */}
          <div className="w-full max-w-sm grid grid-cols-[1fr_auto_1fr] items-stretch mb-2 pointer-events-none">
            <div className="flex items-end justify-self-start">
              <div ref={scoreRef} className="font-silk font-bold text-3xl text-vt-cyan text-glow-vt-cyan leading-none tabular-nums">{displayScore}</div>
            </div>
            <div className="flex flex-col items-center justify-between">
              <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Items</div>
              <div className="font-grotesk font-semibold text-[15px] leading-none text-vt-text tabular-nums">
                {gaps.filter(g => g.filled).length} <span className="font-medium text-vt-dim">/ {gaps.length || gapCountForBatch(batchIndex)}</span>
              </div>
            </div>
            <div className="flex flex-col items-end justify-between justify-self-end">
              <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Lives</div>
              <LivesCounter lives={lives} cap={STAGGER.START_LIVES} />
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

          {/* The central line above the grid. Usually the phase label; while a
              streak is live in recall, the STREAK ×N takeover owns it instead —
              the multiplier is the value (big), "streak" just the label (small).
              It pops on each streak step, holds, then fades in the signature
              style (see streakChip lifecycle above); the phase word returns
              when it's gone. Priority: IN ORDER (hard-mode corrective) and
              CLEAR! (the payoff beat) both outrank the streak, and the takeover
              never plays outside recall, so MEMORIZE is never masked.
              ("Streak" is player-facing copy only — the underlying store field
              is still `currentCombo`.) */}
          <div className="relative w-full max-w-sm h-4 mt-1 mb-2 pointer-events-none">
            {streakTakeover && streakChip ? (
              /* Centered by flex, NOT a translate: the pop/fade keyframes own
                 `transform`, so translate-based centering on the animated
                 element would drop for the animation's duration and snap back
                 after (a visible jump). */
              <div
                key={streakChip.fading ? `fade-${streakChip.value}` : streakChip.value}
                className={`absolute inset-0 flex items-center justify-center gap-1.5 text-vt-lime text-glow-vt-lime whitespace-nowrap ${streakChip.fading ? 'vt-fade-away' : 'streak-pop'}`}
                style={streakChip.fading ? { animationDuration: `${STREAK_FADE_MS}ms` } : undefined}
              >
                <span className="font-grotesk font-semibold text-[10px] tracking-[0.2em] uppercase">Streak</span>
                <span className="font-silk font-bold text-xl leading-none tabular-nums">×{streakChip.value}</span>
              </div>
            ) : (
              <div
                key={orderHintActive ? `order-${orderHint}` : 'phase'}
                className={`text-center font-grotesk text-[11px] tracking-[0.22em] uppercase transition-colors ${phaseLabelClass}${orderHintActive ? ' vt-order-flash' : ''}`}
              >
                {phaseLabel}
              </div>
            )}
          </div>
        </>
      )}

      {/* Board + overlays */}
      <div className="relative">
        <div ref={boardRef}>
          <StaggerBoard gaps={gaps} bloomByCell={bloomByCell} />
        </div>

        {/* Demo spotlight veil: during a guided pick the board goes quiet so the
            tray's lit target is the only bright thing on screen. */}
        {demoTarget && (
          <div className="absolute inset-0 z-10 rounded-xl bg-black/55 pointer-events-none" />
        )}

        {/* Demo intro — the countdown's overlay grammar (board visible under a
            veil), plain type: the two-step how-to, tap anywhere to begin. */}
        {phase === 'demoIntro' && (
          <button
            type="button"
            onClick={() => beginReveal()}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl bg-black/70 backdrop-blur-[2px] cursor-pointer text-left"
          >
            <div className="font-grotesk text-[10px] uppercase tracking-[0.22em] text-vt-cyan text-glow-vt-cyan mb-5">How it works</div>
            <div className="flex flex-col gap-3.5 mb-7">
              <div className="flex items-baseline gap-2.5">
                <span className="font-grotesk font-bold text-[13px] text-vt-cyan text-glow-vt-cyan tabular-nums">1</span>
                <span className="font-grotesk text-sm font-medium text-vt-text">Memorize the pieces.</span>
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="font-grotesk font-bold text-[13px] text-vt-cyan text-glow-vt-cyan tabular-nums">2</span>
                <span className="font-grotesk text-sm font-medium text-vt-text">Tap to recall what you saw.</span>
              </div>
            </div>
            <div className="vt-demo-continue font-grotesk text-[10px] uppercase tracking-[0.2em] text-vt-dim">Tap to continue</div>
          </button>
        )}

        {/* Demo end beat — both pieces placed behind the veil as proof; the
            opt-out checkbox lives here, at the moment the player can judge it. */}
        {demoDone && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl bg-vt-void px-6 text-center">
            <div className="font-grotesk text-[10px] uppercase tracking-[0.22em] text-vt-lime text-glow-vt-lime mb-2">That's the loop</div>
            <div className="font-grotesk font-bold text-xl text-vt-lime text-glow-vt-lime mb-2">You're ready</div>
            <div className="font-grotesk text-xs text-vt-dim leading-relaxed max-w-[230px] mb-5">
              Same game from here — but the clock is real and misses cost lives.
            </div>
            <NeonButton variant="primary" onClick={leaveDemo}>Start the run</NeonButton>
            <label className="mt-4 flex items-center gap-2 cursor-pointer font-grotesk text-[11px] text-vt-dim">
              <input
                type="checkbox"
                checked={hideDemo}
                onChange={e => setHideDemo(e.target.checked)}
                className="accent-[#28F0FF]"
              />
              Don't show this again
            </label>
          </div>
        )}

        {/* Streak bursts — a "+points" flourish floats up from each filled gap. */}
        <AnimatePresence>
          {streakBursts.map(cb => (
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
              {cb.demo ? (
                // Demo flourish: the same burst, with a 👍 NICE! riding the
                // real "+points" — warm feedback AND the real scoring grammar.
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-[17px]">👍</span>
                  <span className="font-grotesk font-bold text-xs tracking-[0.08em]">NICE!</span>
                  <span>+{cb.pts}</span>
                </span>
              ) : <>+{cb.pts}</>}
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

        {/* Run-intro countdown — anchored OVER the board (not a full-screen
            void): the board/grid is visible underneath, the mode label sits
            above the 3·2·1. Fires at run start. */}
        {phase === 'countdown' && (
          <StaggerCountdown modeLabel={modeLabel} modeColor={modeColor} onDone={beginReveal} />
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
                <div className="font-silk font-bold text-base text-vt-lime text-glow-vt-lime tabular-nums">{bestStreak > 0 ? `×${bestStreak}` : 'N/A'}</div>
                <div className="font-grotesk text-[9px] tracking-[0.1em] uppercase text-vt-faint mt-1.5">Best streak</div>
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

            {/* Play again is THE next action — full width, one tier up in size;
                Leaderboard and Home are half-width secondary doors below it.
                The column matches the stats/graph width above. */}
            <div className="flex flex-col gap-3 w-full max-w-[300px] pointer-events-auto">
              <NeonButton variant="primary" size="lg" fullWidth onClick={() => startRun(mode)}>Play again</NeonButton>
              <div className="flex gap-3">
                {/* The itch the summary creates — "where did that rank?" — gets
                    its own door. Lands on this run's mode tab: the board opens
                    on the persisted difficulty, which is what the run started
                    with. */}
                <NeonButton variant="ghost" fullWidth onClick={() => { exit(); goLeaderboard() }}>Leaderboard</NeonButton>
                <NeonButton variant="ghost" fullWidth onClick={() => { exit(); goHome() }}>Home</NeonButton>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Tray — on HARD, an "IN ORDER" chip rides above it (matching the STREAK
          chip's styling) as a reminder that recall must follow the reveal
          sequence; no per-gap numbering — remembering the order IS the challenge. */}
      <div className="mt-4 w-full flex flex-col items-center">
        {phase === 'selecting' && mode === 'hard' && (
          <div className="w-full max-w-sm mb-1.5 text-right font-silk font-bold text-[11px] tracking-[0.1em] text-vt-magenta text-glow-vt-magenta">
            IN ORDER
          </div>
        )}
        <div className="min-h-[88px] w-full flex justify-center">
          {/* The tray stays mounted through the reveal too (disabled), so the
              layout never jumps when recall begins. */}
          {(phase === 'reveal' || phase === 'selecting') && (
            <PieceTray onPick={onPick} disabled={phase !== 'selecting' || cleared || paused} demoTarget={demoTarget} demoWrong={demoWrong} />
          )}
        </div>
      </div>

      {/* Skip demo — rides where the pause button lives in the real run. Does
          NOT set the opt-out; only the end beat's checkbox does. */}
      {demo && !demoDone && (
        <div className="mt-3 w-full max-w-sm text-right">
          <button
            onClick={leaveDemo}
            className="font-grotesk text-[10px] uppercase tracking-[0.18em] text-vt-faint hover:text-vt-dim transition-colors"
          >
            skip demo ›
          </button>
        </div>
      )}

      {/* Pause — freeze the run (full width). (Replay-the-sequence was removed:
          replaying after picks left correct pieces on the board, a confusing
          experience to be redesigned later.) */}
      {phase === 'selecting' && !demo && (
        <div className="mt-3 w-full max-w-sm">
          <button
            aria-label="Pause"
            disabled={cleared}
            onClick={() => pause()}
            className="w-full flex items-center justify-center gap-2 rounded-md border-2 bg-vt-raised py-3 px-4 text-sm font-grotesk font-semibold uppercase tracking-[0.1em]
              border-vt-cyan text-vt-cyan hover:bg-vt-cyan/10 hover:shadow-vt-cyan
              transition active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
          >
            {/* Icon-only: the two-bar glyph is universal — the word was noise. */}
            <span className="flex gap-[4px]">
              <span className="block w-[5px] h-4 rounded-sm bg-current" />
              <span className="block w-[5px] h-4 rounded-sm bg-current" />
            </span>
          </button>
        </div>
      )}

      {/* Hard pause — covers the whole screen so no memorizing happens while
          frozen; resume picks the clock back up, exit bails to the landing page.
          The run's live stats ride along: a pause doubles as a scoreboard check. */}
      {paused && (
        <PauseOverlay onResume={() => resume()} onExit={() => { exit(); goHome() }}>
          <div className="flex items-end gap-10 pointer-events-none">
            <div>
              <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Score</div>
              <div className="mt-1 font-silk font-bold text-lg text-vt-cyan text-glow-vt-cyan leading-none tabular-nums">
                {score}
              </div>
            </div>
            <div>
              <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Lives</div>
              {/* Hearts sit in the same 18px line box as the neighboring text-lg
                  values — a bare div's default line-height would pad below the
                  hearts and push this column out of line. */}
              <div className="mt-1 flex h-[18px] items-center"><LivesCounter lives={lives} cap={STAGGER.START_LIVES} /></div>
            </div>
            <div>
              <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Streak</div>
              <div className="mt-1 font-silk font-bold text-lg text-vt-lime text-glow-vt-lime leading-none tabular-nums">
                {currentStreak}
              </div>
            </div>
          </div>
        </PauseOverlay>
      )}

      {/* Time → score "Lift": the leftover-time "+bonus" rises off the right end of
          the timer bar and dissolves into the score readout as the bar drains and
          the number climbs (fired from onPick on a cleared batch). */}
      {liftFlyer && (
        <motion.div
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
          animate={{
            x: liftFlyer.x1 - liftFlyer.x0,
            y: liftFlyer.y1 - liftFlyer.y0,
            opacity: [0, 1, 1, 0],
            scale: [0.6, 1.1, 1, 0.7],
          }}
          transition={{ duration: LIFT_MS / 1000, ease: [0.33, 1, 0.68, 1], times: [0, 0.18, 0.72, 1] }}
          onAnimationComplete={() => setLiftFlyer(null)}
          transformTemplate={(_, generated) => `translate(-50%, -50%) ${generated}`}
          className="fixed z-[60] pointer-events-none font-silk font-bold text-2xl whitespace-nowrap text-vt-lime text-glow-vt-lime tabular-nums"
          style={{ left: liftFlyer.x0, top: liftFlyer.y0, textShadow: FLOAT_TEXT_SHADOW }}
        >
          +{liftFlyer.value}
        </motion.div>
      )}
    </div>
  )
}

