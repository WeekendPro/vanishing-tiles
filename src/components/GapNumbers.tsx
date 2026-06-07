import type { Gap } from '@shared/types'

const CELL = 28
const GAP = 2
const PAD = 12
const STEP = CELL + GAP

interface Props {
  gaps: Gap[]
}

/**
 * Absolutely-positioned overlay that drops a small numbered badge on each gap
 * that carries an `order` (Sequential rounds). The badge is centered on the
 * gap's bounding-box center (the middle of the tetromino region) and translated
 * by -50%/-50% so it reads as sitting in the middle of the gap, never offset to
 * a corner. Sits inside ViewingPhase's relative grid wrapper, above the Grid and
 * GapBorder; a high z-index + opaque pill keep it legible over the dashed
 * silhouette.
 */
export function GapNumbers({ gaps }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {gaps.map((gap, gi) => {
        if (gap.order === undefined) return null
        // Bounding-box center of the gap's cells, in cell-index space. Adding 0.5
        // shifts from a cell's top-left to its center before averaging.
        const rows = gap.cells.map(([r]) => r)
        const cols = gap.cells.map(([, c]) => c)
        const centerRow = (Math.min(...rows) + Math.max(...rows)) / 2 + 0.5
        const centerCol = (Math.min(...cols) + Math.max(...cols)) / 2 + 0.5
        return (
          <div
            key={gi}
            data-gap-number
            className="absolute z-10 flex items-center justify-center font-pixel text-[11px]
              text-gray-900 bg-gray-100/90 rounded-full w-5 h-5 shadow -translate-x-1/2 -translate-y-1/2"
            style={{ left: PAD - GAP / 2 + centerCol * STEP, top: PAD - GAP / 2 + centerRow * STEP }}
          >
            {gap.order}
          </div>
        )
      })}
    </div>
  )
}
