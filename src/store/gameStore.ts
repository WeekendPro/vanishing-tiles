import { create } from 'zustand'
import type {
  GameState, PieceType, RoundTheme,
  DifficultyConfig, Placement, Resolution, ResolutionReason,
  ComponentKey,
} from '@shared/types'
import { THEME_SEQUENCE } from '@shared/types'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import { resolveSelection } from '@shared/core/themeResolution'
import { THEME_CONFIG, GAP_COLOR_IDS } from '@shared/core/themeConfig'
import { scoreRound, MAX_TRIES, levelTotal, ROUNDS_PER_LEVEL, MAX_LIVES } from '@shared/core/scoring'
import { COMPONENT_THEME, isPlayable } from '../lib/components'
import { componentScore } from '../lib/journeyScoring'
import { useProgressStore } from './progressStore'
import { useSettingsStore } from './settingsStore'
import { GIT_TRACKS, nodeId, type GitTrackKey } from '../lib/gitMap'

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

/** Git Map node difficulty: stretch the DIFFICULTY_TABLE across the track so the
 *  track's final level lands on the hardest rung (even ramp regardless of length). */
export function gitDifficulty(track: GitTrackKey, level: number): DifficultyConfig {
  const floors = GIT_TRACKS[track].floors
  const idx = floors <= 1 ? 0 : Math.round(((level - 1) / (floors - 1)) * (DIFFICULTY_TABLE.length - 1))
  return DIFFICULTY_TABLE[Math.min(Math.max(idx, 0), DIFFICULTY_TABLE.length - 1)]
}

/** Chromatic shape variety scales with board size: a gentle 1-shape on-ramp on
 *  the smallest boards (e.g. the first level), up to a 4-shape mix on the busiest.
 *  Capped downstream by the generator's available complexity pieces. */
export function colorShapeTypeCount(gapCount: number): number {
  if (gapCount <= 3) return 1
  if (gapCount <= 6) return 2
  if (gapCount <= 10) return 3
  return 4
}

// Flash Mob's viewing is a forced, unskippable flash sequence whose length is
// derived from the gap count (gapCount × 1000ms), NOT the difficulty table's
// viewDuration. Every consumer of the view-phase length — the flash sequence,
// the GameShell timer bar, and the Speed-scoring viewDuration — must agree, so
// they all route through this single helper.
export function effectiveViewDuration(roundTheme: RoundTheme, difficulty: DifficultyConfig): number {
  return roundTheme === 'flashMob' ? difficulty.gapCount * 1000 : difficulty.viewDuration
}

// ── Store interface ──────────────────────────────────────────────────────────

interface GameStore extends GameState {
  startPractice: () => void
  startGame: () => void
  beginCountdown: () => void
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
  appendQueuePiece: (pieceType: PieceType) => void
  popQueuePiece: () => void
  pauseGame: () => void
  resumeGame: () => void
  pausedElapsed: number
  _resolution: Resolution | null
  // Journey mode uses a FIXED per-level difficulty profile (levelDifficulty) for
  // each component play. submitting drives the GameShell ArcadeLoader while a
  // server write is in-flight (currently unused for component plays, kept for
  // future global-record submissions).
  levelDifficulty: DifficultyConfig | null
  levelDisplayNumber: number | null
  levelName: string | null
  submitting: boolean
  submit: () => void | Promise<void>
  startComponent: (levelId: string, component: ComponentKey, difficulty: DifficultyConfig, displayNumber: number, levelName?: string | null) => void
  retryComponent: () => void
  replayComponent: () => void
  gitTrack: GitTrackKey | null
  gitLevel: number | null
  startGitLevel: (track: GitTrackKey, level: number) => void
  nextGitLevel: () => void
  replayGitLevel: () => void
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
  activeComponent: null,
  livesLost: 0,
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL_STATE,
  pausedElapsed: 0,
  _resolution: null,
  levelDifficulty: null,
  levelDisplayNumber: null,
  levelName: null,
  submitting: false,
  gitTrack: null,
  gitLevel: null,

