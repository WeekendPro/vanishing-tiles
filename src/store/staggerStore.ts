import { create } from 'zustand'
import type { Gap, PieceType } from '@shared/types'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import {
  STAGGER, difficultyForBatch, batchSpeedBonus,
  allowedTypesForBatch, lockedRotationsForBatch,
} from '../lib/staggerCurve'

export type StaggerPhase = 'idle' | 'countdown' | 'reveal' | 'selecting' | 'gameOver'

/** A batch gap plus whether the player has correctly recalled (filled) it. */
export interface StaggerGap extends Gap {
  filled: boolean
}

/** What a pick resolved to — drives the per-pick animation (snap vs ✕). */
export interface PickResult {
  ok: boolean
  gap?: StaggerGap
  batchCleared: boolean
  gameOver: boolean
}

interface StaggerState {
  phase: StaggerPhase
  batchIndex: number          // 0-based; drives difficulty + timing
  gaps: StaggerGap[]          // current batch's gaps
  score: number               // cumulative across the whole run
  lives: number               // shared pool; run ends at 0
  selectStartTime: number     // Date.now() when selecting began (for speed scoring)
  selectDuration: number      // current batch's select clock (ms)

  startRun: () => void
  beginReveal: () => void     // countdown → reveal (generates batch 0)
  beginSelecting: () => void  // reveal done → selecting (starts the clock)
  pickPiece: (type: PieceType) => PickResult
  advanceBatch: () => void    // batch cleared → next, harder batch's reveal
  timeoutBatch: () => void    // select clock expired → costs a life, then advance
  exit: () => void            // tear down back to idle
}

function makeBatch(batchIndex: number): StaggerGap[] {
  const diff = difficultyForBatch(batchIndex)
  const { gaps } = generatePuzzle({
    gapCount: diff.gapCount,
    complexity: diff.complexity,
    allowedTypes: allowedTypesForBatch(batchIndex),
    lockedRotations: lockedRotationsForBatch(batchIndex),
  })
  return gaps.map(g => ({ ...g, filled: false }))
}

const IDLE = {
  phase: 'idle' as StaggerPhase,
  batchIndex: 0,
  gaps: [] as StaggerGap[],
  score: 0,
  lives: STAGGER.START_LIVES,
  selectStartTime: 0,
  selectDuration: 0,
}

export const useStaggerStore = create<StaggerState>((set, get) => ({
  ...IDLE,

  startRun: () => set({ ...IDLE, phase: 'countdown' }),

  beginReveal: () => set({ phase: 'reveal', gaps: makeBatch(get().batchIndex) }),

  beginSelecting: () =>
    set({
      phase: 'selecting',
      selectStartTime: Date.now(),
      selectDuration: difficultyForBatch(get().batchIndex).selectDuration,
    }),

  pickPiece: (type) => {
    const { phase, gaps, lives, score, selectStartTime, selectDuration } = get()
    if (phase !== 'selecting') return { ok: false, batchCleared: false, gameOver: false }

    // A pick is correct iff some still-unfilled gap has the exact same shape.
    // Tetromino types are shape-unique, so piece-type equality IS the shape match.
    const target = gaps.find(g => !g.filled && g.pieceType === type)

    if (!target) {
      const nextLives = lives - 1
      if (nextLives <= 0) {
        set({ lives: 0, phase: 'gameOver' })
        return { ok: false, batchCleared: false, gameOver: true }
      }
      set({ lives: nextLives })
      return { ok: false, batchCleared: false, gameOver: false }
    }

    const nextGaps = gaps.map(g => (g === target ? { ...g, filled: true } : g))
    let nextScore = score + STAGGER.ACCURACY_PER_GAP
    const cleared = nextGaps.every(g => g.filled)
    if (cleared) {
      const remaining = Math.max(0, selectStartTime + selectDuration - Date.now())
      nextScore += batchSpeedBonus(remaining, selectDuration)
    }
    set({ gaps: nextGaps, score: nextScore })
    return { ok: true, gap: { ...target, filled: true }, batchCleared: cleared, gameOver: false }
  },

  advanceBatch: () => {
    const next = get().batchIndex + 1
    set({ phase: 'reveal', batchIndex: next, gaps: makeBatch(next) })
  },

  timeoutBatch: () => {
    // Letting the select clock run out costs a life; if it was the last, the run
    // ends — otherwise the abandoned batch is left behind and the next begins.
    const lives = get().lives - 1
    if (lives <= 0) {
      set({ lives: 0, phase: 'gameOver' })
      return
    }
    const next = get().batchIndex + 1
    set({ lives, phase: 'reveal', batchIndex: next, gaps: makeBatch(next) })
  },

  exit: () => set({ ...IDLE }),
}))
