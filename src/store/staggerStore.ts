import { create } from 'zustand'
import type { Gap, PieceType } from '@shared/types'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import {
  STAGGER, difficultyForBatch, batchSpeedBonus,
  allowedTypesForBatch, lockedRotationsForBatch,
  pairsForBatch, triplesForBatch, invertedForBatch, buildRevealPlan,
} from '../lib/staggerCurve'
import {
  STAGGER_LEVELS, type LevelKey, type StaggerLevel,
  levelByKey, levelIndexByKey,
} from '../lib/staggerLevels'
import { levelTransition } from '../lib/levelTransition'

export type StaggerPhase =
  | 'idle' | 'countdown' | 'reveal' | 'selecting' | 'gameOver'
  | 'levelComplete' | 'won'

/** A batch gap plus whether the player has correctly recalled (filled) it, and
 *  whether it reveals with the back-loaded INVERTED build (seed → flow-in →
 *  bright complete → magenta poof). Inverted gaps always take a SOLO reveal beat;
 *  recall/resolution is unchanged (the player still picks the matching shape). */
export interface StaggerGap extends Gap {
  filled: boolean
  inverted?: boolean
}

/** What a pick resolved to — drives the per-pick animation (snap vs ✕), the
 *  floating "+points" burst, and the combo chip. */
export interface PickResult {
  ok: boolean
  gap?: StaggerGap
  batchCleared: boolean
  gameOver: boolean
  combo: number   // streak length AFTER this pick (0 on a miss)
  gained: number  // points this pick earned (base × streak; 0 on a miss)
  speedBonus: number  // leftover-time bonus to bank during the clear payoff (0 unless this pick cleared the batch)
}

interface StaggerState {
  phase: StaggerPhase
  batchIndex: number          // 0-based; drives difficulty + timing
  gaps: StaggerGap[]          // current batch's gaps
  revealPlan: number[][]      // reveal beats: each beat is 1, 2, or 3 indices into `gaps`
  score: number               // cumulative across the whole run
  lives: number               // shared pool; run ends at 0
  selectStartTime: number     // Date.now() when selecting began (for speed scoring)
  selectDuration: number      // current batch's select clock (ms)
  paused: boolean             // hard pause (timer frozen, screen hidden)
  resumeRemaining: number | null  // select ms to resume with (replay / pause)

  // Named levels (Infinite Stagger levels riding on top of `score`).
  levelIndex: number               // index into STAGGER_LEVELS of the level being PLAYED
  sandboxLevel: LevelKey | null    // non-null while in the calibration sandbox (locks levelIndex, disables advance/lose)
  completedLevelIndex: number | null  // set while phase === 'levelComplete', for the celebration UI

  // Run stats (for the Game Over screen) — reset on startRun, survive into gameOver.
  shapesRecalled: number      // total gaps correctly filled across the run
  currentCombo: number        // running streak of consecutive correct picks (player-facing label: "Streak")
  bestCombo: number           // longest streak seen this run (player-facing label: "Best Streak")
  totalPicks: number          // correct + wrong picks
  correctPicks: number        // correct picks (accuracy numerator)

  startRun: (level?: LevelKey) => void
  beginReveal: () => void     // countdown → reveal (generates the current batch)
  beginSelecting: () => void  // reveal done → selecting (starts/resumes the clock)
  pickPiece: (type: PieceType) => PickResult
  bankSpeedBonus: (amount: number) => void  // fold the deferred leftover-time bonus into the score (drives the time→score payoff)
  advanceBatch: () => void    // batch cleared → evaluates level transition, then next batch's reveal
  timeoutBatch: () => void    // select clock expired → costs a life, replays the same phase
  replayReveal: () => boolean // spend points to replay the memorize sequence
  pause: () => void           // freeze the select clock
  resume: () => void          // unfreeze, resuming the remaining select time
  proceedAfterLevelComplete: () => void  // levelComplete → adopt the next level, enter its intro countdown
  exit: () => void            // tear down back to idle
}

