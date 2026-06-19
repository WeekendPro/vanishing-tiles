import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useShallow } from 'zustand/shallow'
import { ROWS, COLS, type PieceType } from '@shared/types'
import { PIECE_DEFINITIONS, getPieceColor } from '@shared/engine/pieces'
import { useStaggerStore, type StaggerGap } from '../store/staggerStore'
import { useNavStore } from '../store/navStore'
import { STAGGER, holdMsForBatch, gapCountForBatch, DISPLAY_ROTATION } from '../lib/staggerCurve'
import { PieceShape } from './PieceShape'
import { NeonButton, ScanlineOverlay, LivesCounter } from './ui'

const CELL = 28
const CELL_PITCH = CELL + 2   // cell + 2px grid gap
const BOARD_PAD = 12          // p-3 around the board

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
// The phosphor board. Every empty cell renders ONE uniform surface so gaps are
// concealed: graphite (.phos-filled) during reveal/countdown, lights-out
// (.phos-dim) during recall. A gap is only ever exposed by a live magenta BLOOM
// — the whole tetromino's cells get .phos-bloom at the same tick, flood magenta,
// hold, then decay and RE-SEAL into the graphite surface (never a dark hole).
// Filled/placed gaps keep their piece color (a correct pick lighting out of the
// dark), ringed with a soft glow.
function StaggerBoard({
  gaps, bloomCells, bloomKey, recall,
}: { gaps: StaggerGap[]; bloomCells: Set<string>; bloomKey: number; recall: boolean }) {
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
        // Uniform surface: graphite while revealing, lights-out while recalling.
        // A blooming gap's cells flood magenta together then re-seal seamlessly.
        const blooming = bloomCells.has(key)
        return (
          <div
            key={blooming ? `${i}-bloom-${bloomKey}` : i}
            className={`w-7 h-7 rounded-sm ${blooming ? 'phos-bloom' : recall ? 'phos-dim' : 'phos-filled'}`}
          />
        )
      })}
    </div>
  )
}

