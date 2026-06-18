import { useMemo } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { SelectionCart } from './SelectionCart'
import { expandCartSlots, type ChipSlot } from '@shared/engine/cartSlots'

const NONE: ReadonlySet<number> = new Set()

/**
 * Game Over (Journey, out of lives): a simple side-by-side teaching screen —
 * the player's selection above, the correct selection below.
 */
export function GameOverReveal() {
  const { gaps, selection } = useGameStore(useShallow(s => ({
    gaps: s.gaps,
    selection: s.selection,
  })))

  const yourSlots = useMemo(() => expandCartSlots(selection), [selection])
  // The correct selection is one piece per gap (its shape + color).
  const answerSlots: ChipSlot[] = useMemo(
    () => gaps.map((g, i) => ({ pieceType: g.pieceType, color: g.color, slotIndex: i })),
    [gaps],
  )

  return (
    <div data-testid="game-over-reveal" className="flex flex-col items-center gap-5 w-full max-w-sm">
      <div className="font-pixel font-bold text-[18px] text-neon-red text-glow-red tracking-wide">GAME OVER</div>

      <div className="flex flex-col items-center gap-2">
        <div className="text-[9px] font-pixel tracking-[0.2em] text-zinc-400">YOUR SELECTION</div>
        <SelectionCart slots={yourSlots} consumed={NONE} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="text-[9px] font-pixel tracking-[0.2em] text-neon-green">CORRECT SELECTION</div>
        <SelectionCart slots={answerSlots} consumed={NONE} />
      </div>
    </div>
  )
}
