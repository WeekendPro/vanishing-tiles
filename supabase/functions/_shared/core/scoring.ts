// Efficiency was retired when the SINGLE piece was removed: every gap is a
// 4-cell tetromino, so a clear always uses exactly minPieces and the pillar
// flatlined to a constant. Its 300 pts were folded into Speed (500→800) to keep
// the per-level ceiling at 2000. The DB still stores an `efficiency` column, so
// the key is kept at 0 rather than removed (avoids a schema migration).
export const PILLAR_MAX = {
  accuracy: 800,
  speed: 800,
  efficiency: 0,
  attempts: 400,
} as const

export const MAX_TRIES = 3
export const MAX_TOTAL =
  PILLAR_MAX.accuracy + PILLAR_MAX.speed + PILLAR_MAX.efficiency + PILLAR_MAX.attempts

/** Pillar maxes are constant, so the per-level theoretical max is constant.
 *  Kept as a function so a future per-level scaling has one place to change.
 *  This is the single source of truth: the submit_attempt Edge Function imports
 *  scoreClear/PILLAR_MAX from here, so the server scores with the same math. */
export function maxScoreFor(): number {
  return MAX_TOTAL
}

/** attemptsBonus = round(max * (MAX_TRIES - triesUsed) / (MAX_TRIES - 1)) */
export function attemptsBonus(triesUsed: number): number {
  const t = Math.min(Math.max(triesUsed, 1), MAX_TRIES)
  return Math.round(PILLAR_MAX.attempts * (MAX_TRIES - t) / (MAX_TRIES - 1))
}

export function starsForTotal(total: number): number {
  const ratio = total / MAX_TOTAL
  if (ratio >= 0.75) return 3
  if (ratio >= 0.5) return 2
  return 1
}

export function computeStars(a: { solved: boolean; total: number }): number {
  return a.solved ? starsForTotal(a.total) : 0
}

export interface ClearInput {
  triesUsed: number
  viewTimeRemaining: number
  viewDuration: number
  selectTimeRemaining: number
  selectDuration: number
  minPieces: number
  selectedPieces: number
}

export interface PillarScore {
  accuracy: number
  speed: number
  efficiency: number
  attempts: number
  total: number
  stars: number
}

export function scoreClear(i: ClearInput): PillarScore {
  const accuracy = PILLAR_MAX.accuracy
  const viewRatio = i.viewDuration > 0 ? i.viewTimeRemaining / i.viewDuration : 0
  const selectRatio = i.selectDuration > 0 ? i.selectTimeRemaining / i.selectDuration : 0
  const speed = Math.round(PILLAR_MAX.speed * 0.5 * (viewRatio + selectRatio))
  const efficiency = 0   // retired pillar — see PILLAR_MAX comment
  const attempts = attemptsBonus(i.triesUsed)
  const total = accuracy + speed + efficiency + attempts
  return { accuracy, speed, efficiency, attempts, total, stars: starsForTotal(total) }
}

// ── Multi-round level scoring (Speed / Efficiency per round; Lives per level) ──
// Additive: the single-round scoreClear above is still used by the Journey
// server path until the multi-round port lands.

// Efficiency retired with the SINGLE piece (see PILLAR_MAX comment); its 1000
// was folded into Speed (1000→2000), keeping MAX_LEVEL_TOTAL unchanged at 9000.
export const ROUND_PILLAR_MAX = { speed: 2000, efficiency: 0 } as const
export const LIVES_BONUS_MAX = 1000
export const MAX_LIVES = 3
export const ROUNDS_PER_LEVEL = 4
export const MAX_LEVEL_TOTAL =
  ROUNDS_PER_LEVEL * (ROUND_PILLAR_MAX.speed + ROUND_PILLAR_MAX.efficiency) + LIVES_BONUS_MAX

export interface RoundSpeedInput {
  viewTimeRemaining: number
  viewDuration: number
  selectTimeRemaining: number
  selectDuration: number
  /** Flash Mob: the viewing reveal is unskippable, so score Speed on the select clock only. */
  selectOnly?: boolean
}

/** Speed = 1000 × fraction of allotted time left (combined view+select budget). */
export function roundSpeed(i: RoundSpeedInput): number {
  const rem = i.selectOnly ? i.selectTimeRemaining : i.viewTimeRemaining + i.selectTimeRemaining
  const dur = i.selectOnly ? i.selectDuration : i.viewDuration + i.selectDuration
  if (dur <= 0) return 0
  return Math.round(ROUND_PILLAR_MAX.speed * (rem / dur))
}

/** Retired pillar — always 0 (kept so callers/return shape stay stable). */
export function roundEfficiency(_minPieces: number, _selectedPieces: number): number {
  return 0
}

export interface RoundResult { speed: number; efficiency: number; total: number }

export function scoreRound(i: RoundSpeedInput & { minPieces: number; selectedPieces: number }): RoundResult {
  const speed = roundSpeed(i)
  const efficiency = roundEfficiency(i.minPieces, i.selectedPieces)
  return { speed, efficiency, total: speed + efficiency }
}

/** Lives bonus = floor(1000 × livesRemaining / 3): 3→1000, 2→666, 1→333, 0→0. */
export function livesBonus(livesRemaining: number): number {
  const lives = Math.max(0, Math.min(MAX_LIVES, livesRemaining))
  return Math.floor(LIVES_BONUS_MAX * lives / MAX_LIVES)
}

/** Sum of cleared round totals + lives bonus, floored at 0. */
export function levelTotal(roundTotals: number[], livesRemaining: number): number {
  const rounds = roundTotals.reduce((s, n) => s + n, 0)
  return Math.max(0, rounds + livesBonus(livesRemaining))
}

/** Stars from the level total / MAX_LEVEL_TOTAL ratio: ≥0.75→3, ≥0.5→2, else 1. */
export function levelStars(total: number): number {
  const ratio = total / MAX_LEVEL_TOTAL
  if (ratio >= 0.75) return 3
  if (ratio >= 0.5) return 2
  return 1
}
