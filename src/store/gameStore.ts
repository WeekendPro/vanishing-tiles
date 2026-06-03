import { create } from 'zustand'
import type {
  GameState, PieceType,
  DifficultyConfig, Placement, Resolution, ResolutionReason,
} from '@shared/types'
import { THEME_SEQUENCE } from '@shared/types'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import { resolveSelection } from '@shared/core/themeResolution'
import { THEME_CONFIG, GAP_COLOR_IDS } from '@shared/core/themeConfig'
import { scoreRound, MAX_TRIES, levelTotal, ROUNDS_PER_LEVEL, MAX_LIVES } from '@shared/core/scoring'
import { startSession, submitAttempt, type SubmitAttemptResult } from '../lib/api'

// ── Difficulty table (index = round - 1, capped at last entry) ──────────────

// Memorize (viewDuration) rises with gapCount on a comfortable ~1.2–1.33s/gap
// curve so every level stays solvable — the challenge is HOW FAST you clear it,
// not WHETHER you can. The curve tapers slightly at the top (toward ~1.06s/gap)
// where adjacent shapes chunk in memory. selectDuration rises too so picking
// pieces is never the bottleneck. Speed scoring is ratio-based (scoring.ts), so
// these absolute durations self-normalize and don't change the score ceiling.
export const DIFFICULTY_TABLE: DifficultyConfig[] = [
  { viewDuration:  4000, selectDuration: 10000, placeDuration: 60000, gapCount:  3, complexity: 'simple'  },
  { viewDuration:  5000, selectDuration: 11000, placeDuration: 60000, gapCount:  4, complexity: 'simple'  },
  { viewDuration:  6500, selectDuration: 12000, placeDuration: 60000, gapCount:  5, complexity: 'simple'  },
  { viewDuration:  8000, selectDuration: 14000, placeDuration: 60000, gapCount:  6, complexity: 'medium'  },
  { viewDuration:  9000, selectDuration: 15000, placeDuration: 60000, gapCount:  7, complexity: 'medium'  },
  { viewDuration: 10000, selectDuration: 16000, placeDuration: 60000, gapCount:  8, complexity: 'medium'  },
  { viewDuration: 11000, selectDuration: 17000, placeDuration: 60000, gapCount:  9, complexity: 'complex' },
  { viewDuration: 12000, selectDuration: 18000, placeDuration: 60000, gapCount: 10, complexity: 'complex' },
  { viewDuration: 13000, selectDuration: 19000, placeDuration: 60000, gapCount: 11, complexity: 'complex' },
  { viewDuration: 14000, selectDuration: 20000, placeDuration: 60000, gapCount: 12, complexity: 'complex' },
  { viewDuration: 15000, selectDuration: 21000, placeDuration: 60000, gapCount: 13, complexity: 'complex' },
  { viewDuration: 16000, selectDuration: 22000, placeDuration: 60000, gapCount: 14, complexity: 'complex' },
  { viewDuration: 16500, selectDuration: 22000, placeDuration: 60000, gapCount: 15, complexity: 'complex' },
  { viewDuration: 17000, selectDuration: 23000, placeDuration: 60000, gapCount: 16, complexity: 'complex' },
  { viewDuration: 17000, selectDuration: 23000, placeDuration: 60000, gapCount: 16, complexity: 'complex' },
]