/** The level whose multiplier/mechanic governs the CURRENT batch: the locked
 *  sandbox level when sandboxing, otherwise the level being played. Exported
 *  so the UI can derive "active level" (name, multiplier, mechanic) directly
 *  from `{ levelIndex, sandboxLevel }` without duplicating the sandbox check. */
export function activeLevel(s: Pick<StaggerState, 'levelIndex' | 'sandboxLevel'>): StaggerLevel {
  return s.sandboxLevel != null ? levelByKey(s.sandboxLevel) : STAGGER_LEVELS[s.levelIndex]
}

/** True while the run is locked into the calibration sandbox (unlosable,
 *  never advances levels). Convenience wrapper around `sandboxLevel`. */
export function isSandboxRun(s: Pick<StaggerState, 'sandboxLevel'>): boolean {
  return s.sandboxLevel != null
}

/** Flag `count` random gaps as inverted, biased toward gaps whose shape is the
 *  LEAST useful for forming distinct chunks (most-common shapes first) so the
 *  remaining pool stays rich enough to satisfy the requested pairs/triples. */
function chooseInverted(gaps: Gap[], count: number): boolean[] {
  const inverted = gaps.map(() => false)
  if (count <= 0) return inverted
  // Count shapes; prefer to invert duplicates of the commonest shapes so the
  // distinct-shape variety left for chunking is maximised.
  const freq = new Map<PieceType, number>()
  gaps.forEach(g => freq.set(g.pieceType, (freq.get(g.pieceType) ?? 0) + 1))
  const byCommonness = gaps
    .map((_g, i) => i)
    .sort((a, b) => (freq.get(gaps[b].pieceType)! - freq.get(gaps[a].pieceType)!))
  for (let k = 0; k < count && k < byCommonness.length; k++) inverted[byCommonness[k]] = true
  return inverted
}

function makeBatch(batchIndex: number): { gaps: StaggerGap[]; revealPlan: number[][] } {
  const diff = difficultyForBatch(batchIndex)
  const allowedTypes = allowedTypesForBatch(batchIndex)
  const pairCount = pairsForBatch(batchIndex)
  const tripleCount = triplesForBatch(batchIndex)
  const invertedCount = invertedForBatch(batchIndex)

  // Re-roll until the drawn shapes can supply the requested DISTINCT-shape pairs
  // AND triples (each pair is two different pieces; each triple ≥2 distinct), with
  // the inverted gaps held out as solo beats. With the wide late-game pool this
  // practically always succeeds on the first try; the loop just guarantees it,
  // falling back to the best board found if a degenerate roll persists.
  let best: { gaps: Gap[]; inverted: boolean[]; plan: number[][] } | null = null
  for (let attempt = 0; attempt < 60; attempt++) {
    const { gaps } = generatePuzzle({
      gapCount: diff.gapCount,
      complexity: diff.complexity,
      allowedTypes,
      lockedRotations: lockedRotationsForBatch(batchIndex),
      // Once the pool widens past 2 shapes, variety is the run's main early lever —
      // force ≥2 distinct shapes per board so the added pieces actually appear
      // instead of being lost to an all-identical roll.
      requireVariety: allowedTypes.length > 2,
    })
    const inverted = chooseInverted(gaps, invertedCount)
    const plan = buildRevealPlan(gaps.map(g => g.pieceType), pairCount, tripleCount, inverted)
    const achievedTriples = plan.filter(beat => beat.length === 3).length
    const achievedPairs = plan.filter(beat => beat.length === 2).length
    if (achievedTriples >= tripleCount && achievedPairs >= pairCount) {
      best = { gaps, inverted, plan }; break
    }
    if (!best) best = { gaps, inverted, plan }
  }

  const { gaps, inverted, plan } = best!
  return {
    gaps: gaps.map((g, i) => ({ ...g, filled: false, inverted: inverted[i] })),
    revealPlan: plan,
  }
}

