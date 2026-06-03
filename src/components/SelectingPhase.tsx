import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useNavStore } from '../store/navStore'
import { useShallow } from 'zustand/shallow'
import { PIECE_DEFINITIONS } from '@shared/engine/pieces'
import { THEME_CONFIG, GAP_COLOR_IDS } from '@shared/core/themeConfig'
import { gapFillClass } from '../lib/gapPalette'
import { PieceShape } from './PieceShape'
import { NeonButton, ArcadePanel } from './ui'
import type { PieceType } from '@shared/types'

export function SelectingPhase() {
  const {
    selection, incrementSelection, decrementSelection,
    appendQueuePiece, popQueuePiece,
    submit, phaseStartTime, phaseDuration,
    roundTheme, gaps,
  } = useGameStore(useShallow(s => ({
    selection: s.selection,
    incrementSelection: s.incrementSelection,
    decrementSelection: s.decrementSelection,
    appendQueuePiece: s.appendQueuePiece,
    popQueuePiece: s.popQueuePiece,
    submit: s.submit,
    phaseStartTime: s.phaseStartTime,
    phaseDuration: s.phaseDuration,
    roundTheme: s.roundTheme,
    gaps: s.gaps,
  })))
  const journeyError = useGameStore(s => s.journeyError)
  const backToMap = useNavStore(s => s.backToMap)

  const colorMatters = THEME_CONFIG[roundTheme].colorMatters
  const orderMatters = THEME_CONFIG[roundTheme].orderMatters
  const roundShapes = [...new Set(gaps.map(g => g.pieceType))]

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
          {orderMatters ? (
            <>
              {selection.map((entry, i) => (
                <div key={i} className="flex flex-col items-center gap-1 p-2 rounded-md border-2 border-neon-cyan bg-arcade-well text-neon-cyan">
                  <span className="font-pixel text-[9px] text-gray-400">{i + 1}</span>
                  <PieceShape pieceType={entry.pieceType} cellSize={11} />
                </div>
              ))}
              {selection.length === 0 && (
                <span className="text-xs text-gray-600 italic">Tap pieces in order</span>
              )}
              {selection.length > 0 && (
                <button
                  data-queue-undo
                  onClick={popQueuePiece}
                  className="ml-auto self-stretch px-3 rounded-md border-2 border-neon-red text-neon-red text-xs hover:bg-arcade-panel"
                >
                  Undo ⌫
                </button>
              )}
            </>
          ) : (
            <>
              {selection.filter(e => e.freeCount > 0).map(entry => (
                <button
                  key={`${entry.pieceType}:${entry.color ?? ""}`}
                  onClick={() => decrementSelection(entry.pieceType, entry.color)}
                  className="flex flex-col items-center gap-1 p-2 rounded-md border-2 text-xs
                    border-neon-cyan bg-arcade-well text-neon-cyan cursor-pointer hover:bg-arcade-panel"
                >
                  <PieceShape
                    pieceType={entry.pieceType}
                    cellSize={11}
                    colorClass={entry.color ? gapFillClass(entry.color) : undefined}
                  />
                  <span>×{entry.freeCount}</span>
                </button>
              ))}
              {selection.length === 0 && (
                <span className="text-xs text-gray-600 italic">No pieces selected</span>
              )}
            </>
          )}
        </div>
      </ArcadePanel>

      {/* Piece menu */}
      <ArcadePanel className="p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="font-pixel text-[10px] tracking-[0.15em] uppercase text-neon-cyan">Pieces</span>
          <span className="text-[10px] text-gray-500">tap to increment</span>
        </div>
        {colorMatters ? (
          <div className="grid grid-cols-4 gap-2">
            {roundShapes.flatMap(shape =>
              GAP_COLOR_IDS.map(colorId => (
                <button
                  key={`${shape}:${colorId}`}
                  data-color-option={colorId}
                  onClick={() => incrementSelection(shape as PieceType, colorId)}
                  className="flex flex-col items-center gap-1 p-2 bg-arcade-well border-2 border-arcade-edge
                    rounded-md hover:border-neon-cyan cursor-pointer"
                >
                  <PieceShape pieceType={shape as PieceType} cellSize={11} colorClass={gapFillClass(colorId)} />
                </button>
              ))
            )}
          </div>
        ) : orderMatters ? (
          <div className="grid grid-cols-4 gap-2">
            {PIECE_DEFINITIONS.map(def => (
              <button
                key={def.type}
                data-queue-option={def.type}
                onClick={() => appendQueuePiece(def.type as PieceType)}
                className="flex flex-col items-center gap-1 p-2 bg-arcade-well border-2 border-arcade-edge
                  rounded-md hover:border-neon-cyan cursor-pointer"
              >
                <PieceShape pieceType={def.type} cellSize={11} />
                <span className="font-pixel text-[9px] text-gray-400">{def.type}</span>
              </button>
            ))}
          </div>
        ) : (
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
        )}
      </ArcadePanel>

      <NeonButton fullWidth variant="go" onClick={submit}>
        Done ✓
      </NeonButton>
    </div>
  )
}
