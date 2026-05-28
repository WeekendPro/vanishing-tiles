import { create } from 'zustand'
import type {
  GameState, PieceType, SelectionEntry,
  DifficultyConfig, Rotation, Placement, Resolution,
} from '../types'
import { ROWS, COLS } from '../types'
import { generatePuzzle } from '../engine/puzzleGenerator'
import { solve, bestFit } from '../engine/solver'
import { getRotatedCells } from '../engine/pieces'

// ── Difficulty table (index = round - 1, capped at last entry) ──────────────

export const DIFFICULTY_TABLE: DifficultyConfig[] = [
  { viewDuration: 5000, selectDuration: 15000, placeDuration: 60000, gapCount: 2, complexity: 'simple' },
  { viewDuration: 5000, selectDuration: 15000, placeDuration: 60000, gapCount: 3, complexity: 'simple' },
  { viewDuration: 4000, selectDuration: 13000, placeDuration: 60000, gapCount: 3, complexity: 'simple' },
  { viewDuration: 4000, selectDuration: 13000, placeDuration: 60000, gapCount: 4, complexity: 'medium' },
  { viewDuration: 3000, selectDuration: 11000, placeDuration: 60000, gapCount: 4, complexity: 'medium' },
  { viewDuration: 3000, selectDuration: 11000, placeDuration: 60000, gapCount: 5, complexity: 'medium' },
  { viewDuration: 2500, selectDuration:  9000, placeDuration: 60000, gapCount: 5, complexity: 'complex' },
  { viewDuration: 2500, selectDuration:  9000, placeDuration: 60000, gapCount: 6, complexity: 'complex' },
  { viewDuration: 2000, selectDuration:  7000, placeDuration: 60000, gapCount: 6, complexity: 'complex' },
  { viewDuration: 2000, selectDuration:  7000, placeDuration: 60000, gapCount: 7, complexity: 'complex' },
]

function getDifficulty(round: number): DifficultyConfig {
  return DIFFICULTY_TABLE[Math.min(round - 1, DIFFICULTY_TABLE.length - 1)]
}

// ── Scoring constants ────────────────────────────────────────────────────────

const CORRECTNESS_POINTS = 800
const MAX_SPEED_BONUS = 500
const MAX_EFFICIENCY_BONUS = 300

// ── Store interface ──────────────────────────────────────────────────────────

interface GameStore extends GameState {
  startGame: () => void
  endViewing: () => void
  submitSelection: () => void
  applyPlacement: (placement: Placement) => void
  commitRoundScore: () => void
  placePiece: (row: number, col: number) => void
  finishManualPlace: () => void
  nextRound: () => void
  endGame: () => void
  resetGame: () => void
  incrementSelection: (pieceType: PieceType) => void
  decrementSelection: (pieceType: PieceType) => void
  holdPiece: (pieceType: PieceType, rotation: Rotation) => void
  rotatePiece: () => void
  clearHeld: () => void
  _resolution: Resolution | null
}

