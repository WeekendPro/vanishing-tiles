import type { Gap } from '@shared/types'

const CELL = 28
const GAP = 2
const PAD = 12
const STEP = CELL + GAP

// Pixel offset of a cell's top-left within the Grid's padded box.
const px = (i: number) => PAD + i * STEP

interface Props {
  gaps: Gap[]
}

/**
 * Absolutely-positioned overlay that drops a small numbered badge on each gap
 * that carries an `order` (Sequential rounds). The badge sits at the gap's
 * top-left-most cell (min row, then min col). Sits inside ViewingPhase's
 * relative grid wrapper, above the Grid and GapBorder.
 */
export function GapNumbers({ gaps }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {gaps.map((gap, gi) => {
        if (gap.order === undefined) return null
        const [r, c] = [...gap.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1])[0]
        return (
          <div
            key={gi}
            data-gap-number
            className="absolute flex items-center justify-center font-pixel text-[11px]
              text-gray-900 bg-gray-100/90 rounded-full w-5 h-5 shadow"
            style={{ left: px(c) + 4, top: px(r) + 4 }}
          >
            {gap.order}
          </div>
        )
      })}
    </div>
  )
}