// ── Countdown ───────────────────────────────────────────────────────────────
function StaggerCountdown({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion()
  const [count, setCount] = useState(3)
  useEffect(() => {
    if (count <= 0) {
      const t = window.setTimeout(onDone, 350)
      return () => clearTimeout(t)
    }
    const t = window.setTimeout(() => setCount(c => c - 1), 750)
    return () => clearTimeout(t)
  }, [count, onDone])
  return (
    <div className="flex h-44 w-44 items-center justify-center">
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.3 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.9 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="absolute font-silk font-black leading-none text-phos-cyan text-[6rem] drop-shadow-[0_0_30px_rgba(40,240,255,0.55)]"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Piece tray ────────────────────────────────────────────────────────────────
function PieceTray({ onPick, disabled }: { onPick: (t: PieceType) => void; disabled: boolean }) {
  return (
    <div className="w-full max-w-sm rounded-xl p-3 bg-phos-panel border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex justify-between items-center mb-2">
        <span className="font-silk text-[10px] tracking-[0.15em] uppercase text-phos-cyan text-glow-phos-cyan">Pieces</span>
        <span className="text-[10px] text-phos-dim tracking-[0.04em]">tap to place from memory</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {PIECE_DEFINITIONS.map(def => (
          <button
            key={def.type}
            data-piece-option={def.type}
            disabled={disabled}
            onClick={() => onPick(def.type as PieceType)}
            className="flex items-center justify-center h-12 p-1 rounded-md border bg-phos-raised
              border-phos-cyan/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]
              hover:border-phos-cyan hover:shadow-phos-cyan cursor-pointer transition
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
    shapesRecalled, bestCombo, totalPicks, correctPicks,
    startRun, beginReveal, beginSelecting, pickPiece, advanceBatch, timeoutBatch,
    replayReveal, pause, resume, exit,
  } = useStaggerStore(useShallow(s => ({
    phase: s.phase, batchIndex: s.batchIndex, gaps: s.gaps, score: s.score,
    lives: s.lives, selectDuration: s.selectDuration, selectStartTime: s.selectStartTime, paused: s.paused,
    shapesRecalled: s.shapesRecalled, bestCombo: s.bestCombo, totalPicks: s.totalPicks, correctPicks: s.correctPicks,
    startRun: s.startRun, beginReveal: s.beginReveal, beginSelecting: s.beginSelecting,
    pickPiece: s.pickPiece, advanceBatch: s.advanceBatch, timeoutBatch: s.timeoutBatch,
    replayReveal: s.replayReveal, pause: s.pause, resume: s.resume, exit: s.exit,
  })))
  const goHome = useNavStore(s => s.goHome)

  const [revealIndex, setRevealIndex] = useState(-1)
  const [bloomKey, setBloomKey] = useState(0)
  const [barPct, setBarPct] = useState(0)
  const [barColor, setBarColor] = useState<'magenta' | 'amber' | 'lime'>('magenta')
  const [barTransition, setBarTransition] = useState('width 180ms ease-out')
  const [xMark, setXMark] = useState(false)
  const [cleared, setCleared] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // Smoothly counted-up score: every banked pick (and the end-of-batch speed
  // bonus) ticks the displayed number up rather than snapping.
  const displayScore = useCountUp(score)

  // Combo: a streak of correct recalls. Each correct pick floats a "Combo N"
  // burst over the just-filled gap; a miss breaks the streak.
  const [combos, setCombos] = useState<{ id: number; count: number; x: number; y: number }[]>([])
  const comboCount = useRef(0)
  const comboId = useRef(0)

  // A fresh run / game over / a broken board resets the streak and clears any
  // lingering combo bursts.
  useEffect(() => {
    if (phase === 'countdown' || phase === 'gameOver' || phase === 'idle') {
      comboCount.current = 0
      setCombos([])
    }
  }, [phase])

  // Reveal driver (shape-bloom): bloom each gap as a WHOLE tetromino — all its
  // cells get .phos-bloom at the same tick, flood magenta, hold, then decay and
  // re-seal into the surface. Decays cascade (the next shape blooms before the
  // last finishes dying), filling the bar one step per gap as a COUNT, then hand
  // off to selecting. Because .phos-bloom forwards-fills to the graphite surface,
  // past gaps re-seal seamlessly — no readable hole remains.
  useEffect(() => {
    if (phase !== 'reveal' || gaps.length === 0) return
    let cancelled = false
    const timers: number[] = []
    const n = gaps.length
    // Step between shape blooms: the hold plus a short inter-shape breath. The
    // 1.3s bloom keyframe out-runs this, so decays overlap into a cascade.
    const step = holdMsForBatch(batchIndex) + STAGGER.FADE_MS
    setBarColor('magenta'); setBarTransition('width 180ms ease-out'); setBarPct(0)
    setRevealIndex(-1)

    const show = (idx: number) => {
      if (cancelled) return
      if (idx >= n) { beginSelecting(); return }
      setRevealIndex(idx)
      setBloomKey(k => k + 1)   // re-key so the bloom animation (re)starts
      setBarPct(((idx + 1) / n) * 100)
      timers.push(window.setTimeout(() => show(idx + 1), step))
    }
    // A short breath before the first gap (also paces continuous next batches).
    timers.push(window.setTimeout(() => show(0), 350))
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [phase, batchIndex, gaps, beginSelecting])

  // Selecting driver: drain the bar over whatever select clock REMAINS (a fresh
  // batch starts full; a replay/pause resumes mid-drain), then end the batch on
  // expiry (lives are the only fail condition). Paused → freeze: the effect
  // tears down and waits, picking back up when `resume` re-dates selectStartTime.
  useEffect(() => {
    if (phase !== 'selecting' || paused) return
    let cancelled = false
    setCleared(false)
    const remaining = Math.max(0, selectStartTime + selectDuration - Date.now())
    const startPct = selectDuration > 0 ? (remaining / selectDuration) * 100 : 0
    setBarColor('amber'); setBarTransition('none'); setBarPct(startPct)
    const raf = requestAnimationFrame(() => {
      if (cancelled) return
      setBarTransition(`width ${remaining}ms linear`); setBarPct(0)
    })
    const expiry = window.setTimeout(() => {
      if (cancelled) return
      // A cleared batch is handled by the clear beat; only a genuinely-unfinished
      // batch reaches here, and running out of time costs a life.
      if (!useStaggerStore.getState().gaps.every(g => g.filled)) timeoutBatch()
    }, remaining)
    return () => { cancelled = true; cancelAnimationFrame(raf); clearTimeout(expiry) }
  }, [phase, paused, batchIndex, selectStartTime, selectDuration, timeoutBatch])

  const onPick = (type: PieceType) => {
    if (cleared || paused) return
    const res = pickPiece(type)
    if (res.gameOver) return
    if (!res.ok) {
      comboCount.current = 0   // a miss breaks the streak
      setXMark(true)
      boardRef.current?.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' },
         { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
        { duration: 240 },
      )
      window.setTimeout(() => setXMark(false), 440)
      return
    }
    // Correct recall. The streak builds silently; once it reaches 3 in a row,
    // each further correct pick pops a "Combo N" burst over the filled gap.
    const count = (comboCount.current += 1)
    if (res.gap && count >= 3) {
      const cells = res.gap.cells
      const avgR = cells.reduce((a, [r]) => a + r, 0) / cells.length
      const avgC = cells.reduce((a, [, c]) => a + c, 0) / cells.length
      const x = BOARD_PAD + avgC * CELL_PITCH + CELL / 2
      const y = BOARD_PAD + avgR * CELL_PITCH + CELL / 2
      const id = (comboId.current += 1)
      setCombos(prev => [...prev, { id, count, x, y }])
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
      <div className="min-h-screen flex flex-col items-center justify-center phos-vignette">
        <NeonButton variant="primary" onClick={startRun}>Start Infinite Stagger</NeonButton>
      </div>
    )
  }

  const bloomCells = phase === 'reveal' && revealIndex >= 0 && revealIndex < gaps.length
    ? new Set(gaps[revealIndex].cells.map(([r, c]) => `${r},${c}`))
    : new Set<string>()
  const recall = phase === 'selecting'
  const phaseLabel =
    phase === 'countdown' ? 'get ready' :
    phase === 'reveal' ? 'memorize' :
    phase === 'selecting' ? (cleared ? 'cleared!' : 'recall') : ''

  // Timer-bar phase color (the §1 temperature arc): magenta filling on reveal,
  // amber draining on recall, red pulse under 25% as the clock heats up, lime on
  // the clear-payoff drain.
  const barLow = barColor === 'amber' && barPct < 25
  const barClass =
    barColor === 'magenta' ? 'bg-phos-magenta shadow-phos-magenta' :
    barColor === 'lime' ? 'bg-phos-lime shadow-phos-lime' :
    barLow ? 'bg-phos-red shadow-phos-red animate-[redpulse_0.5s_cubic-bezier(0.7,0,0.3,1)_infinite]' :
    'bg-phos-amber shadow-phos-amber'

  return (
    <div className="min-h-screen flex flex-col items-center phos-vignette text-phos-text px-4 pt-12 pb-8">
      {/* HUD + timer — hidden at game over (the summary covers score; lives/shapes are moot) */}
      {phase !== 'gameOver' && (
        <>
          <div className="w-full max-w-sm flex items-end justify-between mb-2">
            <div>
              <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-phos-dim">Score</div>
              <div className="font-silk font-bold text-3xl text-phos-cyan text-glow-phos-cyan leading-none tabular-nums">{displayScore}</div>
            </div>
            <div className="text-right">
              <LivesCounter lives={lives} />
              <div className="font-grotesk font-semibold text-sm text-phos-text mt-1.5 tabular-nums">
                {gaps.filter(g => g.filled).length} / {gaps.length || gapCountForBatch(batchIndex)}
                <span className="font-grotesk text-[10px] text-phos-dim ml-1.5 tracking-[0.12em] uppercase">shapes</span>
              </div>
            </div>
          </div>

          {/* Timer / count bar — phase-colored (magenta → amber → red → lime) */}
          <div className="w-full max-w-sm h-2 rounded-full bg-black overflow-hidden mb-3 shadow-[inset_0_1px_2px_#000]">
            <div
              ref={barRef}
              className={`h-full rounded-full ${barClass}`}
              style={{ width: `${barPct}%`, transition: barTransition }}
            />
          </div>
        </>
      )}

      {/* Board + overlays */}
      <div className="relative">
        <div ref={boardRef}>
          <StaggerBoard gaps={gaps} bloomCells={bloomCells} bloomKey={bloomKey} recall={recall} />
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
                font-silk text-[11px] whitespace-nowrap text-phos-lime
                drop-shadow-[0_0_10px_rgba(182,255,60,0.85)]"
              style={{ left: cb.x, top: cb.y }}
            >
              Combo {cb.count}
            </motion.div>
          ))}
        </AnimatePresence>

        {phase === 'countdown' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-phos-void/70 rounded-xl">
            <div className="font-silk text-sm text-phos-cyan text-glow-phos-cyan mb-2 uppercase tracking-[0.1em]">Infinite Stagger</div>
            <StaggerCountdown onDone={beginReveal} />
          </div>
        )}

        <AnimatePresence>
          {xMark && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <span className="text-phos-red text-glow-phos-red text-7xl font-black">✕</span>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === 'gameOver' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-phos-void/90 rounded-xl px-6">
            <ScanlineOverlay />
            <div className="font-grotesk text-[10px] tracking-[0.3em] uppercase text-phos-red text-glow-phos-red mb-2">Run Over</div>
            <div className="font-silk text-base text-phos-text uppercase tracking-[0.15em] mb-1.5">Game Over</div>
            <div className="font-grotesk text-[11px] tracking-[0.18em] uppercase text-phos-magenta text-glow-phos-magenta mb-5 phos-breathe">Memory Fades</div>
            <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-phos-dim">Final score</div>
            <div className="font-silk font-bold text-4xl text-phos-amber text-glow-phos-amber mb-6 tabular-nums">{score}</div>

            {/* Run-stats trio — shapes recalled / best combo / accuracy. */}
            <div className="flex w-full max-w-[300px] border-y border-white/10 mb-6">
              <div className="flex-1 text-center py-3.5">
                <div className="font-silk font-bold text-base text-phos-magenta text-glow-phos-magenta tabular-nums">{shapesRecalled}</div>
                <div className="font-grotesk text-[9px] tracking-[0.1em] uppercase text-phos-faint mt-1.5">Shapes recalled</div>
              </div>
              <div className="flex-1 text-center py-3.5 border-x border-white/10">
                <div className="font-silk font-bold text-base text-phos-lime text-glow-phos-lime tabular-nums">×{bestCombo}</div>
                <div className="font-grotesk text-[9px] tracking-[0.1em] uppercase text-phos-faint mt-1.5">Best combo</div>
              </div>
              <div className="flex-1 text-center py-3.5">
                <div className="font-silk font-bold text-base text-phos-cyan text-glow-phos-cyan tabular-nums">
                  {totalPicks === 0 ? 100 : Math.round((correctPicks / totalPicks) * 100)}%
                </div>
                <div className="font-grotesk text-[9px] tracking-[0.1em] uppercase text-phos-faint mt-1.5">Accuracy</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-44">
              <NeonButton variant="primary" fullWidth onClick={startRun}>Play again</NeonButton>
              <NeonButton variant="ghost" fullWidth onClick={() => { exit(); goHome() }}>Home</NeonButton>
            </div>
          </div>
        )}
      </div>

      {/* Phase label + tray */}
      <div className="h-5 mt-3 font-grotesk text-[11px] tracking-[0.22em] uppercase text-phos-dim">{phaseLabel}</div>
      <div className="mt-1 min-h-[88px] w-full flex justify-center">
        {phase === 'selecting' && <PieceTray onPick={onPick} disabled={cleared || paused} />}
      </div>

      {/* Replay / Pause — spend points to re-see the sequence, or freeze the run.
          Replay stretches to fill the row; Pause is a slim icon-only button. */}
      {phase === 'selecting' && (
        <div className="mt-3 w-full max-w-sm flex gap-3">
          <button
            disabled={cleared || score < STAGGER.REPLAY_COST}
            onClick={() => replayReveal()}
            className="flex-1 rounded-md border-2 bg-phos-raised py-3 px-4 text-sm font-grotesk font-semibold uppercase tracking-[0.1em]
              border-phos-amber text-phos-amber shadow-phos-amber hover:bg-phos-amber/10
              transition-colors active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
          >
            ↻ Replay <span className="opacity-75">−{STAGGER.REPLAY_COST}</span>
          </button>
          <button
            aria-label="Pause"
            disabled={cleared}
            onClick={() => pause()}
            className="shrink-0 w-12 grid place-items-center rounded-md border-2 bg-phos-raised
              border-phos-cyan/40 text-phos-dim hover:border-phos-cyan hover:text-phos-cyan
              transition-colors active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
          >
            <span className="flex gap-[3px]">
              <span className="block w-[3px] h-3.5 rounded-sm bg-current" />
              <span className="block w-[3px] h-3.5 rounded-sm bg-current" />
            </span>
          </button>
        </div>
      )}

      {/* Hard pause — covers the whole screen so no memorizing happens while
          frozen; resume picks the clock back up, exit bails to the landing page. */}
      {paused && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8
          bg-phos-void text-phos-text px-6">
          <ScanlineOverlay />
          <div className="font-silk text-lg text-phos-cyan text-glow-phos-cyan uppercase tracking-[0.2em]">Paused</div>
          <div className="flex flex-col gap-3 w-52">
            <NeonButton variant="primary" fullWidth onClick={() => resume()}>Resume</NeonButton>
            <NeonButton variant="danger" fullWidth onClick={() => { exit(); goHome() }}>Exit to Home</NeonButton>
          </div>
        </div>
      )}
    </div>
  )
}
