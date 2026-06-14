/**
 * DifficultyMeta — a quiet one-line strip under the title that recovers the two
 * stats worth keeping from the old 2×2 card block: the worded difficulty tier
 * (with rising bars) and when the level was last played.
 */
import { difficultyLabel, difficultyPips } from '../../lib/journeyScoring'
import { relativeTime } from '../../lib/relativeTime'

export interface DifficultyMetaProps {
  gapCount: number
  /** Epoch ms of the last attempt, or null if never played. */
  lastPlayed: number | null
}

export function DifficultyMeta({ gapCount, lastPlayed }: DifficultyMetaProps) {
  const pips = difficultyPips(gapCount)
  const label = difficultyLabel(gapCount)
  const lastPlayedStr = lastPlayed ? relativeTime(new Date(lastPlayed).toISOString()) : null

  return (
    <div className="flex items-center justify-center gap-3 text-[11px]">
      <span className="inline-flex items-center gap-2">
        <span className="font-bold tracking-wider text-amber-300">{label}</span>
        <span className="flex items-end gap-[3px] h-3">
          {[0, 1, 2, 3, 4].map(i => (
            <span
              key={i}
              data-testid="difficulty-pip"
              className={`w-1.5 rounded-sm ${i < pips ? 'bg-amber-400' : 'bg-zinc-700'}`}
              style={{ height: `${8 + i * 1}px`, boxShadow: i < pips ? '0 0 5px #f59e0b' : undefined }}
            />
          ))}
        </span>
      </span>
      {lastPlayedStr && (
        <>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-500">⏱ {lastPlayedStr}</span>
        </>
      )}
    </div>
  )
}
