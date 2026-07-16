import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useShallow } from 'zustand/shallow'
import { ROWS, COLS, type PieceType } from '@shared/types'
import { useTrainingStore, TRAINING_TYPES, type TrainingPiece } from '../store/trainingStore'
import { useNavStore } from '../store/navStore'
import { PauseOverlay } from './ui'

const CELL = 28
const CELL_PITCH = CELL + 2   // cell + 2px grid gap
const BOARD_PAD = 12          // p-3 around the board

// A correct pick fades the piece out with the same ghost-tail wave as the
// game's reveal, but much brisker — training has no clock, so the gap between
// pieces is pure downtime. (The in-game decay is ~1s + 3×220ms of wave.)
const DECAY_MS = 420
const WAVE_MS = 90
const FADE_OUT_TOTAL_MS = DECAY_MS + 3 * WAVE_MS + 100

// Same bloom flood colors as the game's EASY reveal — training keeps the color
// crutch on: shape + color + NAME all bind together while learning.
const PIECE_BLOOM_HEX: Record<PieceType, string> = {
  I: '#22d3ee', O: '#facc15', T: '#a855f7', S: '#4ade80', Z: '#ef4444', J: '#3b82f6', L: '#fb923c',
}

// Floating white feedback text over bright piece color — same soft downward
// drop shadow the game uses (never a hard stroke).
const FLOAT_TEXT_SHADOW = '0 2px 5px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.95)'

