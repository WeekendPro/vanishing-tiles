/**
 * The signature brand motif: a 4×4 mini-board where two tetromino-shaped clusters
 * bloom magenta and then VANISH on staggered, out-of-phase timers — the name
 * demonstrating itself. Pure CSS (`vt-vanish` keyframe in index.css); no game
 * state. Used as the hero above the wordmark on the Auth + Home screens.
 *
 * Each entry is a lit cell's `animation-delay` in seconds (so the two clusters
 * bloom out of phase), or `null` for a dead surface cell.
 */
const VANISH_CELLS: (number | null)[] = [
  null, 0,   0,   null,
  0.2,  0.2, null, null,
  null, null, 2.4, null,
  null, 2.6, 2.6, 2.6,
]

export function VanishingMotif({ className = '' }: { className?: string }) {
  return (
    <div className={`grid w-fit grid-cols-[repeat(4,16px)] gap-[3px] ${className}`} aria-hidden="true">
      {VANISH_CELLS.map((delay, i) => (
        <span
          key={i}
          className={`w-4 h-4 rounded-[3px] ${delay === null ? 'bg-vt-raised' : 'vt-vanish'}`}
          style={delay === null ? undefined : { animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  )
}
