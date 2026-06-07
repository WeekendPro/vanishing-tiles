import { useEffect, useRef, useState } from 'react'
import { getRotatedCells } from '@shared/engine/pieces'
import type { Gap } from '@shared/types'

const ON_MS = 700
const OFF_MS = 300

interface Props {
  gaps: Gap[]
  onComplete: () => void
}

/**
 * Renders a single gap's tetromino as an empty, dashed silhouette (no piece
 * color) — the same "hole" look the board uses for gaps. Each occupied cell is a
 * faint hollow with a dashed neon-cyan outline; non-occupied cells in the
 * bounding box are blank so the shape reads as a gap, not a colored piece.
 */
function GapSilhouette({ gap, cellSize }: { gap: Gap; cellSize: number }) {
  const cells = getRotatedCells(gap.pieceType, gap.rotation)
  const maxRow = Math.max(...cells.map(([r]) => r))
  const maxCol = Math.max(...cells.map(([, c]) => c))
  const occupied = new Set(cells.map(([r, c]) => `${r},${c}`))

  return (
    <div
      className="inline-grid"
      style={{
        gridTemplateColumns: `repeat(${maxCol + 1}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${maxRow + 1}, ${cellSize}px)`,
        gap: '2px',
      }}
    >
      {Array.from({ length: (maxRow + 1) * (maxCol + 1) }, (_, i) => {
        const r = Math.floor(i / (maxCol + 1))
        const c = i % (maxCol + 1)
        const isGap = occupied.has(`${r},${c}`)
        return (
          <div
            key={i}
            className={
              isGap
                ? 'rounded-sm border-2 border-dashed border-neon-cyan bg-neon-cyan/10'
                : ''
            }
            style={{ width: cellSize, height: cellSize }}
          />
        )
      })}
    </div>
  )
}

/**
 * Carousel-style progress indicator: one dot per gap, in flash order. A dot is
 * hollow (outline only) until its gap has been flashed, then becomes filled.
 * `flashedCount` = how many gaps have fully flashed so far.
 */
function FlashDots({ total, flashedCount }: { total: number; flashedCount: number }) {
  return (
    <div
      data-flash-dots
      className="flex items-center justify-center gap-2"
      aria-label={`${flashedCount} of ${total} flashed`}
    >
      {Array.from({ length: total }, (_, i) => {
        const filled = i < flashedCount
        return (
          <span
            key={i}
            data-flash-dot
            data-filled={filled}
            className={
              'w-2.5 h-2.5 rounded-full border-2 border-neon-cyan transition-colors ' +
              (filled ? 'bg-neon-cyan shadow-neon-cyan' : 'bg-transparent')
            }
          />
        )
      })}
    </div>
  )
}

/**
 * Flash Mob viewing: NO board. Each gap's tetromino SILHOUETTE (an empty dashed
 * shape — what the board renders for a gap, NOT a colored piece) flashes ONCE,
 * centered on screen — 700ms on / 300ms off — in a SINGLE PASS (no loop),
 * iterating the gaps in order. A carousel of dots along the bottom third tracks
 * how many gaps exist and how far the reveal has progressed. When the pass
 * completes, `onComplete` fires (the store's endViewing) to advance to
 * selecting. Not skippable: there is no Ready button. Purely presentational + a
 * timed sequence; the only side effect is the single final onComplete call.
 */
export function FlashReveal({ gaps, onComplete }: Props) {
  // -1 = before first flash; 0..N-1 = showing gaps[index]; N = done.
  const [index, setIndex] = useState(0)
  const [on, setOn] = useState(true)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (gaps.length === 0) {
      const t = setTimeout(() => onCompleteRef.current(), OFF_MS)
      return () => clearTimeout(t)
    }
    if (index >= gaps.length) {
      onCompleteRef.current()
      return
    }
    // Show the current shape (ON), then blank it (OFF), then advance.
    setOn(true)
    const onTimer = setTimeout(() => setOn(false), ON_MS)
    const advanceTimer = setTimeout(() => setIndex(i => i + 1), ON_MS + OFF_MS)
    return () => {
      clearTimeout(onTimer)
      clearTimeout(advanceTimer)
    }
  }, [index, gaps.length])

  const current = index >= 0 && index < gaps.length ? gaps[index] : null
  // A gap counts as "flashed" once we've advanced past it (index moved on). The
  // currently-showing gap fills the moment it appears so the dot tracks the reveal.
  const flashedCount = Math.min(gaps.length, on && current ? index + 1 : index)

  return (
    <div
      data-flash-reveal
      className="flex flex-col items-center justify-between"
      style={{ width: 382, height: 382 }}
    >
      <p className="font-pixel text-[10px] tracking-[0.15em] uppercase text-neon-cyan mt-2">
        Watch the flash
      </p>
      <div className="flex items-center justify-center" style={{ width: 200, height: 200 }}>
        {current && on && <GapSilhouette gap={current} cellSize={40} />}
      </div>
      {/* Bottom third: the carousel progress dots. */}
      <div className="flex items-end justify-center pb-4" style={{ height: 64 }}>
        <FlashDots total={gaps.length} flashedCount={flashedCount} />
      </div>
    </div>
  )
}
