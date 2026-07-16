import { create } from 'zustand'
import { ROWS, COLS, type PieceType, type Rotation } from '@shared/types'
import { getRotatedCells } from '@shared/engine/pieces'
import { DISPLAY_ROTATION } from '../lib/staggerCurve'

/**
 * Training mode: learn the tetromino NAMES. One piece blooms onto the board at
 * a time (the game's exact reveal style) and holds there while the player picks
 * the letter that names it from a tray of I/O/T/S/Z/J/L. A correct pick fades
 * the piece out and brings on the next one; a wrong pick gives the in-game miss
 * feedback. No score, no timer, no lives — only the streak survives from the
 * main game, as a confidence-builder.
 */

export const TRAINING_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

/** The piece currently on the board: its type (the answer), the tray rotation
 *  it's drawn at, and its absolute board cells. */
export interface TrainingPiece {
  type: PieceType
  rotation: Rotation
  cells: [number, number][]
}

/** Roll the next piece to name: a random type (never the same twice in a row),
 *  drawn at its canonical tray rotation — training teaches the NAME of the
 *  shape as the player sees it in the recall tray — at a random spot on the
 *  board, held one cell off every edge so the bloom's glow never clips. */
export function randomTrainingPiece(
  exclude: PieceType | null = null,
  rng: () => number = Math.random,
): TrainingPiece {
  const pool = TRAINING_TYPES.filter(t => t !== exclude)
  const type = pool[Math.floor(rng() * pool.length)]
  const rotation = DISPLAY_ROTATION[type]
  const shape = getRotatedCells(type, rotation)
  const maxR = Math.max(...shape.map(([r]) => r))
  const maxC = Math.max(...shape.map(([, c]) => c))
  const r0 = 1 + Math.floor(rng() * (ROWS - maxR - 2))
  const c0 = 1 + Math.floor(rng() * (COLS - maxC - 2))
  return { type, rotation, cells: shape.map(([r, c]) => [r + r0, c + c0]) }
}

/** What a letter pick resolved to — drives the fade-out vs the miss shake. */
export interface TrainingGuess {
  ok: boolean
  piece: TrainingPiece | null
  streak: number // streak AFTER this guess (0 on a miss)
  elapsedMs: number // appearance → correct pick, the selection speed (0 on a miss)
}

interface TrainingState {
  active: boolean
  piece: TrainingPiece | null
  round: number // 1-based; bumps per fresh piece (keys the bloom animation)
  shownAt: number // Date.now() when the current piece appeared — the speed clock

  currentStreak: number
  bestStreak: number
  totalPicks: number
  correctPicks: number
  totalCorrectMs: number // summed selection times of correct picks (avg = / correctPicks)

  start: () => void
  /** Roll the next piece (called by the screen once the fade-out finishes). */
  nextPiece: () => void
  /** Resolve a letter pick against the current piece. Does NOT advance the
   *  piece — the screen owns the fade-out timing and calls nextPiece after. */
  guess: (type: PieceType) => TrainingGuess
  exit: () => void
}

const IDLE = {
  active: false,
  piece: null as TrainingPiece | null,
  round: 0,
  shownAt: 0,
  currentStreak: 0,
  bestStreak: 0,
  totalPicks: 0,
  correctPicks: 0,
  totalCorrectMs: 0,
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  ...IDLE,

  start: () => set({ ...IDLE, active: true, round: 1, piece: randomTrainingPiece(), shownAt: Date.now() }),

  nextPiece: () => {
    const { active, piece, round } = get()
    if (!active) return
    set({ piece: randomTrainingPiece(piece?.type ?? null), round: round + 1, shownAt: Date.now() })
  },

  guess: (type) => {
    const { active, piece, shownAt, currentStreak, bestStreak, totalPicks, correctPicks, totalCorrectMs } = get()
    if (!active || !piece) return { ok: false, piece: null, streak: 0, elapsedMs: 0 }
    if (type !== piece.type) {
      // A miss: breaks the streak (no lives here — training is consequence-free).
      // The speed clock keeps running: fumbling costs time on the eventual
      // correct pick, so the average honestly reflects accuracy too.
      set({ totalPicks: totalPicks + 1, currentStreak: 0 })
      return { ok: false, piece, streak: 0, elapsedMs: 0 }
    }
    // Selection speed: appearance → this correct pick.
    const elapsedMs = Math.max(0, Date.now() - shownAt)
    const streak = currentStreak + 1
    set({
      totalPicks: totalPicks + 1,
      correctPicks: correctPicks + 1,
      totalCorrectMs: totalCorrectMs + elapsedMs,
      currentStreak: streak,
      bestStreak: Math.max(bestStreak, streak),
    })
    return { ok: true, piece, streak, elapsedMs }
  },

  exit: () => set({ ...IDLE }),
}))
