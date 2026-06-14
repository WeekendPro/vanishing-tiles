/**
 * PuzzleDeck — the focused emblem with its two neighbors peeking in from the
 * sides (so it's obvious there's more to swipe), chevrons, dots, and the detail
 * panel for whichever puzzle is in focus. Owns the active index.
 */
import { useState } from 'react'
import type { ComponentKey } from '../../lib/components'
import { PuzzleEmblem } from './PuzzleEmblem'
import { PuzzleDetail } from './PuzzleDetail'
import { PUZZLE_THEME } from './puzzleTheme'
import './level.css'

export interface DeckPuzzle {
  component: ComponentKey
  label: string
  score: number
  soon: boolean
}

export interface PuzzleDeckProps {
  puzzles: DeckPuzzle[]
  onPlay: (component: ComponentKey) => void
}

const PEEK_X = 95 // px offset of each peeking neighbor from center

export function PuzzleDeck({ puzzles, onPlay }: PuzzleDeckProps) {
  const [active, setActive] = useState(0)
  const n = puzzles.length
  const go = (i: number) => setActive(((i % n) + n) % n)

  // Each visible slot: the active emblem and its immediate neighbors.
  const slots = puzzles
    .map((p, idx) => ({ p, idx }))
    .filter(({ idx }) => {
      const d = ((idx - active + n) % n)
      return d === 0 || d === 1 || d === n - 1
    })

  return (
    <div>
      <div className="relative h-[176px] flex items-center justify-center">
        {slots.map(({ p, idx }) => {
          const d = (idx - active + n) % n
          const isActive = d === 0
          const dir = d === 1 ? 1 : -1 // n-1 → left
          const transform = isActive
            ? 'translateX(0) scale(1.18)'
            : `translateX(${dir * PEEK_X}px) scale(.7)`
          return (
            <button
              key={p.component}
              type="button"
              aria-label={p.label}
              onClick={() => go(idx)}
              className="deck-item absolute"
              style={{ transform, opacity: isActive ? 1 : 0.4, zIndex: isActive ? 10 : 5 }}
            >
              <PuzzleEmblem
                component={p.component}
                label={p.label}
                score={p.score}
                showPill={isActive}
                soon={p.soon}
              />
            </button>
          )
        })}

        <button
          type="button" aria-label="Previous puzzle" onClick={() => go(active - 1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-8 h-12 grid place-items-center text-neon-cyan text-3xl"
        >
          ‹
        </button>
        <button
          type="button" aria-label="Next puzzle" onClick={() => go(active + 1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-8 h-12 grid place-items-center text-neon-cyan text-3xl"
        >
          ›
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 my-3">
        {puzzles.map((p, idx) => {
          const accent = PUZZLE_THEME[p.component].accent
          const on = idx === active
          return (
            <span
              key={p.component}
              className="w-2 h-2 rounded-full transition"
              style={{ background: on ? accent : '#334155', boxShadow: on ? `0 0 6px ${accent}` : undefined }}
            />
          )
        })}
      </div>

      <PuzzleDetail
        component={puzzles[active].component}
        score={puzzles[active].score}
        onPlay={() => onPlay(puzzles[active].component)}
      />
    </div>
  )
}
