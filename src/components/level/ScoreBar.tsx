/**
 * ScoreBar — the level's running total as a thick neon fill. A faint hatched
 * "ghost track" reaches the world record (🏆) so the bar shows what's left to
 * chase, and a yellow tick marks the 65% unlock benchmark for the next level.
 * Replaces the old star row.
 */
import { LEVEL_MAX, LEVEL_UNLOCK_RATIO } from '../../lib/journeyScoring'

export interface ScoreBarProps {
  /** Sum of best-per-puzzle (0..max). */
  total: number
  /** Points that constitute a full bar (default 500). */
  max?: number
  /** Fraction at which the next level unlocks (default 0.65). */
  unlockRatio?: number
  /** World-record total, in points (drives the ghost track + 🏆). */
  worldRecord?: number | null
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n))

export function ScoreBar({ total, max = LEVEL_MAX, unlockRatio = LEVEL_UNLOCK_RATIO, worldRecord }: ScoreBarProps) {
  const pct = clampPct((total / max) * 100)
  const unlockPct = clampPct(unlockRatio * 100)
  const wrPct = worldRecord != null ? clampPct((worldRecord / max) * 100) : null

  return (
    <div data-testid="score-bar">
      <div className="relative pt-5">
        {/* Unlock flag, above the bar */}
        <div
          className="absolute top-0 text-[8px] font-pixel whitespace-nowrap text-neon-yellow text-glow-yellow"
          style={{ left: `${unlockPct}%`, transform: 'translateX(-50%)' }}
        >
          🔓 UNLOCK
        </div>

        <div className="h-5 rounded-full bg-arcade-well shadow-panel-inset overflow-hidden relative">
          {/* Ghost track to the world record */}
          {wrPct != null && (
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${wrPct}%`, background: 'repeating-linear-gradient(90deg,#fbbf2422 0 6px,#fbbf240d 6px 12px)' }}
            />
          )}
          {/* Your fill */}
          <div
            className="h-full rounded-full relative transition-[width] duration-500"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#0891b2,#22d3ee 70%,#67e8f9)', boxShadow: '0 0 10px #22d3ee99' }}
          />
          {/* Unlock tick */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-neon-yellow"
            style={{ left: `${unlockPct}%`, boxShadow: '0 0 6px #facc15' }}
          />
          {/* World-record cap */}
          {wrPct != null && (
            <div className="absolute top-0 bottom-0 flex items-center text-[11px]" style={{ left: `${wrPct}%`, transform: 'translateX(-50%)' }}>
              🏆
            </div>
          )}
        </div>
      </div>

      <div className="text-right text-sm font-pixel mt-1">
        <span className="text-neon-cyan text-glow-cyan">{Math.round(pct)}%</span>
      </div>
    </div>
  )
}
