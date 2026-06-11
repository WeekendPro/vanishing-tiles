import type { PieceType } from '@shared/types'

export interface MorphPiece {
  pieceType: PieceType
  color?: string
}

/**
 * One chip's fate in the Game Over "your picks → the answer" morph:
 * - keep   — their pick was correct (stays, flagged green)
 * - flip   — a wrong pick flips into a piece the answer still needs
 * - add    — a piece the answer needs that they never picked (flies in)
 * - remove — an extra/leftover wrong pick (✕ and dissolves)
 * The keep+flip+add chips together ARE the answer; removes trail and vanish.
 */
export type MorphOp =
  | { kind: 'keep'; to: MorphPiece }
  | { kind: 'flip'; from: MorphPiece; to: MorphPiece }
  | { kind: 'add'; to: MorphPiece }
  | { kind: 'remove'; from: MorphPiece }

const same = (a: MorphPiece, b: MorphPiece) =>
  a.pieceType === b.pieceType && (a.color ?? null) === (b.color ?? null)

/**
 * Diff the player's picks against the correct answer for the Game Over reveal.
 * Handles any count mismatch: exact matches keep, the rest pair wrong→missing as
 * flips, then leftover missing pieces add and leftover wrong picks remove.
 */
export function computeMorph(player: MorphPiece[], answer: MorphPiece[]): MorphOp[] {
  const left = player.map(p => ({ p, used: false }))
  const ops: MorphOp[] = []
  const unmatched: MorphPiece[] = []

  // Pass 1 — exact matches keep (claim a player chip so duplicates pair 1:1).
  for (const a of answer) {
    const m = left.find(x => !x.used && same(x.p, a))
    if (m) { m.used = true; ops.push({ kind: 'keep', to: a }) }
    else unmatched.push(a)
  }

  // Pass 2 — pair remaining wrong picks with still-missing answers as flips.
  const wrong = left.filter(x => !x.used).map(x => x.p)
  let wi = 0
  let ai = 0
  for (; ai < unmatched.length && wi < wrong.length; ai++, wi++) {
    ops.push({ kind: 'flip', from: wrong[wi], to: unmatched[ai] })
  }
  // Leftover missing answers fly in; leftover wrong picks dissolve.
  for (; ai < unmatched.length; ai++) ops.push({ kind: 'add', to: unmatched[ai] })
  for (; wi < wrong.length; wi++) ops.push({ kind: 'remove', from: wrong[wi] })

  return ops
}
