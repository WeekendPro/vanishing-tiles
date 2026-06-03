// Maps a palette id (stored on Gap.color) to literal Tailwind classes.
// Kept client-side so shared logic never references Tailwind class strings.

const BORDER: Record<string, string> = {
  green: 'border-green-400',
  red: 'border-red-400',
  blue: 'border-blue-400',
  yellow: 'border-yellow-400',
  orange: 'border-orange-400',
  purple: 'border-purple-400',
  pink: 'border-pink-400',
  indigo: 'border-indigo-400',
}

const FILL: Record<string, string> = {
  green: 'bg-green-400',
  red: 'bg-red-400',
  blue: 'bg-blue-400',
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-400',
  purple: 'bg-purple-400',
  pink: 'bg-pink-400',
  indigo: 'bg-indigo-400',
}

/** Border-color class for a gap's palette id (falls back to a neutral border). */
export function gapBorderClass(id: string | undefined): string {
  return (id && BORDER[id]) || 'border-gray-300/70'
}

/** Fill (bg) class for a gap's palette id (falls back to neutral gray). */
export function gapFillClass(id: string | undefined): string {
  return (id && FILL[id]) || 'bg-gray-400'
}
