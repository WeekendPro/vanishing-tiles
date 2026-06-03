import type { Gap } from '@shared/types'

const CELL = 28
const GAP = 2
const PAD = 12
const STEP = CELL + GAP

// Pixel offset of a cell's top-left within the Grid's padded box.
const px = (i: number) => PAD + i * STEP

interface Props {
  gaps: Gap[]
  /** Tailwind border color class for the dashed outline (monochrome by default). */
  colorClass?: string
}

/**
 * Absolutely-positioned overlay that traces a dashed border around each gap
 * shape. Sits inside ViewingPhase's relative grid wrapper, above the Grid.
 * For each gap cell we draw only the edges that face a cell NOT in the gap, so
 * the outline hugs the tetromino silhouette rather than boxing each cell.
 */
export function GapBorder({ gaps, colorClass = 'border-gray-300/70' }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {gaps.map((gap, gi) => {
        const inGap = new Set(gap.cells.map(([r, c]) => `${r},${c}`))
        return (
          <div key={gi} data-gap-border>
            {gap.cells.map(([r, c]) => {
              const edges: string[] = []
              if (!inGap.has(`${r - 1},${c}`)) edges.push('border-t-2')
              if (!inGap.has(`${r + 1},${c}`)) edges.push('border-b-2')
              if (!inGap.has(`${r},${c - 1}`)) edges.push('border-l-2')
              if (!inGap.has(`${r},${c + 1}`)) edges.push('border-r-2')
              return (
                <div
                  key={`${r},${c}`}
                  className={`absolute border-dashed ${colorClass} ${edges.join(' ')}`}
                  style={{ left: px(c), top: px(r), width: CELL, height: CELL }}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
