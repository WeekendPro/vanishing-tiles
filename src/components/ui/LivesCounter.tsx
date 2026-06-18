/**
 * LivesCounter — the ♥×N lives display.
 *
 * A single heart glyph plus a tabular count, replacing fixed heart rows so the
 * value can scale past the starting count (future earn-a-life reward system).
 * At 0 the whole thing dims to read as "out".
 */
export function LivesCounter({ lives, className = '' }: { lives: number; className?: string }) {
  const out = lives <= 0
  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      aria-label={`${lives} lives`}
    >
      <span
        className={`text-base leading-none ${out ? 'text-phos-faint' : 'text-phos-red text-glow-phos-red'}`}
        aria-hidden="true"
      >
        ♥
      </span>
      <span
        className={`font-mono text-sm leading-none tabular-nums ${out ? 'text-phos-faint' : 'text-phos-text'}`}
        aria-hidden="true"
      >
        ×{lives}
      </span>
    </div>
  )
}
