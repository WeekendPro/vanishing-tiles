import type { ComponentKey } from './components'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export const COMPLETION_BASE = 50
export const LIFE_PENALTY = 10
export const SPEED_MAX = 50
export const COMPONENT_MAX = 100
export const COMPONENT_COUNT = 5
export const LEVEL_MAX = COMPONENT_MAX * COMPONENT_COUNT // 500

export interface ComponentScoreInput {
  solved: boolean
  /** Wrong submissions before the successful one (0, 1, or 2). */
  livesLost: number
  /** Time consumed on the successful attempt (ms). */
  consumed: number
  /** Full time budget for the attempt (ms): view+select, or select-only for flash. */
  allotted: number
}

/** completion(50 − 10·livesLost) + time(50·(1 − consumed/allotted)), ceil, 0..100; 0 if unsolved. */
export function componentScore(i: ComponentScoreInput): number {
  if (!i.solved) return 0
  const base = COMPLETION_BASE - LIFE_PENALTY * clamp(i.livesLost, 0, 2)
  const fraction = i.allotted > 0 ? clamp(i.consumed / i.allotted, 0, 1) : 1
  const speed = SPEED_MAX * (1 - fraction)
  return clamp(Math.ceil(base + speed), 0, COMPONENT_MAX)
}

export type ComponentBests = Record<ComponentKey, number>

export function sumBests(b: ComponentBests): number {
  return b.main + b.colors + b.inSequence + b.flash + b.riddle
}

/** 0 if main unsolved; else 1 (main solved) rising by tier: 150/250/350/450 → 2/3/4/5. */
export function levelStarsFromTotal(total: number, mainSolved: boolean): number {
  if (!mainSolved) return 0
  if (total >= 450) return 5
  if (total >= 350) return 4
  if (total >= 250) return 3
  if (total >= 150) return 2
  return 1
}

/** 1..5 difficulty rating derived from the level's gap count. */
export function difficultyPips(gapCount: number): number {
  if (gapCount <= 4) return 1
  if (gapCount <= 7) return 2
  if (gapCount <= 10) return 3
  if (gapCount <= 13) return 4
  return 5
}

/** Deterministic, plausible stand-in for a future server-backed global best (300..500). */
export function mockGlobalRecord(levelId: string): number {
  let h = 0
  for (let i = 0; i < levelId.length; i++) h = (h * 31 + levelId.charCodeAt(i)) >>> 0
  return 300 + (h % 201) // 300..500
}
