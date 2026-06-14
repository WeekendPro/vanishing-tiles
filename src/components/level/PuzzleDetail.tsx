/**
 * PuzzleDetail — the panel under the focused emblem. Deliberately lean: the
 * instruction animation, the puzzle's own score bar, and a PLAY button. The
 * title lives on the emblem, so it's intentionally absent here.
 */
import type { ComponentKey } from '../../lib/components'
import { isPlayable } from '../../lib/components'
import { HowToAnimation } from '../briefing/HowToAnimation'
import { PUZZLE_THEME } from './puzzleTheme'

export interface PuzzleDetailProps {
  component: ComponentKey
  /** Best score for this puzzle (0..100). */
  score: number
  onPlay: () => void
}

export function PuzzleDetail({ component, score, onPlay }: PuzzleDetailProps) {
  const t = PUZZLE_THEME[component]
  const playable = isPlayable(component)

  return (
    <div
      data-testid={`puzzle-detail-${component}`}
      className="rounded-2xl border bg-arcade-panel p-4"
      style={{ borderColor: `${t.accent}55`, boxShadow: `0 0 18px ${t.accent}22, inset 0 0 14px rgba(0,0,0,.6)` }}
    >
      {/* Instruction demo (real per-puzzle animation), or a soon placeholder for Riddle */}
      <div className="rounded-xl border border-arcade-edge bg-[#0a141a] shadow-panel-inset grid place-items-center py-3">
        {playable ? (
          <HowToAnimation component={component} />
        ) : (
          <div className="h-[170px] grid place-items-center text-center px-6">
            <div>
              <div className="text-3xl mb-2">🧩</div>
              <p className="text-zinc-400 text-sm leading-snug">{t.note}</p>
            </div>
          </div>
        )}
      </div>

      {/* This puzzle's score as a bar (hidden for the unplayable placeholder) */}
      {playable && (
        <div className="mt-3 h-2.5 rounded-full bg-arcade-well shadow-panel-inset overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: `linear-gradient(90deg,${t.accent}88,${t.accent})`, boxShadow: `0 0 8px ${t.accent}` }}
          />
        </div>
      )}

      <button
        data-testid={`puzzle-play-${component}`}
        disabled={!playable}
        onClick={playable ? onPlay : undefined}
        className="w-full mt-3 py-3 rounded-xl font-pixel text-[11px] tracking-wider transition active:translate-y-px disabled:cursor-not-allowed"
        style={
          playable
            ? { color: '#04121a', background: `linear-gradient(180deg,#fff,${t.accent})`, boxShadow: `0 0 16px ${t.accent}88` }
            : { color: '#52525b', background: 'rgba(255,255,255,0.05)' }
        }
      >
        {playable ? '▶ PLAY' : 'SOON'}
      </button>
    </div>
  )
}
