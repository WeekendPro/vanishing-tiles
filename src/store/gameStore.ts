import { create } from 'zustand'
import type {
  GameState, PieceType,
  DifficultyConfig, Placement, Resolution, ResolutionReason,
} from '@shared/types'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import { solve, bestFit } from '@shared/engine/solver'
import { scoreClear, MAX_TRIES } from '@shared/core/scoring'
import { startSession, submitAttempt, type SubmitAttemptResult } from '../lib/api'

// ── Difficulty table (index = round - 1, capped at last entry) ──────────────

// viewDuration eases down WITHIN each complexity tier, but bumps UP at every
// tier step-up (rounds 4 and 7) to cushion the difficulty leap — a cumulative
// +2000ms per tier over the smooth 10000→…→base curve.
export const DIFFICULTY_TABLE: DifficultyConfig[] = [
  { viewDuration: 10000, selectDuration: 15000, placeDuration: 60000, gapCount:  3, complexity: 'simple'  },
  { viewDuration:  9000, selectDuration: 15000, placeDuration: 60000, gapCount:  4, complexity: 'simple'  },
  { viewDuration:  8100, selectDuration: 14000, placeDuration: 60000, gapCount:  5, complexity: 'simple'  },
  { viewDuration:  9300, selectDuration: 14000, placeDuration: 60000, gapCount:  6, complexity: 'medium'  },
  { viewDuration:  8600, selectDuration: 13000, placeDuration: 60000, gapCount:  7, complexity: 'medium'  },
  { viewDuration:  8000, selectDuration: 13000, placeDuration: 60000, gapCount:  8, complexity: 'medium'  },
  { viewDuration:  9500, selectDuration: 12000, placeDuration: 60000, gapCount:  9, complexity: 'complex' },
  { viewDuration:  9000, selectDuration: 12000, placeDuration: 60000, gapCount: 10, complexity: 'complex' },
  { viewDuration:  8500, selectDuration: 11000, placeDuration: 60000, gapCount: 11, complexity: 'complex' },
  { viewDuration:  8100, selectDuration: 11000, placeDuration: 60000, gapCount: 12, complexity: 'complex' },
  { viewDuration:  7700, selectDuration: 10000, placeDuration: 60000, gapCount: 13, complexity: 'complex' },
  { viewDuration:  7300, selectDuration: 10000, placeDuration: 60000, gapCount: 14, complexity: 'complex' },
  { viewDuration:  7000, selectDuration:  9000, placeDuration: 60000, gapCount: 15, complexity: 'complex' },
  { viewDuration:  6700, selectDuration:  9000, placeDuration: 60000, gapCount: 16, complexity: 'complex' },
  { viewDuration:  6500, selectDuration:  9000, placeDuration: 60000, gapCount: 16, complexity: 'complex' },
]

function getDifficulty(round: number): DifficultyConfig {
  return DIFFICULTY_TABLE[Math.min(round - 1, DIFFICULTY_TABLE.length - 1)]
}

// ── Scoring constants ────────────────────────────────────────────────────────

// Mirrors PILLAR_MAX.speed in core/scoring; kept here for the resolution UI's
// turtle threshold and the speed-bonus tests.
export const MAX_SPEED_BONUS = 500

// ── Store interface ──────────────────────────────────────────────────────────

interface GameStore extends GameState {
  startPractice: () => void
  startGame: () => void
  beginViewing: () => void
  endViewing: () => void
  submitSelection: () => void
  applyPlacement: (placement: Placement) => void
  commitRoundScore: () => void
  nextRound: () => void
  retryRound: () => void
  newGame: () => void
  resetGame: () => void
  incrementSelection: (pieceType: PieceType) => void
  decrementSelection: (pieceType: PieceType) => void
  pauseGame: () => void
  resumeGame: () => void
  pausedElapsed: number
  _resolution: Resolution | null
  journeyResult: SubmitAttemptResult | null
  journeyError: string | null
  priorPr: number
  levelDisplayNumber: number | null
  submitting: boolean
  clearJourneyError: () => void
  startJourneySession: (levelId: string, priorPr: number, displayNumber: number) => Promise<void>
  submitJourneyAttempt: () => Promise<void>
  retryJourney: () => void
  submit: () => void | Promise<void>
}

