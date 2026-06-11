import type { Gap, Grid } from '@shared/types'
import { gapBorderClass } from '../lib/gapPalette'

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
  /**
   * Live grid. When provided, a gap cell's outline is dropped once that cell is
   * no longer `empty` (a piece has been placed over it) — so placed pieces cover
   * the dashed border instead of it sitting on top. Omit to always draw every
   * gap's full outline (e.g. the viewing phase, where all gap cells are empty).
   */
  grid?: Grid
}

/**
 * Absolutely-positioned overlay that traces a dashed border around each gap
 * shape. Sits inside ViewingPhase's relative grid wrapper, above the Grid.
 * For each gap cell we draw only the edges that face a cell NOT in the gap, so
 * the outline hugs the tetromino silhouette rather than boxing each cell.
 */
export function GapBorder({ gaps, colorClass = 'border-neon-cyan', grid }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {gaps.map((gap, gi) => {
        const inGap = new Set(gap.cells.map(([r, c]) => `${r},${c}`))
        const borderColor = gap.color ? gapBorderClass(gap.color) : colorClass
        return (
          <div key={gi} data-gap-border>
            {gap.cells.map(([r, c]) => {
              // A placed piece now covers this cell — drop its outline so the
              // piece reads as filling the slot, not sitting under a border.
              if (grid && grid[r]?.[c]?.status !== 'empty') return null
              const edges: string[] = []
              if (!inGap.has(`${r - 1},${c}`)) edges.push('border-t-2')
              if (!inGap.has(`${r + 1},${c}`)) edges.push('border-b-2')
              if (!inGap.has(`${r},${c - 1}`)) edges.push('border-l-2')
              if (!inGap.has(`${r},${c + 1}`)) edges.push('border-r-2')
              return (
                <div
                  key={`${r},${c}`}
                  className={`absolute border-dashed ${borderColor} ${edges.join(' ')}`}
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
