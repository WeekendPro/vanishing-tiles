import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useNavStore } from '../store/navStore'
import { useShallow } from 'zustand/shallow'
import { PIECE_DEFINITIONS } from '@shared/engine/pieces'
import { PieceShape } from './PieceShape'
import { NeonButton, ArcadePanel } from './ui'
import type { PieceType } from '@shared/types'

export function SelectingPhase() {
  const {
    selection, incrementSelection, decrementSelection,
    submit, phaseStartTime, phaseDuration,
  } = useGameStore(useShallow(s => ({
    selection: s.selection,
    incrementSelection: s.incrementSelection,
    decrementSelection: s.decrementSelection,
    submit: s.submit,
    phaseStartTime: s.phaseStartTime,
    phaseDuration: s.phaseDuration,
  })))
  const journeyError = useGameStore(s => s.journeyError)
  const backToMap = useNavStore(s => s.backToMap)

  useEffect(() => {
    const remaining = Math.max(0, phaseStartTime + phaseDuration - Date.now())
    const timer = setTimeout(submit, remaining)
    return () => clearTimeout(timer)
  }, [phaseStartTime, phaseDuration, submit])

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      {journeyError && (
        <div className="bg-arcade-panel border-2 border-neon-red rounded-md p-3 text-sm text-neon-red flex items-center justify-between gap-3">
          <span>Couldn’t submit: {journeyError}</span>
          <NeonButton variant="danger" size="sm" onClick={backToMap} className="shrink-0">
            Back to Map
          </NeonButton>
        </div>
      )}
      {/* Selection box */}
      <ArcadePanel className="p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="font-pixel text-[10px] tracking-[0.15em] uppercase text-neon-cyan">Your Selection</span>
          <span className="text-[10px] text-gray-500">tap selected to decrement</span>
        </div>
        <div className="flex gap-2 flex-wrap min-h-[52px] items-center">
          {selection.filter(e => e.freeCount > 0).map(entry => (
            <button
              key={entry.pieceType}
              onClick={() => decrementSelection(entry.pieceType)}
              className="flex flex-col items-center gap-1 p-2 rounded-md border-2 text-xs
                border-neon-cyan bg-arcade-well text-neon-cyan cursor-pointer hover:bg-arcade-panel"
            >
              <PieceShape pieceType={entry.pieceType} cellSize={11} />
              <span>×{entry.freeCount}</span>
            </button>
          ))}
          {selection.length === 0 && (
            <span className="text-xs text-gray-600 italic">No pieces selected</span>
          )}
        </div>
      </ArcadePanel>

      {/* Piece menu */}
      <ArcadePanel className="p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="font-pixel text-[10px] tracking-[0.15em] uppercase text-neon-cyan">Pieces</span>
          <span className="text-[10px] text-gray-500">tap to increment</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {PIECE_DEFINITIONS.map(def => (
            <button
              key={def.type}
              onClick={() => incrementSelection(def.type as PieceType)}
              className="flex flex-col items-center gap-1 p-2 bg-arcade-well border-2 border-arcade-edge
                rounded-md hover:border-neon-cyan cursor-pointer"
            >
              <PieceShape pieceType={def.type} cellSize={11} />
              <span className="font-pixel text-[9px] text-gray-400">{def.type}</span>
            </button>
          ))}
        </div>
      </ArcadePanel>

      <NeonButton fullWidth variant="go" onClick={submit}>
        Done ✓
      </NeonButton>
    </div>
  )
}
