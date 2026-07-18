import { type Difficulty } from '../../store/settingsStore'
import { type PieceType } from '@shared/types'

/** Reveal-bloom flood color per piece type (hex of each piece's Tailwind class —
 *  I=cyan-400, O=yellow-400, T=purple-500, S=green-400, Z=red-500, J=blue-500,
 *  L=orange-400). On EASY, gaps bloom in their own piece color during reveal
 *  so the player can track shape AND color, easing the memory load — and the
 *  EASY recall tray uses these same piece colors. */
export const PIECE_BLOOM_HEX: Record<PieceType, string> = {
  I: '#22d3ee', O: '#facc15', T: '#a855f7', S: '#4ade80', Z: '#ef4444', J: '#3b82f6', L: '#fb923c',
}

/** The uniform branded pink MEDIUM floods (the signature Afterglow magenta —
 *  shape only, no colour crutch). MEDIUM's whole palette — reveal, recall tray,
 *  placed pieces — is this one pink; only EASY keeps per-piece colors. */
export const REVEAL_MAGENTA = '#FF2D9B'

/** HARD's graphite "impasto" sludge — the soft cool-grey the surface lifts
 *  toward at the tray flash peak (the resting surface itself is the static
 *  `.vt-paint-surface` gradient; the reveal is the animated `.vt-paint`). HARD's
 *  whole palette is this one sludge — deliberately harder to read than pink. */
export const HARD_SLUDGE_LIFT = '#5b6172'

/** Per-mode surface class for a recall-tray piece / placed board cell.
 *  EASY → undefined (PieceShape falls back to the piece's own color); MEDIUM →
 *  uniform pink; HARD → the graphite impasto sludge. */
export function monoSurfaceClass(mode: Difficulty): string | undefined {
  return mode === 'easy' ? undefined : mode === 'medium' ? 'bg-vt-magenta' : 'vt-paint-surface'
}

/** The color the tray bloom-in/decay animation flashes THROUGH for a piece:
 *  its own color on EASY, pink on MEDIUM, a soft graphite lift on HARD. */
export function monoBloomVar(mode: Difficulty, piece: PieceType): string {
  return mode === 'easy' ? PIECE_BLOOM_HEX[piece] : mode === 'medium' ? REVEAL_MAGENTA : HARD_SLUDGE_LIFT
}
