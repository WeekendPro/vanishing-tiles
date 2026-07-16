import { create } from 'zustand'
import type { Gap, PieceType } from '@shared/types'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import {
  STAGGER, difficultyForBatch, batchSpeedBonus,
  allowedTypesForBatch, lockedRotationsForBatch,
  revealOrderForGaps,
  selectDurationForBatch,
} from '../lib/staggerCurve'

export type StaggerPhase = 'idle' | 'countdown' | 'reveal' | 'selecting' | 'gameOver'

/** A batch gap plus whether the player has correctly recalled (filled) it. */
export interface StaggerGap extends Gap {
  filled: boolean
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
  revealPlan: number[]        // reveal order: a shuffled sequence of indices into `gaps`, one gap per beat
  score: number               // cumulative across the whole run
  lives: number               // shared pool; run ends at 0
  selectStartTime: number     // Date.now() when selecting began (for speed scoring)
  selectDuration: number      // current batch's select clock (ms)
  paused: boolean             // hard pause (timer frozen, screen hidden)
  resumeRemaining: number | null  // select ms to resume with (replay / pause)

  // Run stats (for the Game Over screen) — reset on startRun, survive into gameOver.
  shapesRecalled: number      // total gaps correctly filled across the run
  currentCombo: number        // running streak of consecutive correct picks (player-facing label: "Streak")
  bestCombo: number           // longest streak seen this run (player-facing label: "Best Streak")
  totalPicks: number          // correct + wrong picks
  correctPicks: number        // correct picks (accuracy numerator)

  startRun: () => void
  beginReveal: () => void     // countdown → reveal (generates the current batch)
  beginSelecting: () => void  // reveal done → selecting (starts/resumes the clock)
  pickPiece: (type: PieceType) => PickResult
  bankSpeedBonus: (amount: number) => void  // fold the deferred leftover-time bonus into the score (drives the time→score payoff)
  advanceBatch: () => void    // batch cleared → next batch's reveal
  timeoutBatch: () => void    // select clock expired → costs a life, replays the same phase
  replayReveal: () => boolean // spend points to replay the memorize sequence
  pause: () => void           // freeze the select clock
  resume: () => void          // unfreeze, resuming the remaining select time
  exit: () => void            // tear down back to idle
}

/** Generate a fresh batch of gaps + reveal plan for `batchIndex`, driven
 *  entirely by the difficulty CURVE. Every gap reveals as its own solo beat. */
function makeBatch(batchIndex: number): { gaps: StaggerGap[]; revealPlan: number[] } {
  const diff = difficultyForBatch(batchIndex)
  const gapCount = diff.gapCount
  const complexity = diff.complexity
  const allowedTypes = allowedTypesForBatch(batchIndex)
  const lockedRotations = lockedRotationsForBatch(batchIndex)

  const { gaps } = generatePuzzle({
    gapCount,
    complexity,
    allowedTypes,
    lockedRotations,
    // Once the pool widens past 2 shapes, variety is the run's main early lever —
    // force ≥2 distinct shapes per board so the added pieces actually appear
    // instead of being lost to an all-identical roll.
    requireVariety: allowedTypes.length > 2,
    // Gaps may touch (unchanged from the original curve-driven behavior).
    minGapDistance: 0,
  })

  return {
    gaps: gaps.map((g: Gap) => ({ ...g, filled: false })),
    revealPlan: revealOrderForGaps(gaps.length),
  }
}

const IDLE = {
  phase: 'idle' as StaggerPhase,
  batchIndex: 0,
  gaps: [] as StaggerGap[],
  revealPlan: [] as number[],
  score: 0,
  lives: STAGGER.START_LIVES,
  selectStartTime: 0,
  selectDuration: 0,
  paused: false,
  resumeRemaining: null as number | null,
  shapesRecalled: 0,
  currentCombo: 0,
  bestCombo: 0,
  totalPicks: 0,
  correctPicks: 0,
}

export const useStaggerStore = create<StaggerState>((set, get) => ({
  ...IDLE,

  startRun: () => set({ ...IDLE, phase: 'countdown' }),

  beginReveal: () => set({ phase: 'reveal', ...makeBatch(get().batchIndex) }),

  beginSelecting: () => {
    const duration = selectDurationForBatch(get().batchIndex)
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
    } = get()
    if (phase !== 'selecting') return { ok: false, batchCleared: false, gameOver: false, combo: 0, gained: 0, speedBonus: 0 }

    // A pick is correct iff some still-unfilled gap has the exact same shape.
    // Tetromino types are shape-unique, so piece-type equality IS the shape match.
    const target = gaps.find(g => !g.filled && g.pieceType === type)

    if (!target) {
      // A miss: counts toward accuracy and breaks the running combo, and costs a life.
      const nextLives = lives - 1
      const baseStats = { totalPicks: totalPicks + 1, currentCombo: 0 }
      if (nextLives <= 0) {
        set({ lives: 0, phase: 'gameOver', ...baseStats })
        return { ok: false, batchCleared: false, gameOver: true, combo: 0, gained: 0, speedBonus: 0 }
      }
      set({ lives: nextLives, ...baseStats })
      return { ok: false, batchCleared: false, gameOver: false, combo: 0, gained: 0, speedBonus: 0 }
    }

    // A correct recall: extend the streak. The per-pick reward scales LINEARLY
    // with the combo (×N) — the streak is the ONLY score multiplier.
    const nextCombo = currentCombo + 1
    const gained = STAGGER.ACCURACY_PER_GAP * nextCombo
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
    // Difficulty progression (batchIndex) always advances; the next batch's
    // reveal begins immediately — no level transitions or celebrations.
    const next = get().batchIndex + 1
    set({ phase: 'reveal', batchIndex: next, ...makeBatch(next) })
  },

  timeoutBatch: () => {
    // Letting the select clock run out costs a life and breaks the combo streak.
    // Crucially it does NOT advance to the next phase: the SAME batch is replayed
    // on a fresh clock (same shapes, reset unfilled — mirroring Journey's "a
    // failed attempt replays the same puzzle"). If it was the last life, the run ends.
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

  exit: () => set({ ...IDLE }),
}))

if (import.meta.env.DEV) (window as any).__staggerStore = useStaggerStore
