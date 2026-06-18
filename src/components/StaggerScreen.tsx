import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useShallow } from 'zustand/shallow'
import { ROWS, COLS, type PieceType } from '@shared/types'
import { PIECE_DEFINITIONS, getPieceColor } from '@shared/engine/pieces'
import { useStaggerStore, type StaggerGap } from '../store/staggerStore'
import { useNavStore } from '../store/navStore'
import { STAGGER, holdMsForBatch, gapCountForBatch, DISPLAY_ROTATION } from '../lib/staggerCurve'
import { PieceShape } from './PieceShape'
import { NeonButton, ArcadePanel, ScanlineOverlay } from './ui'

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
// The board reads as SOLID during selection — gaps are hidden, so the player is
// recalling from memory. Filled gaps light up in their piece color; during the
// reveal, the current gap's cells flash a dashed silhouette over the solid board.
function StaggerBoard({
  gaps, revealCells, revealOn,
}: { gaps: StaggerGap[]; revealCells: Set<string>; revealOn: boolean }) {
  const colorByCell = new Map<string, PieceType>()
  gaps.forEach(g => {
    if (g.filled) g.cells.forEach(([r, c]) => colorByCell.set(`${r},${c}`, g.pieceType))
  })

  return (
    <div
      className="inline-grid gap-[2px] p-3 bg-gray-900 rounded-xl"
      style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL}px)` }}
    >
      {Array.from({ length: ROWS * COLS }, (_, i) => {
        const r = Math.floor(i / COLS)
        const c = i % COLS
        const key = `${r},${c}`
        const piece = colorByCell.get(key)
        if (piece) {
          return (
            <motion.div
              key={i}
              initial={{ scale: 0.5, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`w-7 h-7 rounded-sm ${getPieceColor(piece)} ring-1 ring-white/25`}
            />
          )
        }
        const revealing = revealCells.has(key)
        // Faint board tile; a revealing gap fades in as a TRUE empty hole (the
        // dark board shows through) ringed by a dashed neon outline — the same
        // "empty gap" look the other modes use.
        return (
          <div key={i} className="relative w-7 h-7 rounded-sm bg-slate-800/50">
            {revealing && (
              <div
                className="absolute inset-0 rounded-sm border-2 border-dashed border-neon-cyan bg-gray-900"
                style={{ opacity: revealOn ? 1 : 0, transition: `opacity ${STAGGER.FADE_MS}ms ease` }}
              />
            )}
          </div>
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
            className="absolute font-sans font-black leading-none text-neon-cyan text-[6rem] drop-shadow-[0_0_30px_rgba(34,211,238,0.55)]"
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
    <ArcadePanel className="p-3 w-full max-w-sm">
      <div className="flex justify-between items-center mb-2">
        <span className="font-pixel text-[10px] tracking-[0.15em] uppercase text-neon-cyan">Pieces</span>
        <span className="text-[10px] text-gray-500">tap to place from memory</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {PIECE_DEFINITIONS.map(def => (
          <button
            key={def.type}
            data-piece-option={def.type}
            disabled={disabled}
            onClick={() => onPick(def.type as PieceType)}
            className="flex items-center justify-center h-12 p-1 rounded-md border-2 border-arcade-edge
              bg-arcade-well hover:border-neon-cyan/60 cursor-pointer transition disabled:opacity-40
              disabled:pointer-events-none"
          >
            <PieceShape pieceType={def.type as PieceType} rotation={DISPLAY_ROTATION[def.type]} cellSize={8} />
          </button>
        ))}
      </div>
    </ArcadePanel>
  )
}

// ── HUD ─────────────────────────────────────────────────────────────────────
function Hearts({ lives }: { lives: number }) {
  return (
    <div className="flex gap-1" aria-label={`${lives} lives`}>
      {Array.from({ length: STAGGER.START_LIVES }, (_, i) => (
        <span key={i} className={`text-lg leading-none ${i < lives ? 'text-neon-red text-glow-red' : 'text-arcade-edge'}`}>♥</span>
      ))}
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
export function StaggerScreen() {
  const {
    phase, batchIndex, gaps, score, lives, selectDuration, selectStartTime, paused,
    startRun, beginReveal, beginSelecting, pickPiece, advanceBatch, timeoutBatch,
    replayReveal, pause, resume, exit,
  } = useStaggerStore(useShallow(s => ({
    phase: s.phase, batchIndex: s.batchIndex, gaps: s.gaps, score: s.score,
    lives: s.lives, selectDuration: s.selectDuration, selectStartTime: s.selectStartTime, paused: s.paused,
    startRun: s.startRun, beginReveal: s.beginReveal, beginSelecting: s.beginSelecting,
    pickPiece: s.pickPiece, advanceBatch: s.advanceBatch, timeoutBatch: s.timeoutBatch,
    replayReveal: s.replayReveal, pause: s.pause, resume: s.resume, exit: s.exit,
  })))
  const goHome = useNavStore(s => s.goHome)

  const [revealIndex, setRevealIndex] = useState(-1)
  const [revealOn, setRevealOn] = useState(false)
  const [barPct, setBarPct] = useState(0)
  const [barColor, setBarColor] = useState<'magenta' | 'green'>('magenta')
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

  // Reveal driver: flash each gap once (fade-in → hold → fade-out), filling the
  // bar one step per gap as a COUNT indicator, then hand off to selecting.
  useEffect(() => {
    if (phase !== 'reveal' || gaps.length === 0) return
    let cancelled = false
    const timers: number[] = []
    const n = gaps.length
    const hold = holdMsForBatch(batchIndex)
    setBarColor('magenta'); setBarTransition('width 180ms ease-out'); setBarPct(0)
    setRevealIndex(-1); setRevealOn(false)

    const show = (idx: number) => {
      if (cancelled) return
      if (idx >= n) { beginSelecting(); return }
      setRevealIndex(idx); setRevealOn(false)
      setBarPct(((idx + 1) / n) * 100)
      timers.push(window.setTimeout(() => !cancelled && setRevealOn(true), 24))
      timers.push(window.setTimeout(() => !cancelled && setRevealOn(false), 24 + STAGGER.FADE_MS + hold))
      timers.push(window.setTimeout(() => show(idx + 1), 24 + STAGGER.FADE_MS + hold + STAGGER.FADE_MS))
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
    setBarColor('green'); setBarTransition('none'); setBarPct(startPct)
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
      setBarTransition('none'); setBarPct(frozenPct)
      // A relaxed, savor-it drain — fast enough to feel like a reward, slow
      // enough to enjoy the leftover time pouring into the score.
      window.setTimeout(() => { setBarTransition('width 1400ms cubic-bezier(0.33,1,0.68,1)'); setBarPct(0) }, 220)
      window.setTimeout(() => { setCleared(false); advanceBatch() }, 1900)
    }
  }

  if (phase === 'idle') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-arcade-bg">
        <NeonButton variant="primary" onClick={startRun}>Start Infinite Stagger</NeonButton>
      </div>
    )
  }

  const revealCells = phase === 'reveal' && revealIndex >= 0 && revealIndex < gaps.length
    ? new Set(gaps[revealIndex].cells.map(([r, c]) => `${r},${c}`))
    : new Set<string>()
  const phaseLabel =
    phase === 'countdown' ? 'get ready' :
    phase === 'reveal' ? 'memorize' :
    phase === 'selecting' ? (cleared ? 'cleared!' : 'recall') : ''

  return (
    <div className="min-h-screen flex flex-col items-center bg-arcade-bg text-white px-4 pt-12 pb-8">
      {/* HUD */}
      <div className="w-full max-w-sm flex items-end justify-between mb-2">
        <div>
          <div className="font-pixel text-[9px] tracking-[0.2em] uppercase text-gray-500">Score</div>
          <div className="font-pixel text-3xl text-neon-cyan text-glow-cyan leading-none tabular-nums">{displayScore}</div>
        </div>
        <div className="text-right">
          <Hearts lives={lives} />
          <div className="font-sans font-semibold text-sm text-gray-300 mt-1.5 tabular-nums">
            {gaps.filter(g => g.filled).length} / {gaps.length || gapCountForBatch(batchIndex)}
            <span className="font-sans text-[10px] text-gray-500 ml-1.5 tracking-[0.12em] uppercase">gaps</span>
          </div>
        </div>
      </div>

      {/* Timer / count bar */}
      <div className="w-full max-w-sm h-1.5 rounded-full bg-arcade-edge overflow-hidden mb-3">
        <div
          ref={barRef}
          className={`h-full rounded-full ${barColor === 'magenta' ? 'bg-neon-magenta' : 'bg-neon-green'}`}
          style={{ width: `${barPct}%`, transition: barTransition }}
        />
      </div>

      {/* Board + overlays */}
      <div className="relative">
        <div ref={boardRef}>
          <StaggerBoard gaps={gaps} revealCells={revealCells} revealOn={revealOn} />
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
                font-pixel text-[11px] whitespace-nowrap text-neon-yellow
                drop-shadow-[0_0_10px_rgba(250,204,21,0.85)]"
              style={{ left: cb.x, top: cb.y }}
            >
              Combo {cb.count}
            </motion.div>
          ))}
        </AnimatePresence>

        {phase === 'countdown' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-arcade-bg/70 rounded-xl">
            <div className="font-pixel text-sm text-neon-cyan text-glow-cyan mb-2 uppercase tracking-[0.1em]">Infinite Stagger</div>
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
              <span className="text-neon-red text-glow-red text-7xl font-black">✕</span>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === 'gameOver' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-arcade-bg/90 rounded-xl px-6">
            <ScanlineOverlay />
            <div className="font-pixel text-sm text-neon-red text-glow-red uppercase tracking-[0.15em] mb-3">Game Over</div>
            <div className="font-pixel text-[9px] tracking-[0.2em] uppercase text-gray-500">Final score</div>
            <div className="font-pixel text-4xl text-neon-cyan text-glow-cyan mb-1">{score}</div>
            <div className="text-xs text-gray-400 mb-6">reached batch {batchIndex + 1}</div>
            <div className="flex flex-col gap-3 w-44">
              <NeonButton variant="primary" fullWidth onClick={startRun}>Replay</NeonButton>
              <NeonButton variant="ghost" fullWidth onClick={() => { exit(); goHome() }}>Exit to menu</NeonButton>
            </div>
          </div>
        )}
      </div>

      {/* Phase label + tray */}
      <div className="h-5 mt-3 font-pixel text-[10px] tracking-[0.2em] uppercase text-gray-500">{phaseLabel}</div>
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
            className="flex-1 rounded-md border-2 bg-arcade-panel py-3 px-4 text-sm font-sans font-semibold
              border-neon-magenta text-neon-magenta shadow-neon-magenta hover:bg-neon-magenta/10
              transition-colors active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
          >
            ↻ Replay <span className="opacity-75">−{STAGGER.REPLAY_COST}</span>
          </button>
          <button
            aria-label="Pause"
            disabled={cleared}
            onClick={() => pause()}
            className="shrink-0 w-12 grid place-items-center rounded-md border-2 bg-arcade-panel
              border-arcade-edge text-gray-300 hover:border-neon-cyan hover:text-neon-cyan
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
          bg-arcade-bg text-white px-6">
          <ScanlineOverlay />
          <div className="font-pixel text-lg text-neon-cyan text-glow-cyan uppercase tracking-[0.2em]">Paused</div>
          <div className="flex flex-col gap-3 w-52">
            <NeonButton variant="primary" fullWidth onClick={() => resume()}>Resume</NeonButton>
            <NeonButton variant="danger" fullWidth onClick={() => { exit(); goHome() }}>Exit to Home</NeonButton>
          </div>
        </div>
      )}
    </div>
  )
}