// ── Board ─────────────────────────────────────────────────────────────────────
// The same dark-void board as the game, but with a single piece at a time: it
// blooms in (vt-bloom-hold — the reveal's flash-in, held lit) and stays up
// until named correctly, then decays back to the void in the reveal's per-cell
// wave (vt-bloom-decay).
function TrainingBoard({
  piece, round, leaving,
}: { piece: TrainingPiece | null; round: number; leaving: boolean }) {
  const pieceCells = new Map<string, number>() // cell key → wave index
  if (piece) {
    ;[...piece.cells]
      .sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[1] - b[1])
      .forEach(([r, c], i) => pieceCells.set(`${r},${c}`, i))
  }
  const color = piece ? PIECE_BLOOM_HEX[piece.type] : undefined

  return (
    <div
      className="inline-grid gap-[2px] p-3 bg-[#04040a] rounded-xl shadow-[inset_0_2px_6px_#000,inset_0_0_0_1px_rgba(255,255,255,0.03)]"
      style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL}px)` }}
    >
      {Array.from({ length: ROWS * COLS }, (_, i) => {
        const r = Math.floor(i / COLS)
        const c = i % COLS
        const wave = pieceCells.get(`${r},${c}`)
        if (wave !== undefined) {
          // Keyed by round + phase so the hold animation re-fires per fresh
          // piece and the decay starts clean from the held-bright state.
          return (
            <div
              key={`${i}-${round}-${leaving ? 'decay' : 'hold'}`}
              className={`w-7 h-7 rounded-sm ${leaving ? 'vt-bloom-decay' : 'vt-bloom-hold'}`}
              style={{
                ...(leaving ? { animationDuration: `${DECAY_MS + wave * WAVE_MS}ms` } : {}),
                ['--bloom-color']: color,
              } as CSSProperties}
            />
          )
        }
        return <div key={i} className="w-7 h-7 rounded-sm vt-dim" />
      })}
    </div>
  )
}

// ── Letter tray ───────────────────────────────────────────────────────────────
// The training counterpart of the game's piece tray: the same panel and button
// chrome, but each option is the piece's NAME — a plain white uppercase letter.
function LetterTray({
  onPick, disabled,
}: { onPick: (t: PieceType) => void; disabled: boolean }) {
  return (
    <div className="w-full max-w-sm rounded-xl p-3 bg-vt-panel border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex justify-between items-center mb-2 pointer-events-none select-none">
        <span className="font-silk text-[10px] tracking-[0.15em] uppercase text-vt-cyan text-glow-vt-cyan">Names</span>
        <span className="text-[10px] text-vt-dim tracking-[0.04em]">tap the letter that names it</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {TRAINING_TYPES.map(type => (
          <button
            key={type}
            data-letter-option={type}
            disabled={disabled}
            onClick={() => onPick(type)}
            className="flex items-center justify-center h-12 rounded-md border bg-vt-raised
              border-vt-cyan/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]
              hover:border-vt-cyan hover:shadow-vt-cyan cursor-pointer transition
              disabled:opacity-40 disabled:pointer-events-none
              font-silk font-bold text-xl text-white"
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
// The flat four-stat readout — run → record → fumbles → speed — shared by the
// in-game HUD (spread edge-to-edge over the board) and the pause overlay
// (gathered into a centered row).
function TrainingStats({
  spread, currentStreak, bestStreak, misses, avgLabel,
}: { spread?: boolean; currentStreak: number; bestStreak: number; misses: number; avgLabel: string }) {
  return (
    <div className={`flex items-end pointer-events-none ${spread ? 'w-full max-w-sm justify-between' : 'gap-8'}`}>
      <div>
        <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Streak</div>
        <div className="mt-1 font-silk font-bold text-lg text-vt-lime text-glow-vt-lime leading-none tabular-nums">
          {currentStreak}
        </div>
      </div>
      <div>
        <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Best</div>
        <div className="mt-1 font-silk font-bold text-lg text-vt-lime/55 leading-none tabular-nums">
          {bestStreak}
        </div>
      </div>
      <div>
        <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Miss</div>
        <div className="mt-1 font-silk font-bold text-lg text-vt-red/75 leading-none tabular-nums">
          {misses}
        </div>
      </div>
      <div className={spread ? 'text-right' : ''}>
        <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Avg speed</div>
        <div className="mt-1 font-silk font-bold text-lg text-vt-cyan text-glow-vt-cyan leading-none tabular-nums">
          {avgLabel}
        </div>
      </div>
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
export function TrainingScreen() {
  const {
    active, piece, round, paused, currentStreak, bestStreak, totalPicks, correctPicks, totalCorrectMs,
    start, nextPiece, guess, pause, resume, exit,
  } = useTrainingStore(useShallow(s => ({
    active: s.active, piece: s.piece, round: s.round, paused: s.paused,
    currentStreak: s.currentStreak, bestStreak: s.bestStreak,
    totalPicks: s.totalPicks, correctPicks: s.correctPicks, totalCorrectMs: s.totalCorrectMs,
    start: s.start, nextPiece: s.nextPiece, guess: s.guess, pause: s.pause, resume: s.resume, exit: s.exit,
  })))
  const goHome = useNavStore(s => s.goHome)

  // A correct pick's fade-out in flight: tray disabled, piece decaying.
  const [leaving, setLeaving] = useState(false)
  const [xMark, setXMark] = useState(false)
  const [burst, setBurst] = useState<{ id: number; x: number; y: number; label: string } | null>(null)
  const burstId = useRef(0)
  const boardRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<number[]>([])

  // Safety net: entering the screen cold (e.g. a hot-reload or deep link)
  // starts a session. Timers are torn down on unmount.
  useEffect(() => {
    if (!useTrainingStore.getState().active) start()
    const timers = timersRef.current
    return () => { timers.forEach(clearTimeout) }
  }, [start])

  const onPick = (type: PieceType) => {
    if (leaving || !piece) return
    const res = guess(type)
    if (!res.ok) {
      // The game's miss feedback: red border flash + board shake.
      setXMark(true)
      boardRef.current?.animate?.(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' },
         { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
        { duration: 240 },
      )
      timersRef.current.push(window.setTimeout(() => setXMark(false), 440))
      return
    }
    // Correct: float the SELECTION TIME off the named piece (the game's bubbly
    // "+points" flourish, repurposed — speed is training's score) while it
    // fades back to the void, then bring on the next one.
    const cells = piece.cells
    const avgR = cells.reduce((a, [r]) => a + r, 0) / cells.length
    const avgC = cells.reduce((a, [, c]) => a + c, 0) / cells.length
    const id = (burstId.current += 1)
    setBurst({
      id,
      x: BOARD_PAD + avgC * CELL_PITCH + CELL / 2,
      y: BOARD_PAD + avgR * CELL_PITCH + CELL / 2,
      label: `${(res.elapsedMs / 1000).toFixed(1)}s`,
    })
    timersRef.current.push(window.setTimeout(() => setBurst(b => (b?.id === id ? null : b)), 700))
    setLeaving(true)
    timersRef.current.push(window.setTimeout(() => {
      setLeaving(false)
      nextPiece()
    }, FADE_OUT_TOTAL_MS))
  }

  const exitTraining = () => { exit(); goHome() }

  // Running average selection speed across the session's correct picks — the
  // stat to beat: accuracy AND speed is the whole game.
  // Millisecond precision on the HUD average (2.184s, not 2.2s) — the running
  // stat rewards shaving; the per-pick float keeps its coarse one-decimal label.
  const avgLabel = correctPicks > 0 ? `${(totalCorrectMs / correctPicks / 1000).toFixed(3)}s` : '—'

  if (!active) return null

  return (
    <div className="min-h-screen flex flex-col items-center vt-vignette text-vt-text px-4 pt-12 pb-8 select-none">
      {/* HUD — no score, no lives, no visible clock: the flat four-stat bar,
          one shared size and baseline. Streaks are lime-family (BEST dimmed),
          MISS a muted red (a record, not an alarm), speed cyan. */}
      <div className="w-full max-w-sm mb-2">
        <TrainingStats
          spread
          currentStreak={currentStreak}
          bestStreak={bestStreak}
          misses={totalPicks - correctPicks}
          avgLabel={avgLabel}
        />
      </div>

      {/* Prompt line — flips to the lime CORRECT beat while the piece fades
          (mirroring the game's CLEAR! phase label, matter-of-fact over cheerleading). */}
      <div className="w-full max-w-sm h-4 mt-1 mb-2 pointer-events-none">
        <div
          className={`text-center font-grotesk text-[11px] tracking-[0.22em] uppercase transition-colors
            ${leaving ? 'text-vt-lime text-glow-vt-lime' : 'text-vt-magenta text-glow-vt-magenta'}`}
        >
          {leaving ? 'CORRECT' : 'NAME THE PIECE'}
        </div>
      </div>

      {/* Board + overlays */}
      <div className="relative">
        <div ref={boardRef}>
          <TrainingBoard piece={piece} round={round} leaving={leaving} />
        </div>

        {/* Correct pick — the SELECTION TIME bubbles up off the named piece and
            evaporates (the game's "+points" flourish, with seconds as the prize). */}
        <AnimatePresence>
          {burst && (
            <motion.div
              key={burst.id}
              initial={{ opacity: 0, scale: 0.4, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: -22 }}
              exit={{ opacity: 0, scale: 1.5, y: -46 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2
                font-silk font-bold text-sm whitespace-nowrap text-white tabular-nums"
              style={{ left: burst.x, top: burst.y, textShadow: FLOAT_TEXT_SHADOW }}
            >
              {burst.label}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wrong pick: the game's red border flash (with the shake above). */}
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
      </div>

      {/* Letter tray — always up; briefly disabled while a named piece fades. */}
      <div className="mt-4 w-full flex justify-center">
        <LetterTray onPick={onPick} disabled={leaving} />
      </div>

      {/* Pause — the same full-width control as the game's run screen. The
          speed clock is training's only timer (invisible but always running),
          so leaving mid-session goes through pause → Exit to Home, which also
          freezes the clock the moment you look away. */}
      <div className="mt-3 w-full max-w-sm">
        <button
          aria-label="Pause"
          onClick={() => pause()}
          className="w-full flex items-center justify-center gap-2 rounded-md border-2 bg-vt-raised py-3 px-4 text-sm font-grotesk font-semibold uppercase tracking-[0.1em]
            border-vt-cyan text-vt-cyan hover:bg-vt-cyan/10 hover:shadow-vt-cyan
            transition active:translate-y-px"
        >
          <span className="flex gap-[3px]">
            <span className="block w-[3px] h-3.5 rounded-sm bg-current" />
            <span className="block w-[3px] h-3.5 rounded-sm bg-current" />
          </span>
          Pause
        </button>
      </div>

      {/* Hard pause — covers the whole screen (the held piece stays hidden, so
          no free memorizing) with the session's full stat bar riding along. */}
      {paused && (
        <PauseOverlay onResume={() => resume()} onExit={exitTraining}>
          <TrainingStats
            currentStreak={currentStreak}
            bestStreak={bestStreak}
            misses={totalPicks - correctPicks}
            avgLabel={avgLabel}
          />
        </PauseOverlay>
      )}
    </div>
  )
}
