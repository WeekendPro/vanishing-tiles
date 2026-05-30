export const PILLAR_MAX = {
  accuracy: 800,
  speed: 500,
  efficiency: 300,
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
  const efficiencyRatio = i.selectedPieces === 0
    ? 0
    : i.minPieces / Math.max(i.selectedPieces, i.minPieces)
  const efficiency = Math.round(PILLAR_MAX.efficiency * efficiencyRatio)
  const attempts = attemptsBonus(i.triesUsed)
  const total = accuracy + speed + efficiency + attempts
  return { accuracy, speed, efficiency, attempts, total, stars: starsForTotal(total) }
}
