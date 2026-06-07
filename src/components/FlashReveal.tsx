import { useEffect, useRef, useState } from 'react'
import type { Gap } from '@shared/types'
import { PieceShape } from './PieceShape'

const ON_MS = 700
const OFF_MS = 300

interface Props {
  gaps: Gap[]
  onComplete: () => void
}

/**
 * Flash Mob viewing: NO board. Each gap's tetromino shape flashes ONCE,
 * centered on screen — 700ms on / 300ms off — in a SINGLE PASS (no loop),
 * iterating the gaps in order. When the pass completes, `onComplete` fires
 * (the store's endViewing) to advance to selecting. Not skippable: there is no
 * Ready button. Purely presentational + a timed sequence; the only side effect
 * is the single final onComplete call.
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

  return (
    <div
      data-flash-reveal
      className="flex flex-col items-center justify-center"
      style={{ width: 382, height: 382 }}
    >
      <p className="font-pixel text-[10px] tracking-[0.15em] uppercase text-neon-cyan mb-6">
        Watch the flash
      </p>
      <div className="flex items-center justify-center" style={{ width: 200, height: 200 }}>
        {current && on && (
          <PieceShape
            pieceType={current.pieceType}
            rotation={current.rotation}
            cellSize={40}
          />
        )}
      </div>
    </div>
  )
}
