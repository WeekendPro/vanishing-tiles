import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { PIECE_DEFINITIONS } from '@shared/engine/pieces'
import { PieceShape } from './PieceShape'
import type { PieceType } from '@shared/types'

export function SelectingPhase() {
  const {
    selection, incrementSelection, decrementSelection,
    submitSelection, phaseDuration,
  } = useGameStore(useShallow(s => ({
    selection: s.selection,
    incrementSelection: s.incrementSelection,
    decrementSelection: s.decrementSelection,
    submitSelection: s.submitSelection,
    phaseDuration: s.phaseDuration,
  })))

  useEffect(() => {
    const timer = setTimeout(submitSelection, phaseDuration)
    return () => clearTimeout(timer)
  }, [phaseDuration, submitSelection])

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      {/* Selection box */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">Your Selection</span>
          <span className="text-xs text-gray-600">tap selected to decrement</span>
        </div>
        <div className="flex gap-2 flex-wrap min-h-[52px] items-center">
          {selection.filter(e => e.freeCount > 0).map(entry => (
            <button
              key={entry.pieceType}
              onClick={() => decrementSelection(entry.pieceType)}
              className="flex flex-col items-center gap-1 p-2 rounded-lg border text-xs
                border-blue-500 bg-blue-950 text-blue-300 cursor-pointer hover:bg-blue-900"
            >
              <PieceShape pieceType={entry.pieceType} cellSize={11} />
              <span>×{entry.freeCount}</span>
            </button>
          ))}
          {selection.length === 0 && (
            <span className="text-xs text-gray-600 italic">No pieces selected</span>
          )}
        </div>
      </div>

      {/* Piece menu */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">Pieces</span>
          <span className="text-xs text-gray-600">tap to increment</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {PIECE_DEFINITIONS.map(def => (
            <button
              key={def.type}
              onClick={() => incrementSelection(def.type as PieceType)}
              className="flex flex-col items-center gap-1 p-2 bg-gray-800 border border-gray-700
                rounded-lg hover:border-gray-500 cursor-pointer"
            >
              <PieceShape pieceType={def.type} cellSize={11} />
              <span className="text-[10px] text-gray-500">{def.type}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={submitSelection}
        className="w-full py-3 rounded-xl font-bold bg-green-700 hover:bg-green-600
          text-white shadow-lg shadow-green-900/40 cursor-pointer"
      >
        Done ✓
      </button>
    </div>
  )
}
