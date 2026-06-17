import type { DifficultyConfig } from '@shared/types'

/**
 * Infinite Stagger's own difficulty + scoring curve. The run is endless, so the
 * curve is a *formula* of the 0-based batch index rather than a finite table
 * (cf. The Classic's DIFFICULTY_TABLE). Early batches are generous — both the
 * gap count and the per-gap reveal hold tighten as the run escalates.
 */
export const STAGGER = {
  MAX_GAPS: 12,        // cap so the 12×12 board stays solvable
  START_HOLD: 720,     // ms a gap holds on screen at batch 0 (~1.12s/gap with fades)
  MIN_HOLD: 260,       // floor on the hold (~0.66s/gap at the top)
  HOLD_STEP: 38,       // ms shaved off the hold per batch
  FADE_MS: 200,        // fade-in / fade-out duration (constant)
  SELECT_BASE: 6000,   // ms base select clock
  SELECT_PER_GAP: 1400,// ms of select clock added per gap
  ACCURACY_PER_GAP: 100, // points banked per correctly recalled gap
  SPEED_MAX: 500,      // max per-batch speed bonus
  START_LIVES: 3,      // shared lives for the whole run
} as const

/** Gap count climbs 3,3,4,4,5,5,… capped at MAX_GAPS. */
export function gapCountForBatch(batchIndex: number): number {
  return Math.min(STAGGER.MAX_GAPS, 3 + Math.floor(batchIndex / 2))
}

/** On-screen hold per gap, shrinking with the batch index down to MIN_HOLD. */
export function holdMsForBatch(batchIndex: number): number {
  return Math.max(STAGGER.MIN_HOLD, STAGGER.START_HOLD - batchIndex * STAGGER.HOLD_STEP)
}

/** Total visible time for one gap: fade-in + hold + fade-out. */
export function gapRevealMs(batchIndex: number): number {
  return STAGGER.FADE_MS + holdMsForBatch(batchIndex) + STAGGER.FADE_MS
}

/** Select clock grows with the gap count so picking is never the bottleneck. */
export function selectDurationForBatch(batchIndex: number): number {
  return STAGGER.SELECT_BASE + gapCountForBatch(batchIndex) * STAGGER.SELECT_PER_GAP
}

/** Mirrors The Classic's complexity bands (simple ≤5 / medium ≤8 / complex). */
export function complexityForGapCount(gapCount: number): DifficultyConfig['complexity'] {
  if (gapCount <= 5) return 'simple'
  if (gapCount <= 8) return 'medium'
  return 'complex'
}

/** Build the DifficultyConfig the puzzle generator expects for a given batch.
 *  view/place durations are unused by Stagger (reveal is its own sequence). */
export function difficultyForBatch(batchIndex: number): DifficultyConfig {
  const gapCount = gapCountForBatch(batchIndex)
  return {
    gapCount,
    complexity: complexityForGapCount(gapCount),
    viewDuration: 0,
    selectDuration: selectDurationForBatch(batchIndex),
    placeDuration: 0,
  }
}

/** Per-batch speed bonus = SPEED_MAX × fraction of the select clock left when the
 *  final gap was filled (the same ratio-based model the rest of the game uses). */
export function batchSpeedBonus(remainingMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0
  const ratio = Math.max(0, Math.min(1, remainingMs / durationMs))
  return Math.round(STAGGER.SPEED_MAX * ratio)
}
