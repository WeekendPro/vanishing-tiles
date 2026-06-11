// Maps a palette id (stored on Gap.color) to literal Tailwind classes.
// Kept client-side so shared logic never references Tailwind class strings.

// Five neon hues for color-coded rounds, drawn from the arcade brand palette
// (see tailwind.config.js). The goal is recall, not trickery — so the set spans
// the wheel (cool cyan, pink magenta, green, violet purple, warm yellow) and
// deliberately omits a neon red, whose closeness to magenta made the warm pair
// hard to tell apart under time pressure. Keep BORDER and FILL on the same hex
// per id so a gap's dashed outline matches its filled piece.
const BORDER: Record<string, string> = {
  cyan: 'border-[#22d3ee]',
  magenta: 'border-[#ff2d95]',
  green: 'border-[#39d98a]',
  purple: 'border-[#a855f7]',
  yellow: 'border-[#facc15]',
}

const FILL: Record<string, string> = {
  cyan: 'bg-[#22d3ee]',
  magenta: 'bg-[#ff2d95]',
  green: 'bg-[#39d98a]',
  purple: 'bg-[#a855f7]',
  yellow: 'bg-[#facc15]',
}

/** Border-color class for a gap's palette id (falls back to a neutral border). */
export function gapBorderClass(id: string | undefined): string {
  return (id && BORDER[id]) || 'border-gray-300/70'
}

/** Fill (bg) class for a gap's palette id (falls back to neutral gray). */
export function gapFillClass(id: string | undefined): string {
  return (id && FILL[id]) || 'bg-gray-400'
}
