import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from '../Grid'
import { GapBorder } from '../GapBorder'
import { PieceShape } from '../PieceShape'
import { gapFillClass } from '../../lib/gapPalette'
import { expandCartSlots } from '@shared/engine/cartSlots'
import { computeMorph, type MorphOp } from '../../lib/morphCart'
import type { Grid as GridType } from '@shared/types'
import './gameOver.css'

const REVEAL_MS = 400   // beat before the cart starts morphing
const STEP_MS = 300     // stagger between chips

/** One chip in the morph: keeps flag green, flips reveal the right piece, adds
 *  fly in, removes ✕ and dissolve. Each plays after its staggered `delay`. */
function MorphChip({ op, delay, reduce }: { op: MorphOp; delay: number; reduce: boolean }) {
  const [played, setPlayed] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setPlayed(true)
      if (op.kind === 'remove') {
        window.setTimeout(() => setGone(true), reduce ? 0 : 380)
      }
    }, reduce ? 0 : delay)
    return () => window.clearTimeout(t)
  }, [delay, op.kind, reduce])

  const front = op.kind === 'flip' || op.kind === 'remove' ? op.from : op.to
  const back = op.kind === 'flip' ? op.to : null

  let cls = 'go-chip'
  if (op.kind === 'flip' && played) cls += ' flip'
  if (op.kind === 'keep' && played) cls += ' keep'
  if (op.kind === 'add') cls += played ? ' go-add in' : ' go-add'
  if (op.kind === 'remove' && played) cls += ' removing'
  if (gone) cls += ' gone'

  return (
    <div className={cls}>
      <div className="go-inner">
        <div className="go-face go-front">
          <PieceShape pieceType={front.pieceType} cellSize={9} colorClass={front.color ? gapFillClass(front.color) : undefined} />
        </div>
        {back && (
          <div className="go-face go-back">
            <PieceShape pieceType={back.pieceType} cellSize={9} colorClass={back.color ? gapFillClass(back.color) : undefined} />
          </div>
        )}
      </div>
      {op.kind === 'remove' && <div className="go-x">✕</div>}
    </div>
  )
}

/**
 * Game Over reveal (Journey, out of lives): shows the solved board, lets the
 * player inspect the empty gaps, and morphs their selection into the correct
 * answer (wrong → flip, missing → fly-in, extra → dissolve).
 */
export function GameOverReveal() {
  const reduce = !!useReducedMotion()
  const { gaps, sessionGrid, selection } = useGameStore(useShallow(s => ({
    gaps: s.gaps,
    sessionGrid: s.sessionGrid,
    selection: s.selection,
  })))

  const [inspect, setInspect] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [answerLabel, setAnswerLabel] = useState(false)

  // Pristine board with every gap filled by its correct piece.
  const solvedGrid: GridType = useMemo(() => {
    const g = sessionGrid.map(row => row.map(cell => ({ ...cell })))
    for (const gap of gaps) {
      for (const [r, c] of gap.cells) {
        g[r][c] = { ...g[r][c], status: 'placed', pieceType: gap.pieceType, color: gap.color }
      }
    }
    return g
  }, [sessionGrid, gaps])

  const ops = useMemo(() => {
    const player = expandCartSlots(selection).map(s => ({ pieceType: s.pieceType, color: s.color }))
    const answer = gaps.map(g => ({ pieceType: g.pieceType, color: g.color }))
    return computeMorph(player, answer)
  }, [selection, gaps])

  useEffect(() => {
    const t = window.setTimeout(() => setRevealed(true), 60)
    const total = (reduce ? 0 : REVEAL_MS) + ops.length * (reduce ? 0 : STEP_MS) + 400
    const t2 = window.setTimeout(() => setAnswerLabel(true), total)
    return () => { window.clearTimeout(t); window.clearTimeout(t2) }
  }, [ops.length, reduce])

  return (
    <div data-testid="game-over-reveal" className="flex flex-col items-center gap-4 w-full max-w-sm">
      <div className="font-pixel text-[18px] text-neon-red text-glow-red tracking-wide">GAME OVER</div>

      {/* Solved board (or the empty gaps while inspecting) */}
      <div className={`relative transition-opacity duration-500 ${revealed ? 'opacity-100' : 'opacity-0'}`}>
        <Grid grid={inspect ? sessionGrid : solvedGrid} />
        {inspect && <GapBorder gaps={gaps} />}
      </div>

      <button
        data-testid="game-over-inspect"
        onClick={() => setInspect(v => !v)}
        className="font-pixel text-[10px] tracking-[0.1em] text-neon-cyan border-2 border-neon-cyan/60 rounded-lg px-4 py-2 hover:bg-neon-cyan/10 transition"
      >
        {inspect ? 'SHOW ANSWER' : 'INSPECT GAPS'}
      </button>

      <div className={`text-[9px] font-pixel tracking-[0.2em] transition-colors ${answerLabel ? 'text-neon-green' : 'text-zinc-500'}`}>
        {answerLabel ? 'THE ANSWER' : 'YOUR PICKS'}
      </div>
      <div className="bg-arcade-panel border-2 border-arcade-edge shadow-panel-inset rounded-md p-3 inline-flex gap-2 flex-wrap justify-center max-w-sm min-h-[64px] items-center">
        {ops.map((op, i) => (
          <MorphChip key={i} op={op} delay={REVEAL_MS + i * STEP_MS} reduce={reduce} />
        ))}
        {ops.length === 0 && <span className="text-xs text-gray-600 italic">No gaps</span>}
      </div>
    </div>
  )
}