function getDifficulty(round: number): DifficultyConfig {
  return DIFFICULTY_TABLE[Math.min(round - 1, DIFFICULTY_TABLE.length - 1)]
}

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
  startLevel: () => void
  advanceRound: () => void
  loseLife: () => void
  resetGame: () => void
  incrementSelection: (pieceType: PieceType, color?: string) => void
  decrementSelection: (pieceType: PieceType, color?: string) => void
  pauseGame: () => void
  resumeGame: () => void
  pausedElapsed: number
  _resolution: Resolution | null
  journeyResult: SubmitAttemptResult | null
  journeyError: string | null
  priorPr: number
  levelDisplayNumber: number | null
  levelName: string | null
  submitting: boolean
  clearJourneyError: () => void
  startJourneySession: (levelId: string, priorPr: number, displayNumber: number, levelName?: string | null) => Promise<void>
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
  roundIndex: 0,
  roundTheme: THEME_SEQUENCE[0],
  livesRemaining: MAX_LIVES,
  roundResults: [],
  levelComplete: false,
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL_STATE,
  pausedElapsed: 0,
  _resolution: null,
  journeyResult: null,
  journeyError: null,
  priorPr: 0,
  levelDisplayNumber: null,
  levelName: null,
  submitting: false,

  resetGame: () => set({ ...INITIAL_STATE, _resolution: null, journeyResult: null, journeyError: null, priorPr: 0, levelDisplayNumber: null, levelName: null, submitting: false }),

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
    get().startLevel()
  },

  startGame: () => {
    const { round, roundIndex } = get()
    const roundTheme = THEME_SEQUENCE[roundIndex]
    const difficulty = getDifficulty(round)
    const colorCoded = THEME_CONFIG[roundTheme].colorMatters
    const { grid, gaps } = generatePuzzle(
      colorCoded
        ? {
            gapCount: difficulty.gapCount,
            complexity: difficulty.complexity,
            colorCoded: { shapeTypeCount: 1, palette: [...GAP_COLOR_IDS] },
          }
        : difficulty
    )

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
      roundTheme,
    })
  },

  startLevel: () => {
    set({
      mode: get().mode,
      roundIndex: 0,
      roundTheme: THEME_SEQUENCE[0],
      livesRemaining: MAX_LIVES,
      roundResults: [],
      levelComplete: false,
      score: 0,
    })
    get().startGame()
  },

  // CTA after a cleared round: bank the round total, then either start the next
  // round or finish the level (adding the lives bonus to the score).
  advanceRound: () => {
    const { roundScore, roundResults, roundIndex, livesRemaining } = get()
    const banked = [...roundResults, roundScore?.total ?? 0]
    const nextIndex = roundIndex + 1
    if (nextIndex >= ROUNDS_PER_LEVEL) {
      set({ roundResults: banked, levelComplete: true, score: levelTotal(banked, livesRemaining) })
      return
    }
    set({
      roundResults: banked,
      roundIndex: nextIndex,
      roundTheme: THEME_SEQUENCE[nextIndex],
      score: Math.max(0, banked.reduce((s, n) => s + n, 0)),
    })
    get().startGame()
  },

  loseLife: () => set(state => ({ livesRemaining: Math.max(0, state.livesRemaining - 1) })),

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

  incrementSelection: (pieceType: PieceType, color?: string) => {
    set(state => {
      const existing = state.selection.find(e => e.pieceType === pieceType && e.color === color)
      if (existing) {
        return {
          selection: state.selection.map(e =>
            e.pieceType === pieceType && e.color === color ? { ...e, freeCount: e.freeCount + 1 } : e
          ),
        }
      }
      return { selection: [...state.selection, { pieceType, color, freeCount: 1 }] }
    })
  },

  decrementSelection: (pieceType: PieceType, color?: string) => {
    set(state => ({
      selection: state.selection
        .map(e =>
          e.pieceType === pieceType && e.color === color
            ? { ...e, freeCount: Math.max(0, e.freeCount - 1) }
            : e
        )
        .filter(e => e.freeCount > 0),
    }))
  },

  submitSelection: () => {
    const { selection, grid, gaps, difficulty, phaseStartTime, viewTimeRemaining, roundTheme } = get()

    const selectElapsed = Date.now() - phaseStartTime
    const selectTimeRemaining = Math.max(0, difficulty.selectDuration - selectElapsed)
    const res = resolveSelection({ selection, grid, gaps, theme: roundTheme })
    const selectedPieces = selection.reduce((s, e) => s + e.freeCount, 0)

    if (res.solvable) {
      // Per-round scoring: Speed + Efficiency only (no Accuracy/Attempts in the
      // multi-round model — lives are pooled per level, not per round).
      const minPieces = gaps.length
      const r = scoreRound({
        viewTimeRemaining,
        viewDuration: difficulty.viewDuration,
        selectTimeRemaining,
        selectDuration: difficulty.selectDuration,
        minPieces,
        selectedPieces,
        selectOnly: roundTheme === 'flashMob',
      })

      set({
        phase: 'resolving',
        _resolution: { kind: 'perfect', placements: res.placements, coverage: 1 },
        roundScore: {
          accuracy: 0,
          speedBonus: r.speed,
          efficiencyBonus: r.efficiency,
          attemptsBonus: 0,
          stars: 0,
          total: r.total,
        },
      })
    } else {
      // Failed round: no negative penalty — a failed round scores 0, never below.
      const uncovered = res.totalCells - res.filledCells
      const selectedCells = selection.reduce(
        (sum, e) => sum + e.freeCount * (e.pieceType === 'SINGLE' ? 1 : 4), 0)
      let reason: ResolutionReason
      if (uncovered === 0) reason = 'too-many'
      else if (selectedCells >= res.totalCells) reason = 'wrong-shapes'
      // uncovered cells → nearest whole piece, clamped to ≥1
      else reason = Math.max(1, Math.round(uncovered / 4)) === 1 ? 'missed-one' : 'missed-many'

      // A failed round spends one pooled life (retry replays the same board).
      get().loseLife()
      set({
        phase: 'resolving',
        _resolution: { kind: 'partial', placements: res.placements, coverage: res.coverage, reason },
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

  startJourneySession: async (levelId, priorPr, displayNumber, levelName = null) => {
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
      levelName,
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