const IDLE = {
  phase: 'idle' as StaggerPhase,
  batchIndex: 0,
  gaps: [] as StaggerGap[],
  revealPlan: [] as number[][],
  score: 0,
  lives: STAGGER.START_LIVES,
  selectStartTime: 0,
  selectDuration: 0,
  paused: false,
  resumeRemaining: null as number | null,
  levelIndex: 0,
  sandboxLevel: null as LevelKey | null,
  completedLevelIndex: null as number | null,
  shapesRecalled: 0,
  currentCombo: 0,
  bestCombo: 0,
  totalPicks: 0,
  correctPicks: 0,
}

export const useStaggerStore = create<StaggerState>((set, get) => ({
  ...IDLE,

  startRun: (level) => set({
    ...IDLE,
    phase: 'countdown',
    sandboxLevel: level ?? null,
    levelIndex: level != null ? levelIndexByKey(level) : 0,
  }),

  beginReveal: () => set({ phase: 'reveal', ...makeBatch(get().batchIndex) }),

  beginSelecting: () => {
    const duration = difficultyForBatch(get().batchIndex).selectDuration
    const resume = get().resumeRemaining
    // Coming back from a replay: resume the clock where it was paused (backdate
    // selectStartTime so `start + duration - now` equals the saved remaining).
    const startTime = resume != null ? Date.now() - (duration - resume) : Date.now()
    set({
      phase: 'selecting',
      selectStartTime: startTime,
      selectDuration: duration,
      resumeRemaining: null,
      paused: false,
    })
  },

  pickPiece: (type) => {
    const {
      phase, gaps, lives, score, selectStartTime, selectDuration,
      totalPicks, correctPicks, shapesRecalled, currentCombo, bestCombo,
      sandboxLevel,
    } = get()
    if (phase !== 'selecting') return { ok: false, batchCleared: false, gameOver: false, combo: 0, gained: 0, speedBonus: 0 }

    // A pick is correct iff some still-unfilled gap has the exact same shape.
    // Tetromino types are shape-unique, so piece-type equality IS the shape match.
    const target = gaps.find(g => !g.filled && g.pieceType === type)

    if (!target) {
      // A miss: counts toward accuracy and breaks the running combo.
      const isSandbox = sandboxLevel != null
      const nextLives = isSandbox ? lives : lives - 1
      const baseStats = { totalPicks: totalPicks + 1, currentCombo: 0 }
      // Sandbox is unlosable: lives never drop and gameOver is never reachable.
      if (!isSandbox && nextLives <= 0) {
        set({ lives: 0, phase: 'gameOver', ...baseStats })
        return { ok: false, batchCleared: false, gameOver: true, combo: 0, gained: 0, speedBonus: 0 }
      }
      set({ lives: nextLives, ...baseStats })
      return { ok: false, batchCleared: false, gameOver: false, combo: 0, gained: 0, speedBonus: 0 }
    }

    // A correct recall: extend the streak. The per-pick reward scales LINEARLY
    // with the combo (×N) AND with the active level's multiplier (×levelMultiplier).
    const nextCombo = currentCombo + 1
    const gained = STAGGER.ACCURACY_PER_GAP * nextCombo * activeLevel(get()).multiplier
    const nextGaps = gaps.map(g => (g === target ? { ...g, filled: true } : g))
    const nextScore = score + gained
    const cleared = nextGaps.every(g => g.filled)
    // On a clear the leftover-time bonus is NOT folded in here — it's returned and
    // banked separately (via bankSpeedBonus) so the UI can pour it into the score
    // as the timer bar drains: the "time → points" payoff.
    const speedBonus = cleared
      ? batchSpeedBonus(Math.max(0, selectStartTime + selectDuration - Date.now()), selectDuration)
      : 0
    // Earn-a-life: every LIFE_EVERY cumulative points awards a life. The deferred
    // speed bonus awards its own lives when it's banked.
    const livesGained =
      Math.floor(nextScore / STAGGER.LIFE_EVERY) - Math.floor(score / STAGGER.LIFE_EVERY)
    set({
      gaps: nextGaps,
      score: nextScore,
      lives: lives + livesGained,
      shapesRecalled: shapesRecalled + 1,
      correctPicks: correctPicks + 1,
      totalPicks: totalPicks + 1,
      currentCombo: nextCombo,
      bestCombo: Math.max(bestCombo, nextCombo),
    })
    return { ok: true, gap: { ...target, filled: true }, batchCleared: cleared, gameOver: false, combo: nextCombo, gained, speedBonus }
  },

  bankSpeedBonus: (amount) => {
    if (amount <= 0) return
    const { score, lives } = get()
    const nextScore = score + amount
    const livesGained =
      Math.floor(nextScore / STAGGER.LIFE_EVERY) - Math.floor(score / STAGGER.LIFE_EVERY)
    set({ score: nextScore, lives: lives + livesGained })
  },

  advanceBatch: () => {
    // Level transitions are evaluated ONLY here, at the batch boundary — never
    // mid-batch — per `levelTransition`'s contract. `batchIndex` (difficulty
    // progression) always advances; the level-complete/won branches just
    // detour through a celebration phase before the next batch's reveal.
    const { score, levelIndex, sandboxLevel, batchIndex } = get()
    const transition = levelTransition(score, levelIndex, sandboxLevel != null)
    if (transition.kind === 'levelComplete') {
      set({ phase: 'levelComplete', completedLevelIndex: levelIndex, batchIndex: batchIndex + 1 })
      return
    }
    if (transition.kind === 'won') {
      set({ phase: 'won', batchIndex: batchIndex + 1 })
      return
    }
    const next = batchIndex + 1
    set({ phase: 'reveal', batchIndex: next, ...makeBatch(next) })
  },

  timeoutBatch: () => {
    // Letting the select clock run out costs a life and breaks the combo streak.
    // Crucially it does NOT advance to the next phase: the SAME batch is replayed
    // on a fresh clock (same shapes, reset unfilled — mirroring Journey's "a
    // failed attempt replays the same puzzle"). If it was the last life, the run
    // ends — UNLESS sandboxing, which is unlosable (lives never drop, no gameOver).
    const isSandbox = get().sandboxLevel != null
    if (isSandbox) {
      set({ phase: 'reveal', gaps: get().gaps.map(g => ({ ...g, filled: false })), currentCombo: 0 })
      return
    }
    const lives = get().lives - 1
    if (lives <= 0) {
      set({ lives: 0, phase: 'gameOver', currentCombo: 0 })
      return
    }
    set({ lives, phase: 'reveal', gaps: get().gaps.map(g => ({ ...g, filled: false })), currentCombo: 0 })
  },

  replayReveal: () => {
    const { phase, score, selectStartTime, selectDuration } = get()
    // Only mid-selection, and only if the player can afford it.
    if (phase !== 'selecting' || score < STAGGER.REPLAY_COST) return false
    const remaining = Math.max(0, selectStartTime + selectDuration - Date.now())
    // Spend the points and replay the (unchanged) batch's reveal sequence; the
    // saved remaining time resumes once the sequence finishes (beginSelecting).
    set({ phase: 'reveal', score: score - STAGGER.REPLAY_COST, resumeRemaining: remaining })
    return true
  },

  pause: () => {
    const { phase, paused, selectStartTime, selectDuration } = get()
    if (phase !== 'selecting' || paused) return
    const remaining = Math.max(0, selectStartTime + selectDuration - Date.now())
    set({ paused: true, resumeRemaining: remaining })
  },

  resume: () => {
    const { paused, resumeRemaining, selectDuration } = get()
    if (!paused) return
    const remaining = resumeRemaining ?? selectDuration
    set({
      paused: false,
      resumeRemaining: null,
      selectStartTime: Date.now() - (selectDuration - remaining),
    })
  },

  proceedAfterLevelComplete: () => {
    // Adopt the next level and enter its intro countdown (Task 3 renders the
    // level name + 3·2·1 over the grid); the next batch's reveal begins
    // normally once countdown → beginReveal fires, same as run start.
    const { completedLevelIndex } = get()
    if (completedLevelIndex == null) return
    const nextLevelIndex = levelTransition(get().score, completedLevelIndex, false).nextLevelIndex
    set({ phase: 'countdown', levelIndex: nextLevelIndex, completedLevelIndex: null })
  },

  exit: () => set({ ...IDLE }),
}))
