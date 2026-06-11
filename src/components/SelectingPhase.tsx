import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
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
    roundTheme,
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
  })))

  const colorMatters = THEME_CONFIG[roundTheme].colorMatters
  const orderMatters = THEME_CONFIG[roundTheme].orderMatters

  useEffect(() => {
    const remaining = Math.max(0, phaseStartTime + phaseDuration - Date.now())
    const timer = setTimeout(submit, remaining)
    return () => clearTimeout(timer)
  }, [phaseStartTime, phaseDuration, submit])

  // Chromatic two-panel "active selection": `active` holds either a piece type
  // ("O"), a color id ("purple"), or undefined. Tap a piece OR a color to make it
  // active; while one axis is active, tapping the other axis adds that colored
  // piece to the selection (and keeps `active` so you can rapid-fire). Tapping the
  // active thing again clears it.
  const [active, setActive] = useState<string | undefined>(undefined)
  const isPieceType = (v: string | undefined): v is PieceType =>
    !!v && PIECE_DEFINITIONS.some(d => d.type === v)

  const clickPiece = (p: PieceType) => {
    if (active === p) setActive(undefined)
    else if (isPieceType(active)) setActive(p)        // switch active piece
    else if (active) incrementSelection(p, active)    // a color is active → add
    else setActive(p)
  }
  const clickColor = (c: string) => {
    if (active === c) setActive(undefined)
    else if (active && !isPieceType(active)) setActive(c)  // switch active color
    else if (isPieceType(active)) incrementSelection(active, c)  // a piece is active → add
    else setActive(c)
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
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

      {colorMatters ? (
        <>
          {/* Active-pick status line */}
          <div
            className={`text-center text-xs rounded-md border px-3 py-2 ${
              active ? 'border-neon-cyan/60 bg-white/[0.03] text-gray-300' : 'border-arcade-edge text-gray-500'
            }`}
          >
            {active === undefined ? (
              'Pick a piece or a color to start.'
            ) : isPieceType(active) ? (
              <>Piece <b className="text-white">{active}</b> active — tap a color to add it.</>
            ) : (
              <>Color <b className="text-white capitalize">{active}</b> active — tap a piece to add it.</>
            )}
          </div>

          {/* Pieces (monochrome) */}
          <ArcadePanel className="p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-pixel text-[10px] tracking-[0.15em] uppercase text-neon-cyan">Pieces</span>
              <span className="text-[10px] text-gray-500">tap to activate</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {PIECE_DEFINITIONS.map(def => {
                const on = active === def.type
                return (
                  <button
                    key={def.type}
                    data-piece-option={def.type}
                    aria-pressed={on}
                    onClick={() => clickPiece(def.type as PieceType)}
                    className={`flex items-center justify-center p-1 rounded-md border-2 cursor-pointer transition ${
                      on
                        ? 'border-white bg-arcade-well shadow-[0_0_0_2px_#fff,0_0_14px_rgba(255,255,255,0.5)]'
                        : 'border-arcade-edge bg-arcade-well hover:border-neon-cyan/50'
                    }`}
                  >
                    <PieceShape pieceType={def.type} cellSize={8} colorClass={on ? 'bg-gray-100' : 'bg-gray-500'} />
                  </button>
                )
              })}
            </div>
          </ArcadePanel>

          {/* Colors (neon swatches) */}
          <ArcadePanel className="p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-pixel text-[10px] tracking-[0.15em] uppercase text-neon-cyan">Colors</span>
              <span className="text-[10px] text-gray-500">tap to activate</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {GAP_COLOR_IDS.map(colorId => {
                const on = active === colorId
                return (
                  <button
                    key={colorId}
                    data-color-option={colorId}
                    aria-pressed={on}
                    onClick={() => clickColor(colorId)}
                    className={`aspect-square rounded-md border-2 cursor-pointer transition p-1 ${
                      on
                        ? 'border-white shadow-[0_0_0_2px_#fff,0_0_16px_rgba(255,255,255,0.6)]'
                        : 'border-arcade-edge hover:opacity-90'
                    }`}
                  >
                    <span className={`block w-full h-full rounded-[3px] ${gapFillClass(colorId)}`} />
                  </button>
                )
              })}
            </div>
          </ArcadePanel>
        </>
      ) : (
        <ArcadePanel className="p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="font-pixel text-[10px] tracking-[0.15em] uppercase text-neon-cyan">Pieces</span>
            <span className="text-[10px] text-gray-500">tap to increment</span>
          </div>
          {orderMatters ? (
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
      )}

      <NeonButton fullWidth variant="go" onClick={submit}>
        Done ✓
      </NeonButton>
    </div>
  )
}