const INITIAL_STATE: GameState = {
  mode: 'practice',
  phase: 'idle',
  paused: false,
  round: 1,
  score: 0,
  triesUsed: 1,
  maxTries: MAX_TRIES,
  sessionId: crypto.randomUUID(),
  levelId: null,
  sessionGrid: [],
  grid: [],
  gaps: [],
  selection: [],
  phaseStartTime: 0,
  phaseDuration: 0,
  viewTimeRemaining: 0,
  roundScore: null,
  difficulty: DIFFICULTY_TABLE[0],
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL_STATE,
  pausedElapsed: 0,
  _resolution: null,
  journeyResult: null,
  journeyError: null,
  priorPr: 0,
  levelDisplayNumber: null,
  submitting: false,

  resetGame: () => set({ ...INITIAL_STATE, _resolution: null, journeyResult: null, journeyError: null, priorPr: 0, levelDisplayNumber: null, submitting: false }),

  pauseGame: () => set(state => {
    if (state.paused) return {}
    return { paused: true, pausedElapsed: Date.now() - state.phaseStartTime }
  }),

  resumeGame: () => set(state => {
    if (!state.paused) return {}
    return {
      paused: false,
      phaseStartTime: (state.phase === 'viewing' || state.phase === 'selecting')
        ? Date.now() - state.pausedElapsed
        : state.phaseStartTime,
    }
  }),

  startPractice: () => {
    set({ mode: 'practice' })
    get().startGame()
  },

  startGame: () => {
    const { round } = get()
    const difficulty = getDifficulty(round)
    const { grid, gaps } = generatePuzzle(difficulty)

    // The round opens with a 3-2-1 countdown; the view timer starts only
    // once beginViewing fires, so memorization time isn't eaten by the count.
    // sessionGrid keeps the pristine board so all 3 tries replay the same puzzle.
    set({
      phase: 'countdown',
      paused: false,
      grid,
      sessionGrid: grid.map(row => row.map(cell => ({ ...cell }))),
      gaps,
      selection: [],
      difficulty,
      sessionId: crypto.randomUUID(),
      triesUsed: 1,
      roundScore: null,
      phaseStartTime: 0,
      phaseDuration: 0,
      viewTimeRemaining: 0,
      _resolution: null,
    })
  },

  beginViewing: () => {
    const { difficulty } = get()
    set({
      phase: 'viewing',
      phaseStartTime: Date.now(),
      phaseDuration: difficulty.viewDuration,
    })
  },

  endViewing: () => {
    const { difficulty, phaseStartTime } = get()
    // Capture the view time the player saved by hitting "Ready" early so it can
    // feed the Speed bonus alongside selection time. (Timer expiry ⇒ ~0 saved.)
    const viewElapsed = Date.now() - phaseStartTime
    const viewTimeRemaining = Math.max(0, difficulty.viewDuration - viewElapsed)
    set({
      phase: 'selecting',
      phaseStartTime: Date.now(),
      phaseDuration: difficulty.selectDuration,
      viewTimeRemaining,
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
    const { selection, grid, gaps, triesUsed, maxTries, difficulty, phaseStartTime, viewTimeRemaining } = get()

    const pieceCount: Partial<Record<PieceType, number>> = {}
    for (const entry of selection) {
      const total = entry.freeCount
      if (total > 0) pieceCount[entry.pieceType] = (pieceCount[entry.pieceType] ?? 0) + total
    }

    const result = solve(pieceCount, grid, gaps)
    const selectElapsed = Date.now() - phaseStartTime
    const selectTimeRemaining = Math.max(0, difficulty.selectDuration - selectElapsed)

    if (result.solvable) {
      const minPieces = gaps.length
      const selectedPieces = Object.values(pieceCount).reduce((s, n) => s + (n ?? 0), 0)
      // Single source of scoring truth: core/scoring is shared with the server.
      const ps = scoreClear({
        triesUsed,
        viewTimeRemaining,
        viewDuration: difficulty.viewDuration,
        selectTimeRemaining,
        selectDuration: difficulty.selectDuration,
        minPieces,
        selectedPieces,
      })

      set({
        phase: 'resolving',
        _resolution: { kind: 'perfect', placements: result.placements ?? [], coverage: 1 },
        roundScore: {
          accuracy: ps.accuracy,
          speedBonus: ps.speed,
          efficiencyBonus: ps.efficiency,
          attemptsBonus: ps.attempts,
          stars: ps.stars,
          total: ps.total,
        },
      })
    } else {
      // Failed try: no negative penalty — a failed round scores 0, never below.
      // Advance to the next try unless this was the last one (game over).
      const exhausted = triesUsed >= maxTries
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

      set({
        phase: 'resolving',
        triesUsed: exhausted ? triesUsed : triesUsed + 1,
        _resolution: { kind: 'partial', placements: fit.placements, coverage, reason },
        roundScore: {
          accuracy: 0,
          speedBonus: 0,
          efficiencyBonus: 0,
          attemptsBonus: 0,
          stars: 0,
          total: 0,
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
        score: Math.max(0, state.score + state.roundScore.total),
      }
    })
  },

  nextRound: () => {
    set(state => ({ round: state.round + 1 }))
    get().startGame()
  },

  // A failed try replays the SAME puzzle: restore the pristine board from
  // sessionGrid and re-run the countdown. triesUsed already advanced in
  // submitSelection, so it is left untouched here.
  retryRound: () => {
    set(state => ({
      phase: 'countdown',
      paused: false,
      selection: [],
      roundScore: null,
      _resolution: null,
      grid: state.sessionGrid.map(row => row.map(cell => ({ ...cell }))),
      phaseStartTime: 0,
      phaseDuration: 0,
      viewTimeRemaining: 0,
    }))
  },

  newGame: () => {
    get().resetGame()
    get().startGame()
  },

  startJourneySession: async (levelId, priorPr, displayNumber) => {
    const res = await startSession(levelId)
    const difficulty: DifficultyConfig = {
      viewDuration: res.view_duration_ms,
      selectDuration: res.select_duration_ms,
      placeDuration: 0,
      gapCount: res.puzzle.gaps.length,
      complexity: 'medium',
    }
    set({
      mode: 'journey',
      phase: 'countdown',
      sessionId: res.session_id,
      levelId,
      priorPr,
      levelDisplayNumber: displayNumber,
      grid: res.puzzle.grid.map(row => row.map(cell => ({ ...cell }))),
      sessionGrid: res.puzzle.grid.map(row => row.map(cell => ({ ...cell }))),
      gaps: res.puzzle.gaps,
      selection: [],
      difficulty,
      maxTries: res.max_tries,
      triesUsed: 1,
      roundScore: null,
      journeyResult: null,
      journeyError: null,
      phaseStartTime: 0,
      phaseDuration: 0,
      viewTimeRemaining: 0,
      _resolution: null,
    })
  },

  submitJourneyAttempt: async () => {
    const { phase, selection, sessionId, difficulty, phaseStartTime, viewTimeRemaining, triesUsed } = get()
    if (phase !== 'selecting') return // guard against double-submit (timer + click)

    const apiSelection = selection
      .filter(e => e.freeCount > 0)
      .map(e => ({ pieceType: e.pieceType, count: e.freeCount }))
    const selectElapsed = Date.now() - phaseStartTime
    const selectTimeRemaining = Math.max(0, difficulty.selectDuration - selectElapsed)

    set({ submitting: true })

    let res: SubmitAttemptResult
    try {
      res = await submitAttempt({
        sessionId,
        selection: apiSelection,
        viewMsRemaining: viewTimeRemaining,
        selectMsRemaining: selectTimeRemaining,
      })
    } catch (e) {
      set({ journeyError: e instanceof Error ? e.message : 'Submit failed', submitting: false })
      return
    }

    const solved = res.attempt.solved
    set({
      phase: 'resolving',
      submitting: false,
      journeyResult: res,
      _resolution: {
        kind: solved ? 'perfect' : 'partial',
        placements: res.placements ?? [],
        coverage: res.attempt.coverage,
      },
      // Mirror the server: another try only if the session is still active.
      triesUsed: res.session_status === 'active' ? triesUsed + 1 : triesUsed,
      roundScore: null,
    })
  },

  // Try Again on the journey path: replay the SAME session_id and the SAME
  // in-memory puzzle (restore sessionGrid). Does NOT call startSession — that
  // would re-roll the seed and break the 3-tries/same-puzzle invariant.
  retryJourney: () => {
    set(state => ({
      phase: 'countdown',
      paused: false,
      selection: [],
      roundScore: null,
      journeyResult: null,
      journeyError: null,
      _resolution: null,
      grid: state.sessionGrid.map(row => row.map(cell => ({ ...cell }))),
      phaseStartTime: 0,
      phaseDuration: 0,
      viewTimeRemaining: 0,
    }))
  },

  clearJourneyError: () => set({ journeyError: null }),

  submit: () => {
    return get().mode === 'journey'
      ? get().submitJourneyAttempt()
      : get().submitSelection()
  },
}))
