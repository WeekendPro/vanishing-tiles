import type { RoundTheme } from '../types.ts'

/** Per-theme interpretation flags for the unified selection resolver. */
export interface ThemeConfig {
  /** Sequential: the k-th pick must match the gap labelled k. (Plan 3.) */
  orderMatters: boolean
  /** Color-coded: a piece must match its gap's color as well as its shape. */
  colorMatters: boolean
}

export const THEME_CONFIG: Record<RoundTheme, ThemeConfig> = {
  basic:       { orderMatters: false, colorMatters: false },
  colorCoded:  { orderMatters: false, colorMatters: true },
  sequential:  { orderMatters: true,  colorMatters: false },
  flashMob:    { orderMatters: false, colorMatters: false },
}

/** The 5-color neon palette for color-coded gaps. Stored on gaps as plain ids so
 *  the shared logic stays free of Tailwind class strings; the client maps ids →
 *  neon classes in src/lib/gapPalette.ts. Decoupled from piece-type colors by
 *  design. (Red was dropped in favor of purple — neon-red and neon-magenta are
 *  the hardest warm pair to disambiguate under time pressure.) */
export const GAP_COLOR_IDS = [
  'cyan', 'magenta', 'green', 'purple', 'yellow',
] as const