  resetGame: () => set({ ...INITIAL_STATE, _resolution: null, levelDifficulty: null, levelDisplayNumber: null, levelName: null, submitting: false, gitTrack: null, gitLevel: null }),

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
    set({ mode: 'practice', levelDifficulty: null, gitTrack: null, gitLevel: null })
    get().startLevel()
  },

  startGame: () => {
    const { round, roundIndex, mode, levelDifficulty, activeComponent } = get()
    const roundTheme = mode === 'journey' && activeComponent && isPlayable(activeComponent)
      ? COMPONENT_THEME[activeComponent]
      : THEME_SEQUENCE[roundIndex]
    // Journey: every round in a level shares the level's fixed difficulty profile.
    // Practice: difficulty escalates by round via the DIFFICULTY_TABLE.
    const difficulty = mode === 'journey' && levelDifficulty
      ? levelDifficulty
      : getDifficulty(round)
    const { colorMatters, orderMatters } = THEME_CONFIG[roundTheme]
    const { grid, gaps } = generatePuzzle(
      colorMatters
        ? {
            gapCount: difficulty.gapCount,
            complexity: difficulty.complexity,
            adjacency: difficulty.adjacency,
            colorCoded: { shapeTypeCount: colorShapeTypeCount(difficulty.gapCount), palette: [...GAP_COLOR_IDS] },
          }
        : orderMatters
          ? { gapCount: difficulty.gapCount, complexity: difficulty.complexity, adjacency: difficulty.adjacency, sequential: true }
          : difficulty
    )

    // The round opens with a 3-2-1 countdown; the view timer starts only
    // once beginViewing fires, so memorization time isn't eaten by the count.
    // sessionGrid keeps the pristine board so all 3 tries replay the same puzzle.
    // Journey component entry opens on the briefing (puzzle-detail) page — unless
    // the user has opted out of this puzzle's instructions ("Don't show this again").
    // Practice rounds always go straight to the countdown.
    const optedOutOfBriefing =
      !!activeComponent && isPlayable(activeComponent) &&
      useSettingsStore.getState().isBriefingHidden(activeComponent)
    set({
      phase: mode === 'journey' && !optedOutOfBriefing ? 'briefing' : 'countdown',
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

  beginCountdown: () => set({ phase: 'countdown', paused: false }),

  beginViewing: () => {
    const { difficulty, roundTheme } = get()
    set({
      phase: 'viewing',
      phaseStartTime: Date.now(),
      phaseDuration: effectiveViewDuration(roundTheme, difficulty),
    })
  },

  endViewing: () => {
    const { difficulty, roundTheme, phaseStartTime } = get()
    // Capture the view time the player saved by hitting "Ready" early so it can
    // feed the Speed bonus alongside selection time. (Timer expiry ⇒ ~0 saved.)
    const viewDuration = effectiveViewDuration(roundTheme, difficulty)
    const viewElapsed = Date.now() - phaseStartTime
    const viewTimeRemaining = Math.max(0, viewDuration - viewElapsed)
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

  // Sequential rounds use `selection` as an ORDERED queue: one singleton entry
  // per tap (never aggregated), so tap order is preserved for order-aware
  // validation and the in-order fly-in.
  appendQueuePiece: (pieceType: PieceType) => {
    set(state => ({ selection: [...state.selection, { pieceType, freeCount: 1 }] }))
  },

  popQueuePiece: () => {
    set(state => ({ selection: state.selection.slice(0, -1) }))
  },

  submitSelection: () => {
    const { selection, grid, gaps, difficulty, phaseStartTime, viewTimeRemaining, roundTheme } = get()

    const selectElapsed = Date.now() - phaseStartTime
    const selectTimeRemaining = Math.max(0, difficulty.selectDuration - selectElapsed)
    const res = resolveSelection({ selection, grid, gaps, theme: roundTheme })
    const selectedPieces = selection.reduce((s, e) => s + e.freeCount, 0)

    const { activeComponent, levelId } = get()
    if (get().mode === 'journey') {
      const selectOnly = roundTheme === 'flashMob'
      const viewBudget = effectiveViewDuration(roundTheme, difficulty)
      const consumed = selectOnly
        ? difficulty.selectDuration - selectTimeRemaining
        : (viewBudget - viewTimeRemaining) + (difficulty.selectDuration - selectTimeRemaining)
      const allotted = selectOnly ? difficulty.selectDuration : viewBudget + difficulty.selectDuration

      if (res.solvable) {
        const score = componentScore({ solved: true, livesLost: get().livesLost, consumed, allotted })
        if (levelId && activeComponent) useProgressStore.getState().recordPlay(levelId, activeComponent, score)
        set({
          phase: 'resolving',
          _resolution: { kind: 'perfect', placements: res.placements, coverage: 1 },
          roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: score },
        })
        return
      }

      // Failure: spend a life.
      get().loseLife()
      set(state => ({ livesLost: Math.min(2, state.livesLost + 1) }))
      const outOfLives = get().livesRemaining <= 0
      const uncovered = res.totalCells - res.filledCells
      let reason: ResolutionReason
      if (roundTheme === 'sequential') reason = 'wrong-order'
      else if (uncovered === 0) reason = 'too-many'
      else reason = Math.max(1, Math.round(uncovered / 4)) === 1 ? 'missed-one' : 'missed-many'

      if (outOfLives && levelId && activeComponent) {
        useProgressStore.getState().recordPlay(levelId, activeComponent, 0) // bumps timesPlayed/lastPlayed; best unchanged
      }
      set({
        phase: 'resolving',
        _resolution: { kind: 'partial', placements: res.placements, coverage: res.coverage, reason },
        roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 },
      })
      return
    }
    // ── existing practice path continues unchanged below ──

    if (res.solvable) {
      // Per-round scoring: Speed + Efficiency only (no Accuracy/Attempts in the
      // multi-round model — lives are pooled per level, not per round).
      const minPieces = gaps.length
      const r = scoreRound({
        viewTimeRemaining,
        viewDuration: effectiveViewDuration(roundTheme, difficulty),
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
        (sum, e) => sum + e.freeCount * 4, 0)
      let reason: ResolutionReason
      // Sequential rounds fail atomically on any count/shape/order mismatch; the
      // shape-vs-count heuristic below would misreport a right-shapes/wrong-order
      // pick as "wrong shapes" or "too many", so use an order-specific reason.
      if (roundTheme === 'sequential') reason = 'wrong-order'
      else if (uncovered === 0) reason = 'too-many'
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
        newGrid[r][c] = { status: 'placed', pieceType: placement.pieceType, color: placement.color }
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

  // Start a single-component Journey play: pin difficulty, set the component,
  // reset lives, and run ONE puzzle (no gauntlet).
  startComponent: (levelId, component, difficulty, displayNumber, levelName = null) => {
    set({
      mode: 'journey',
      levelId,
      activeComponent: component,
      levelDifficulty: difficulty,
      levelDisplayNumber: displayNumber,
      levelName,
      livesRemaining: MAX_LIVES,
      livesLost: 0,
      roundIndex: 0,
      score: 0,
      roundResults: [],
      levelComplete: false,
      submitting: false,
      gitTrack: null,
      gitLevel: null,
    })
    get().startGame()
  },

  // Failed attempt with lives left: replay the SAME puzzle (pristine board),
  // re-run the countdown. livesRemaining/livesLost already advanced in submit.
  retryComponent: () => {
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

  // "Play Again" from the result screen: fresh puzzle, full lives, same component.
  replayComponent: () => {
    const { levelId, activeComponent, levelDifficulty, levelDisplayNumber, levelName } = get()
    if (!levelId || !activeComponent || !levelDifficulty) return
    get().startComponent(levelId, activeComponent, levelDifficulty, levelDisplayNumber ?? 1, levelName)
  },

  // Start a Git Map node: pin the track's component + stretched difficulty, run ONE
  // puzzle with 3 lives, opening on the briefing (unless opted out) then countdown.
  startGitLevel: (track, level) => {
    const t = GIT_TRACKS[track]
    set({
      mode: 'journey',
      gitTrack: track,
      gitLevel: level,
      levelId: nodeId(track, level),
      activeComponent: t.component,
      levelDifficulty: gitDifficulty(track, level),
      levelDisplayNumber: level,
      levelName: null,
      livesRemaining: MAX_LIVES,
      livesLost: 0,
      roundIndex: 0,
      score: 0,
      roundResults: [],
      levelComplete: false,
      submitting: false,
    })
    get().startGame()
  },

  // "Next Level" on the Git Map: play the next node up the same track, if any.
  nextGitLevel: () => {
    const { gitTrack, gitLevel } = get()
    if (!gitTrack || gitLevel == null) return
    if (gitLevel >= GIT_TRACKS[gitTrack].floors) return
    get().startGitLevel(gitTrack, gitLevel + 1)
  },

  // "Replay" on the Git Map result screen: same node, fresh puzzle + full lives.
  replayGitLevel: () => {
    const { gitTrack, gitLevel } = get()
    if (!gitTrack || gitLevel == null) return
    get().startGitLevel(gitTrack, gitLevel)
  },

  // Both modes score client-side via submitSelection; mode only affects which
  // difficulty profile feeds the puzzle (handled in startGame) and how the result
  // is persisted (progressStore for journey, no-op for practice).
  submit: () => get().submitSelection(),
}))
