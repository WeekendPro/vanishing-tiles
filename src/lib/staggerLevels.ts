/**
 * Infinite Stagger's named-levels config: five named levels riding on top of the
 * single never-resetting run `score`. Thresholds are CUMULATIVE running-total
 * checkpoints on that score (not per-level point budgets) — crossing a
 * threshold completes the level it belongs to and advances the active level.
 * Crossing the final threshold (crawlers, 500000) is the WIN condition.
 *
 * `mechanic` is a config stub for now — per-level mechanics (triplet reveals,
 * morph animation, overlap timing, crawl pacing) are calibratable hooks that
 * are deliberately NOT built out in this pass. Only `kind` is meaningful
 * today; `params` exists for later per-level tuning.
 */

export type LevelKey = 'solos' | 'twins' | 'triplets' | 'transformers' | 'crawlers'

export type LevelMechanic = {
  kind: 'singles' | 'pairs' | 'triples' | 'transform' | 'crawl'
  params?: Record<string, number>
}

export interface StaggerLevel {
  key: LevelKey
  name: string
  threshold: number
  multiplier: number
  mechanic: LevelMechanic
}

/** Ordered named levels. `threshold` is the cumulative score at which the
 *  level COMPLETES (see boundary semantics on `levelIndexForScore`). */
export const STAGGER_LEVELS: readonly StaggerLevel[] = [
  { key: 'solos', name: 'SOLOS', threshold: 20000, multiplier: 1, mechanic: { kind: 'singles' } },
  { key: 'twins', name: 'TWINS', threshold: 50000, multiplier: 2, mechanic: { kind: 'pairs' } },
  { key: 'triplets', name: 'TRIPLETS', threshold: 100000, multiplier: 3, mechanic: { kind: 'triples' } },
  { key: 'transformers', name: 'TRANSFORMERS', threshold: 200000, multiplier: 4, mechanic: { kind: 'transform' } },
  { key: 'crawlers', name: 'CRAWLERS', threshold: 500000, multiplier: 5, mechanic: { kind: 'crawl' } },
] as const

/** Index of the active (current) level for a given cumulative score.
 *
 *  Boundary semantics: a level's `threshold` is the score at which that level
 *  *completes*. While climbing SOLOS the active level is `solos` for `score`
 *  in [0, 20000); AT exactly 20000 the player has completed solos, so the
 *  active level becomes `twins`. i.e. we advance past a level once
 *  `score >= threshold`. Past the final threshold the index clamps to the
 *  last level (crawlers / won state) — there's nowhere further to advance. */
export function levelIndexForScore(score: number): number {
  let index = 0
  for (let i = 0; i < STAGGER_LEVELS.length - 1; i++) {
    if (score >= STAGGER_LEVELS[i].threshold) {
      index = i + 1
    }
  }
  return index
}

/** The active level object for a given cumulative score. */
export function levelForScore(score: number): StaggerLevel {
  return STAGGER_LEVELS[levelIndexForScore(score)]
}

/** The threshold the player is currently climbing toward — the active
 *  level's threshold. At/after the final threshold this stays pinned to the
 *  final (crawlers) threshold; there's no further rung to climb toward. */
export function nextThreshold(score: number): number {
  return levelForScore(score).threshold
}

/** True once the run has crossed the final (crawlers) threshold — the WIN
 *  condition. */
export function isWon(score: number): boolean {
  return score >= STAGGER_LEVELS[STAGGER_LEVELS.length - 1].threshold
}

/** Look up a level by its key. */
export function levelByKey(key: LevelKey): StaggerLevel {
  const level = STAGGER_LEVELS.find(l => l.key === key)
  if (!level) throw new Error(`Unknown stagger level key: ${key}`)
  return level
}

/** Look up a level's index by its key. */
export function levelIndexByKey(key: LevelKey): number {
  const index = STAGGER_LEVELS.findIndex(l => l.key === key)
  if (index === -1) throw new Error(`Unknown stagger level key: ${key}`)
  return index
}
