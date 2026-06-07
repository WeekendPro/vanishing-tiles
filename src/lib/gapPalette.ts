// Maps a palette id (stored on Gap.color) to literal Tailwind classes.
// Kept client-side so shared logic never references Tailwind class strings.

// Eight maximally-distinct hues for color-coded rounds. The goal is recall, not
// trickery — so adjacent families (red/orange, purple/pink) are split across
// lightness TIERS (500 vs 400) as well as hue, and the old indigo (a near-twin of
// blue) is replaced by cyan to open up the cool end of the wheel. Keep BORDER and
// FILL on the same tier per id so a gap's dashed outline matches its filled piece.
const BORDER: Record<string, string> = {
  red: 'border-red-500',
  orange: 'border-orange-400',
  yellow: 'border-yellow-300',
  green: 'border-green-500',
  cyan: 'border-cyan-400',
  blue: 'border-blue-500',
  purple: 'border-purple-500',
  pink: 'border-pink-400',
}

const FILL: Record<string, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-400',
  yellow: 'bg-yellow-300',
  green: 'bg-green-500',
  cyan: 'bg-cyan-400',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-400',
}

/** Border-color class for a gap's palette id (falls back to a neutral border). */
export function gapBorderClass(id: string | undefined): string {
  return (id && BORDER[id]) || 'border-gray-300/70'
}

/** Fill (bg) class for a gap's palette id (falls back to neutral gray). */
export function gapFillClass(id: string | undefined): string {
  return (id && FILL[id]) || 'bg-gray-400'
}
