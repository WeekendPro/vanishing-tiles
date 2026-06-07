import { useGameStore } from '../store/gameStore'
import { getPieceColor } from '@shared/engine/pieces'
import { ROWS, COLS } from '@shared/types'
import { gapFillClass } from '../lib/gapPalette'

// R&D toggle for the board look. 'classic' = solid gray tiles (original);
// 'empty' = faint lattice with no real tiles, so only the dashed gaps read.
// Flip this constant to A/B the two while we evaluate the empty-board design.
const BOARD_STYLE: 'classic' | 'empty' = 'empty'

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
          className += BOARD_STYLE === 'empty' ? 'bg-slate-800/50' : 'bg-slate-600'
        } else if (cell?.status === 'placed' && cell.pieceType) {
          className += cell.color ? gapFillClass(cell.color) : getPieceColor(cell.pieceType)
        } else if (cell?.status === 'preview') {
          className += 'bg-blue-400/50 border-2 border-blue-400'
        } else if (isHighlight) {
          className += 'bg-blue-400/50 border-2 border-blue-400'
        } else {
          // empty cell (gap) — render as a TRUE hole: no fill, no per-cell border.
          // A multi-cell gap then reads as one empty region defined solely by the
          // dashed GapBorder silhouette, instead of N visible blocks that look like
          // dark placed pieces. (The dark grid background shows through.)
          className += 'bg-transparent'
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