const INITIAL_STATE: GameState = {
  phase: 'idle',
  round: 1,
  score: 0,
  lives: 3,
  grid: [],
  gaps: [],
  selection: [],
  carryOvers: [],
  heldPiece: null,
  phaseStartTime: 0,
  phaseDuration: 0,
  roundScore: null,
  difficulty: DIFFICULTY_TABLE[0],
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL_STATE,
  _resolution: null,

  resetGame: () => set({ ...INITIAL_STATE, _resolution: null }),

  startGame: () => {
    const { round, carryOvers } = get()
    const difficulty = getDifficulty(round)
    const { grid, gaps } = generatePuzzle(difficulty)

    const selection: SelectionEntry[] = carryOvers.map(co => ({
      pieceType: co.pieceType,
      lockedCount: co.count,
      freeCount: 0,
    }))

    set({
      phase: 'viewing',
      grid,
      gaps,
      selection,
      difficulty,
      heldPiece: null,
      roundScore: null,
      phaseStartTime: Date.now(),
      phaseDuration: difficulty.viewDuration,
      _resolution: null,
    })
  },

  endViewing: () => {
    const { difficulty } = get()
    set({
      phase: 'selecting',
      phaseStartTime: Date.now(),
      phaseDuration: difficulty.selectDuration,
    })
  },

  incrementSelection: (pieceType: PieceType) => {
    set(state => {
      const existing = state.selection.find(e => e.pieceType === pieceType)
      if (existing) {
        return {
          selection: state.selection.map(e =>
            e.pieceType === pieceType ? { ...e, freeCount: e.freeCount + 1 } : e
          ),
        }
      }
      return {
        selection: [...state.selection, { pieceType, lockedCount: 0, freeCount: 1 }],
      }
    })
  },

  decrementSelection: (pieceType: PieceType) => {
    set(state => ({
      selection: state.selection
        .map(e =>
          e.pieceType === pieceType
            ? { ...e, freeCount: Math.max(0, e.freeCount - 1) }
            : e
        )
        .filter(e => e.lockedCount > 0 || e.freeCount > 0),
    }))
  },

  submitSelection: () => {
    const { selection, grid, gaps, lives, difficulty, phaseStartTime } = get()

    const pieceCount: Partial<Record<PieceType, number>> = {}
    for (const entry of selection) {
      const total = entry.lockedCount + entry.freeCount
      if (total > 0) pieceCount[entry.pieceType] = (pieceCount[entry.pieceType] ?? 0) + total
    }

    const result = solve(pieceCount, grid, gaps)
    const timeElapsed = Date.now() - phaseStartTime
    const timeRemaining = Math.max(0, difficulty.selectDuration - timeElapsed)

    if (result.solvable) {
      const minPieces = gaps.length
      const selectedPieces = Object.values(pieceCount).reduce((s, n) => s + (n ?? 0), 0)
      const speedBonus = Math.round(MAX_SPEED_BONUS * (timeRemaining / difficulty.selectDuration))
      const efficiencyRatio = selectedPieces === 0 ? 0 : minPieces / Math.max(selectedPieces, minPieces)
      const efficiencyBonus = Math.round(MAX_EFFICIENCY_BONUS * efficiencyRatio)

      set({
        phase: 'resolving',
        _resolution: { kind: 'perfect', placements: result.placements ?? [], coverage: 1 },
        roundScore: {
          correctness: CORRECTNESS_POINTS,
          speedBonus,
          efficiencyBonus,
          total: CORRECTNESS_POINTS + speedBonus + efficiencyBonus,
        },
      })
    } else {
      const newLives = lives - 1
      const fit = bestFit(pieceCount, grid)
      const coverage = fit.totalCells === 0 ? 0 : fit.filledCells / fit.totalCells

      const minPieces = gaps.length
      const selectedPieces = Object.values(pieceCount).reduce((s, n) => s + (n ?? 0), 0)
      const efficiencyRatio = selectedPieces === 0 ? 0 : minPieces / Math.max(selectedPieces, minPieces)

      const correctness = Math.round(CORRECTNESS_POINTS * coverage)
      const speedBonus = Math.round(MAX_SPEED_BONUS * (timeRemaining / difficulty.selectDuration) * coverage)
      const efficiencyBonus = Math.round(MAX_EFFICIENCY_BONUS * efficiencyRatio)

      set({
        phase: 'resolving',
        lives: Math.max(0, newLives),
        _resolution: { kind: 'partial', placements: fit.placements, coverage },
        roundScore: {
          correctness,
          speedBonus,
          efficiencyBonus,
          total: correctness + speedBonus + efficiencyBonus,
        },
      })
    }
  },

  applyPlacement: (placement) => {
    set(state => {
      const newGrid = state.grid.map(row => row.map(cell => ({ ...cell })))
      for (const [r, c] of placement.cells) {
        newGrid[r][c] = { status: 'placed', pieceType: placement.pieceType }
      }
      return { grid: newGrid }
    })
  },

  commitRoundScore: () => {
    set(state => {
      if (!state.roundScore) return {}
      return {
        score: state.score + state.roundScore.total,
        carryOvers: [],
      }
    })
  },

  holdPiece: (pieceType: PieceType, rotation: Rotation) => {
    set({ heldPiece: { pieceType, rotation } })
  },

  rotatePiece: () => {
    set(state => {
      if (!state.heldPiece) return {}
      return { heldPiece: { ...state.heldPiece, rotation: ((state.heldPiece.rotation + 1) % 4) as Rotation } }
    })
  },

  clearHeld: () => set({ heldPiece: null }),

  placePiece: (row: number, col: number) => {
    const { heldPiece, grid, selection } = get()
    if (!heldPiece) return
    const cells: [number, number][] = getRotatedCells(heldPiece.pieceType, heldPiece.rotation)

    const valid = cells.every(([dr, dc]) => {
      const r = row + dr
      const c = col + dc
      return r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c].status === 'empty'
    })
    if (!valid) return

    const newGrid = grid.map(r => r.map(cell => ({ ...cell })))
    for (const [dr, dc] of cells) {
      newGrid[row + dr][col + dc] = { status: 'placed', pieceType: heldPiece.pieceType }
    }

    const newSelection = selection.map(e => {
      if (e.pieceType !== heldPiece.pieceType) return e
      if (e.freeCount > 0) return { ...e, freeCount: e.freeCount - 1 }
      if (e.lockedCount > 0) return { ...e, lockedCount: e.lockedCount - 1 }
      return e
    }).filter(e => e.lockedCount > 0 || e.freeCount > 0)

    set({ grid: newGrid, selection: newSelection, heldPiece: null })
  },

  finishManualPlace: () => {
    const { selection, roundScore, score } = get()
    const carryOvers = selection
      .map(e => ({ pieceType: e.pieceType, count: e.lockedCount + e.freeCount }))
      .filter(co => co.count > 0)

    set({
      phase: 'scoring',
      carryOvers,
      score: score + (roundScore?.total ?? 0),
    })
  },

  nextRound: () => {
    set(state => ({ round: state.round + 1 }))
    get().startGame()
  },

  endGame: () => set({ phase: 'game-over' }),
}))
