/**
 * LivesCounter — the lives display.
 *
 * Up to the `cap` (the mode's starting lives) they read as individual hearts: a
 * filled red heart per life left, a grey "empty shell" for each one spent. Once
 * the player banks past the cap (the earn-a-life reward), the row would get
 * unwieldy, so it collapses to a compact ♥×N (heart snug against the count). At 0
 * it dims to "out".
 */
export function LivesCounter({ lives, cap = 5, className = '' }: { lives: number; cap?: number; className?: string }) {
  // Past the heart cap: collapse to a tight ♥×N.
  if (lives > cap) {
    return (
      <div className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${lives} lives`}>
        <span className="text-base leading-none text-vt-red text-glow-vt-red" aria-hidden="true">♥</span>
        <span className="font-mono text-sm leading-none tabular-nums text-vt-text" aria-hidden="true">×{lives}</span>
      </div>
    )
  }

  // Up to the cap: a row of hearts, filled for lives left, grey shell for spent.
  return (
    <div className={`inline-flex items-center gap-1 ${className}`} aria-label={`${lives} lives`}>
      {Array.from({ length: cap }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`text-base leading-none ${i < lives ? 'text-vt-red text-glow-vt-red' : 'text-vt-faint'}`}
        >
          ♥
        </span>
      ))}
    </div>
  )
}
