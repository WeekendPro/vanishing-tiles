import { create } from 'zustand'
import type {
  GameState, PieceType,
  DifficultyConfig, Placement, Resolution, ResolutionReason,
} from '../types'
import { generatePuzzle } from '../engine/puzzleGenerator'
import { solve, bestFit } from '../engine/solver'

// ── Difficulty table (index = round - 1, capped at last entry) ──────────────

export const DIFFICULTY_TABLE: DifficultyConfig[] = [
  { viewDuration: 5000, selectDuration: 15000, placeDuration: 60000, gapCount:  3, complexity: 'simple'  },
  { viewDuration: 4700, selectDuration: 15000, placeDuration: 60000, gapCount:  4, complexity: 'simple'  },
  { viewDuration: 4400, selectDuration: 14000, placeDuration: 60000, gapCount:  5, complexity: 'simple'  },
  { viewDuration: 4100, selectDuration: 14000, placeDuration: 60000, gapCount:  6, complexity: 'medium'  },
  { viewDuration: 3800, selectDuration: 13000, placeDuration: 60000, gapCount:  7, complexity: 'medium'  },
  { viewDuration: 3500, selectDuration: 13000, placeDuration: 60000, gapCount:  8, complexity: 'medium'  },
  { viewDuration: 3300, selectDuration: 12000, placeDuration: 60000, gapCount:  9, complexity: 'complex' },
  { viewDuration: 3100, selectDuration: 12000, placeDuration: 60000, gapCount: 10, complexity: 'complex' },
  { viewDuration: 2900, selectDuration: 11000, placeDuration: 60000, gapCount: 11, complexity: 'complex' },
  { viewDuration: 2800, selectDuration: 11000, placeDuration: 60000, gapCount: 12, complexity: 'complex' },
  { viewDuration: 2700, selectDuration: 10000, placeDuration: 60000, gapCount: 13, complexity: 'complex' },
  { viewDuration: 2600, selectDuration: 10000, placeDuration: 60000, gapCount: 14, complexity: 'complex' },
  { viewDuration: 2500, selectDuration:  9000, placeDuration: 60000, gapCount: 15, complexity: 'complex' },
  { viewDuration: 2500, selectDuration:  9000, placeDuration: 60000, gapCount: 16, complexity: 'complex' },
  { viewDuration: 2500, selectDuration:  9000, placeDuration: 60000, gapCount: 16, complexity: 'complex' },
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
  nextRound: () => void
  endGame: () => void
  resetGame: () => void
  incrementSelection: (pieceType: PieceType) => void
  decrementSelection: (pieceType: PieceType) => void
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
    const { round } = get()
    const difficulty = getDifficulty(round)
    const { grid, gaps } = generatePuzzle(difficulty)

    set({
      phase: 'viewing',
      grid,
      gaps,
      selection: [],
      difficulty,
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
        selection: [...state.selection, { pieceType, freeCount: 1 }],
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
        .filter(e => e.freeCount > 0),
    }))
  },

  submitSelection: () => {
    const { selection, grid, gaps, lives, difficulty, phaseStartTime } = get()

    const pieceCount: Partial<Record<PieceType, number>> = {}
    for (const entry of selection) {
      const total = entry.freeCount
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

      const uncovered = fit.totalCells - fit.filledCells
      const selectedCells = Object.entries(pieceCount)
        .reduce((sum, [type, n]) => sum + (n ?? 0) * (type === 'SINGLE' ? 1 : 4), 0)
      let reason: ResolutionReason
      if (uncovered === 0) reason = 'too-many'
      else if (selectedCells >= fit.totalCells) reason = 'wrong-shapes'
      // uncovered cells → nearest whole piece, clamped to ≥1
      else reason = Math.max(1, Math.round(uncovered / 4)) === 1 ? 'missed-one' : 'missed-many'

      const minPieces = gaps.length
      const selectedPieces = Object.values(pieceCount).reduce((s, n) => s + (n ?? 0), 0)
      const efficiencyRatio = selectedPieces === 0 ? 0 : minPieces / Math.max(selectedPieces, minPieces)

      const correctness = Math.round(CORRECTNESS_POINTS * coverage)
      const speedBonus = Math.round(MAX_SPEED_BONUS * (timeRemaining / difficulty.selectDuration) * coverage)
      const efficiencyBonus = Math.round(MAX_EFFICIENCY_BONUS * efficiencyRatio)

      set({
        phase: 'resolving',
        lives: Math.max(0, newLives),
        _resolution: { kind: 'partial', placements: fit.placements, coverage, reason },
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
      }
    })
  },

  nextRound: () => {
    set(state => ({ round: state.round + 1 }))
    get().startGame()
  },

  endGame: () => set({ phase: 'game-over' }),
}))
