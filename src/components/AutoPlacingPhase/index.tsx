import { useGameStore } from '../../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from '../Grid'

export function AutoPlacingPhase() {
  const { selection } = useGameStore(useShallow(s => ({
    selection: s.selection,
  })))

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm items-center">
      <Grid />

      {/* SelectionCart will replace this in Task 8 */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 inline-flex gap-2">
        {selection.flatMap(e =>
          Array.from({ length: e.lockedCount + e.freeCount }, (_, i) => (
            <span key={`${e.pieceType}-${i}`} className="text-xs text-gray-500">{e.pieceType}</span>
          )),
        )}
      </div>
    </div>
  )
}
