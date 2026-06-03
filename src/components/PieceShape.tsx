import { getRotatedCells, getPieceColor } from '@shared/engine/pieces'
import type { PieceType, Rotation } from '@shared/types'

interface Props {
  pieceType: PieceType
  rotation?: Rotation
  cellSize?: number  // px
  dim?: boolean
  colorClass?: string  // override the piece-type color (e.g. color-coded palette)
}

export function PieceShape({ pieceType, rotation = 0, cellSize = 14, dim = false, colorClass }: Props) {
  const cells = getRotatedCells(pieceType, rotation)
  const maxRow = Math.max(...cells.map(([r]) => r))
  const maxCol = Math.max(...cells.map(([, c]) => c))
  const color = colorClass ?? getPieceColor(pieceType)
  const occupied = new Set(cells.map(([r, c]) => `${r},${c}`))

  return (
    <div
      className="inline-grid"
      style={{
        gridTemplateColumns: `repeat(${maxCol + 1}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${maxRow + 1}, ${cellSize}px)`,
        gap: '2px',
        opacity: dim ? 0.4 : 1,
      }}
    >
      {Array.from({ length: (maxRow + 1) * (maxCol + 1) }, (_, i) => {
        const r = Math.floor(i / (maxCol + 1))
        const c = i % (maxCol + 1)
        return (
          <div
            key={i}
            className={occupied.has(`${r},${c}`) ? `${color} rounded-sm` : ''}
            style={{ width: cellSize, height: cellSize }}
          />
        )
      })}
    </div>
  )
}
