import { useState, useRef, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from './Grid'
import { PieceShape } from './PieceShape'
import { getRotatedCells } from '../engine/pieces'
import type { Rotation } from '../types'

export function PlacingPhase() {
  const {
    selection, grid, heldPiece,
    holdPiece, rotatePiece, clearHeld, placePiece, finishManualPlace,
  } = useGameStore(useShallow(s => ({
    selection: s.selection,
    grid: s.grid,
    heldPiece: s.heldPiece,
    holdPiece: s.holdPiece,
    rotatePiece: s.rotatePiece,
    clearHeld: s.clearHeld,
    placePiece: s.placePiece,
    finishManualPlace: s.finishManualPlace,
  })))

  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const previewCells: [number, number][] = []
  if (heldPiece && hoverCell) {
    const cells = getRotatedCells(heldPiece.pieceType, heldPiece.rotation)
    for (const [dr, dc] of cells) {
      const r = hoverCell[0] + dr
      const c = hoverCell[1] + dc
      if (r >= 0 && r < 10 && c >= 0 && c < 8 && grid[r][c].status === 'empty') {
        previewCells.push([r, c])
      }
    }
  }

  const hasEmptyGaps = grid.some(row => row.some(c => c.status === 'empty'))
  const hasSelectionLeft = selection.some(e => e.lockedCount + e.freeCount > 0)

  const handleCellClick = (row: number, col: number) => {
    if (!heldPiece) return
    placePiece(row, col)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-xs text-gray-500 text-center">
        Place your pieces — click piece to hold · click grid to place · R to rotate
      </div>

      <div
        ref={containerRef}
        onKeyDown={e => { if (e.key === 'r' || e.key === 'R') rotatePiece() }}
        tabIndex={0}
        className="outline-none"
      >
        <Grid onCellClick={handleCellClick} onCellHover={(r, c) => setHoverCell([r, c])} highlightCells={previewCells} />
      </div>

      {/* Piece tray */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 w-full max-w-sm">
        <p className="text-xs text-gray-600 mb-2">Tray</p>
        <div className="flex gap-2 flex-wrap">
          {selection.filter(e => e.lockedCount + e.freeCount > 0).map(entry => {
            const isHeld = heldPiece?.pieceType === entry.pieceType
            const rotation: Rotation = isHeld ? (heldPiece?.rotation ?? 0) : 0
            return (
              <button
                key={entry.pieceType}
                onClick={() => isHeld ? clearHeld() : holdPiece(entry.pieceType, 0)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs
                  ${isHeld
                    ? 'border-blue-400 bg-blue-950 shadow-[0_0_8px] shadow-blue-400'
                    : 'border-gray-600 bg-gray-800 hover:border-gray-400'
                  }`}
              >
                <PieceShape pieceType={entry.pieceType} rotation={rotation} cellSize={13} />
                <span className="text-[10px] text-gray-400">
                  {entry.lockedCount > 0 ? `🔒×${entry.lockedCount}` : ''}
                  {entry.freeCount > 0 ? ` ×${entry.freeCount}` : ''}
                </span>
              </button>
            )
          })}
        </div>
        {heldPiece && (
          <p className="text-xs text-blue-400 mt-2">Press R to rotate · click a gap to place</p>
        )}
      </div>

      {(!hasEmptyGaps || !hasSelectionLeft) && (
        <button
          onClick={finishManualPlace}
          className="px-6 py-2 bg-green-800 border-2 border-green-500 text-green-300 rounded-xl font-bold"
        >
          Finish Round →
        </button>
      )}
    </div>
  )
}
