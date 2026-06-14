/**
 * Per-puzzle visual identity for the level hub (emblem accent, banner, shield
 * interior, and center glyph). The Classic is just another puzzle — every
 * component carries equal weight here.
 */
/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import type { ComponentKey } from '../../lib/components'
import {
  ClassicTetrominoGlyph, ColorQuadGlyph, SequenceBlocksGlyph, EyesGlyph, RiddleGlyph, BADGE_CENTER_BG,
} from './badgeGlyphs'

export interface PuzzleTheme {
  /** Neon accent (border, pill, score bar). */
  accent: string
  /** Banner fill behind the title. */
  banner: string
  /** Shield interior background. */
  shieldBg: string
  /** Center emblem glyph. */
  glyph: ReactNode
  /** One-line "how to play" caption under the demo. */
  note: string
}

export const PUZZLE_THEME: Record<ComponentKey, PuzzleTheme> = {
  main: {
    accent: '#22d3ee', banner: '#0e7490', shieldBg: BADGE_CENTER_BG.classic,
    glyph: <ClassicTetrominoGlyph />,
    note: 'Memorize the gaps, then pick the pieces that fill them.',
  },
  colors: {
    accent: '#ff2d95', banner: '#9d174d', shieldBg: BADGE_CENTER_BG.quad,
    glyph: <ColorQuadGlyph />,
    note: 'Match each gap by shape and color.',
  },
  inSequence: {
    accent: '#f59e0b', banner: '#b45309', shieldBg: BADGE_CENTER_BG.seq,
    glyph: <SequenceBlocksGlyph />,
    note: 'Fill the gaps in numbered order: 1 → 2 → 3.',
  },
  flash: {
    accent: '#39d98a', banner: '#15803d', shieldBg: BADGE_CENTER_BG.eyes,
    glyph: <EyesGlyph />,
    note: 'The board flashes once. Blink and you miss it.',
  },
  riddle: {
    accent: '#2dd4bf', banner: '#0f766e', shieldBg: BADGE_CENTER_BG.riddle,
    glyph: <RiddleGlyph />,
    note: 'A new kind of puzzle. Coming soon.',
  },
}
