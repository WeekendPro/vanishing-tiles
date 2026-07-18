import { type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { ROWS, COLS, type PieceType } from '@shared/types'
import { getPieceColor } from '@shared/engine/pieces'
import { type StaggerGap } from '../../store/staggerStore'
import { type Difficulty } from '../../store/settingsStore'
import { CELL } from './constants'
import { PIECE_BLOOM_HEX, REVEAL_MAGENTA, monoSurfaceClass } from './palette'

// ── Board ─────────────────────────────────────────────────────────────────────
// The Vanishing Tiles board is the dark VOID throughout (.vt-dim) — gaps are concealed
// within one uniform near-black field, never a readable hole. A gap is only ever
// exposed by a live BLOOM: the whole tetromino's cells get .vt-bloom at the same
// tick, flood a color (the gap's PIECE COLOR on EASY, the branded magenta on
// MEDIUM/HARD via --bloom-color), then decay along a luminous ghost tail back to the
// void — fading away in a WAVE (each cell sets its own duration + delay). Filled/
// placed gaps light out of the dark in the mode's own surface (EASY piece color,
// MEDIUM pink, HARD graphite sludge), ringed with a soft glow.
export function StaggerBoard({
  gaps, bloomByCell, mode,
}: {
  gaps: StaggerGap[]
  bloomByCell: Map<string, { id: number; holdMs: number; decayMs: number; color: string }>
  mode: Difficulty
}) {
  const colorByCell = new Map<string, PieceType>()
  gaps.forEach(g => {
    if (g.filled) g.cells.forEach(([r, c]) => colorByCell.set(`${r},${c}`, g.pieceType))
  })

  return (
    <div
      className="inline-grid gap-[2px] p-3 bg-[#04040a] rounded-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_2px_6px_#000]"
      style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL}px)` }}
    >
      {Array.from({ length: ROWS * COLS }, (_, i) => {
        const r = Math.floor(i / COLS)
        const c = i % COLS
        const key = `${r},${c}`
        const piece = colorByCell.get(key)
        if (piece) {
          // A placed gap rests in EXACTLY the look it bloomed in during memorize:
          // the mode's own surface lit by its OWN colored afterglow — never a
          // white ring/edge (that stray grey border read as "still selected" and
          // never appeared in the reveal). EASY = piece color, MEDIUM = pink, both
          // with a soft same-color glow (the bloom's resting glow); HARD = the flat
          // deep-ink sludge, self-lit with no glow, matching its murky reveal (its
          // vt-paint-surface carries only the faint hairline HARD needs to stay
          // legible in the tray and as a placed confirmation).
          const surface = mode === 'easy' ? getPieceColor(piece) : monoSurfaceClass(mode)
          const glow = mode === 'easy' ? PIECE_BLOOM_HEX[piece] : mode === 'medium' ? REVEAL_MAGENTA : null
          return (
            <motion.div
              key={i}
              initial={{ scale: 0.5, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`w-7 h-7 rounded-sm ${surface}`}
              style={glow ? { boxShadow: `0 0 8px ${glow}` } : undefined}
            />
          )
        }
        // Uniform dark void; a blooming gap's cells all flash at once then decay
        // back to the void in a wave (per-cell duration). Past blooms stay mounted
        // and keep decaying — keyed by their instance id — so they overlap.
        const bloom = bloomByCell.get(key)
        if (bloom) {
          // HARD: the Severance graphite "impasto" bloom — self-colored murk
          // (no --bloom-color) that flashes bright, settles to sludge, then
          // decays. One timeline per cell (hold+decay as the animation-duration),
          // so later cells still fade out in the diagonal wave.
          if (mode === 'hard') {
            return (
              <div
                key={`${i}-bloom-${bloom.id}`}
                className="w-7 h-7 rounded-sm vt-paint"
                style={{ animationDuration: `${bloom.holdMs + bloom.decayMs}ms` } as CSSProperties}
              />
            )
          }
          // EASY/MEDIUM flood --bloom-color (.vt-bloom): piece color on EASY,
          // the branded magenta on MEDIUM.
          return (
            <div
              key={`${i}-bloom-${bloom.id}`}
              className="w-7 h-7 rounded-sm vt-bloom"
              style={{
                animationDuration: `${bloom.holdMs}ms, ${bloom.decayMs}ms`,
                animationDelay: `0ms, ${bloom.holdMs}ms`,
                ['--bloom-color']: bloom.color,
              } as CSSProperties}
            />
          )
        }
        return <div key={i} className="w-7 h-7 rounded-sm vt-dim" />
      })}
    </div>
  )
}
