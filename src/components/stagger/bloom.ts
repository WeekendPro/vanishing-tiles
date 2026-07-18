import { type StaggerGap } from '../../store/staggerStore'

/** A bloom instance: one tetromino lit at a single tick, with a per-cell decay
 *  DURATION that lengthens along the board diagonal (r+c) so the four cells flash
 *  together and then wink out in a wave. Each instance animates to completion
 *  CONCURRENTLY with later ones (the overlapping cascade). `color` floods the
 *  whole bloom (EASY in piece color, MEDIUM/HARD in the branded magenta). */
export interface Bloom { id: number; color: string; cells: { key: string; holdMs: number; decayMs: number }[] }

export function bloomForGap(
  id: number, gap: StaggerGap, color: string, bloomMs: number, decayMs: number, waveMs: number,
): Bloom {
  const cells = [...gap.cells]
    .sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[1] - b[1])
    .map(([r, c], i) => ({ key: `${r},${c}`, holdMs: bloomMs, decayMs: decayMs + i * waveMs }))
  return { id, color, cells }
}
