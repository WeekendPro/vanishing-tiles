import { useGameStore } from '../store/gameStore'
import { getPieceColor } from '@shared/engine/pieces'
import { ROWS, COLS } from '@shared/types'
import { gapFillClass } from '../lib/gapPalette'

interface Props {
  onCellClick?: (row: number, col: number) => void
  onCellHover?: (row: number, col: number) => void
  highlightCells?: [number, number][]
  /** Called with each cell's DOM node so callers can measure positions. */
  cellRef?: (row: number, col: number, el: HTMLDivElement | null) => void
}

export function Grid({ onCellClick, onCellHover, highlightCells = [], cellRef }: Props) {
  const grid = useGameStore(s => s.grid)
  const highlighted = new Set(highlightCells.map(([r, c]) => `${r},${c}`))

  return (
    <div
      className="inline-grid gap-[2px] p-3 bg-gray-900 rounded-xl"
      style={{ gridTemplateColumns: `repeat(${COLS}, 28px)` }}
    >
      {Array.from({ length: ROWS * COLS }, (_, i) => {
        const row = Math.floor(i / COLS)
        const col = i % COLS
        const cell = grid[row]?.[col]
        const isHighlight = highlighted.has(`${row},${col}`)

        let className = 'w-7 h-7 rounded-sm '
        if (cell?.status === 'filled') {
          className += 'bg-slate-600'
        } else if (cell?.status === 'placed' && cell.pieceType) {
          className += cell.color ? gapFillClass(cell.color) : getPieceColor(cell.pieceType)
        } else if (cell?.status === 'preview') {
          className += 'bg-blue-400/50 border-2 border-blue-400'
        } else if (isHighlight) {
          className += 'bg-blue-400/50 border-2 border-blue-400'
        } else {
          // empty cell
          className += 'bg-gray-800 border border-gray-600'
        }

        if (onCellClick && cell?.status === 'empty') {
          className += ' cursor-pointer hover:bg-blue-400/30'
        }

        return (
          <div
            key={i}
            ref={el => cellRef?.(row, col, el)}
            className={className}
            onClick={() => onCellClick?.(row, col)}
            onMouseEnter={() => onCellHover?.(row, col)}
          />
        )
      })}
    </div>
  )
}
