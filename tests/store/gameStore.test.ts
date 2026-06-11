import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useGameStore, DIFFICULTY_TABLE } from '../../src/store/gameStore'
import { ROUND_PILLAR_MAX } from '@shared/core/scoring'
import { act } from '@testing-library/react'
import type { Grid, Cell, PieceType, Gap } from '@shared/types'

beforeEach(() => {
  useGameStore.getState().resetGame()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('initial state', () => {
  it('starts in idle phase', () => {
    expect(useGameStore.getState().phase).toBe('idle')
  })

  it('starts with 3 tries (triesUsed 1 of maxTries 3)', () => {
    const s = useGameStore.getState()
    expect(s.triesUsed).toBe(1)
    expect(s.maxTries).toBe(3)
  })

  it('starts with score 0', () => {
    expect(useGameStore.getState().score).toBe(0)
  })
})

describe('startGame', () => {
  it('opens the round on the countdown phase', () => {
    act(() => useGameStore.getState().startGame())
    expect(useGameStore.getState().phase).toBe('countdown')
  })

  it('does not start the view timer until the countdown ends', () => {
    act(() => useGameStore.getState().startGame())
    expect(useGameStore.getState().phaseDuration).toBe(0)
  })

  it('generates a grid', () => {
    act(() => useGameStore.getState().startGame())
    expect(useGameStore.getState().grid).toHaveLength(12)
  })

  it('generates gaps', () => {
    act(() => useGameStore.getState().startGame())
    expect(useGameStore.getState().gaps.length).toBeGreaterThan(0)
  })
})

describe('beginViewing', () => {
  it('transitions from countdown to viewing and starts the view timer', () => {
    act(() => useGameStore.getState().startGame())
    expect(useGameStore.getState().phase).toBe('countdown')
    act(() => useGameStore.getState().beginViewing())
    const s = useGameStore.getState()
    expect(s.phase).toBe('viewing')
    expect(s.phaseDuration).toBe(s.difficulty.viewDuration)
  })
})

describe('selection', () => {
  beforeEach(() => {
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().endViewing())
  })

  it('transitions to selecting phase after endViewing', () => {
    expect(useGameStore.getState().phase).toBe('selecting')
  })

  it('incrementSelection adds a free piece', () => {
    act(() => useGameStore.getState().incrementSelection('I'))
    const entry = useGameStore.getState().selection.find(e => e.pieceType === 'I')
    expect(entry?.freeCount).toBe(1)
  })

  it('decrementSelection removes a free piece', () => {
    act(() => useGameStore.getState().incrementSelection('I'))
    act(() => useGameStore.getState().incrementSelection('I'))
    act(() => useGameStore.getState().decrementSelection('I'))
    const entry = useGameStore.getState().selection.find(e => e.pieceType === 'I')
    expect(entry?.freeCount).toBe(1)
  })

  it('decrementSelection cannot go below 0', () => {
    act(() => useGameStore.getState().decrementSelection('I'))
    const entry = useGameStore.getState().selection.find(e => e.pieceType === 'I')
    expect(entry?.freeCount ?? 0).toBe(0)
  })

})

describe('submitSelection — correct', () => {
  it('transitions to resolving when selection is correct', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => {
      for (const gap of gaps) {
        useGameStore.getState().incrementSelection(gap.pieceType)
      }
    })
    act(() => useGameStore.getState().submitSelection())
    expect(useGameStore.getState().phase).toBe('resolving')
  })
})

describe('submitSelection — perfect', () => {
  it('sets resolution kind "perfect" with coverage 1', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s._resolution?.kind).toBe('perfect')
    expect(s._resolution?.coverage).toBe(1)
  })
})

describe('submitSelection — partial', () => {
  it('goes to resolving, spends a pooled life, and scores zero (no negative penalty)', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    // One correct piece for a multi-gap puzzle: fills one gap, leaves the rest.
    act(() => useGameStore.getState().incrementSelection(gaps[0].pieceType))
    act(() => useGameStore.getState().submitSelection())
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s._resolution?.kind).toBe('partial')
    expect(s.livesRemaining).toBe(2) // a failed round spends one pooled life
    expect(s._resolution!.placements.length).toBeGreaterThan(0)
    expect(s._resolution!.coverage).toBeGreaterThan(0)
    expect(s._resolution!.coverage).toBeLessThan(1)
    expect(s.roundScore!.accuracy).toBe(0)   // failed round never goes negative
    expect(s.roundScore!.speedBonus).toBe(0)
    expect(s.roundScore!.efficiencyBonus).toBe(0)
    expect(s.roundScore!.total).toBe(0)
  })
})

describe('tries and game over', () => {
  it('a wrong selection on the last try routes through resolving (not game-over) and does not over-advance', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    useGameStore.setState({ triesUsed: 3 })   // last of 3 tries
    act(() => useGameStore.getState().endViewing())
    act(() => useGameStore.getState().incrementSelection(gaps[0].pieceType)) // partial fill
    act(() => useGameStore.getState().submitSelection())
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s.triesUsed).toBe(3)   // exhausted: stays put, no 4th try
    expect(s._resolution?.kind).toBe('partial')
  })

  it('newGame restarts at round 1 with tries reset, score 0, on the countdown', () => {
    useGameStore.setState({ round: 7, score: 5000, triesUsed: 3, phase: 'resolving' })
    act(() => useGameStore.getState().newGame())
    const s = useGameStore.getState()
    expect(s.round).toBe(1)
    expect(s.triesUsed).toBe(1)
    expect(s.maxTries).toBe(3)
    expect(s.score).toBe(0)
    expect(s.phase).toBe('countdown')
  })
})

describe('scoring', () => {
  it('a perfect clear scores Speed only (efficiency retired; no accuracy/attempts)', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())
    // Multi-round model: Accuracy/Attempts/Efficiency are gone; the round total is Speed.
    const { roundScore } = useGameStore.getState()
    expect(roundScore?.accuracy).toBe(0)
    expect(roundScore?.attemptsBonus).toBe(0)
    expect(roundScore?.efficiencyBonus).toBe(0) // retired pillar
    expect(roundScore?.speedBonus).toBeGreaterThan(0)
    expect(roundScore?.total).toBe(roundScore!.speedBonus)
  })
})

describe('speed bonus — viewing + selection', () => {
  // Multi-round Speed = ROUND_PILLAR_MAX.speed × (viewRem + selectRem) / (viewDur + selectDur).
  it('is maximal when both viewing and selection are instant', () => {
    vi.setSystemTime(0)
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().beginViewing())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())
    const s = useGameStore.getState()
    expect(s._resolution?.kind).toBe('perfect')
    expect(s.roundScore!.speedBonus).toBe(ROUND_PILLAR_MAX.speed)
  })

  it('counts VIEWING speed: burning the full view time only saves the selection fraction', () => {
    vi.setSystemTime(0)
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().beginViewing())
    const { gaps, difficulty } = useGameStore.getState()
    vi.setSystemTime(difficulty.viewDuration)            // use ALL the viewing time
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection()) // instant selection ⇒ only select time left
    const s = useGameStore.getState()
    expect(s._resolution?.kind).toBe('perfect')
    const expected = Math.round(ROUND_PILLAR_MAX.speed *
      (difficulty.selectDuration / (difficulty.viewDuration + difficulty.selectDuration)))
    expect(s.roundScore!.speedBonus).toBe(expected)
  })

  it('counts SELECTION speed: burning the full select time only saves the view fraction', () => {
    vi.setSystemTime(0)
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().beginViewing())
    const { gaps, difficulty } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())      // instant Ready → full view time saved
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    vi.setSystemTime(difficulty.selectDuration)          // use ALL the selecting time
    act(() => useGameStore.getState().submitSelection())
    const s = useGameStore.getState()
    expect(s._resolution?.kind).toBe('perfect')
    const expected = Math.round(ROUND_PILLAR_MAX.speed *
      (difficulty.viewDuration / (difficulty.viewDuration + difficulty.selectDuration)))
    expect(s.roundScore!.speedBonus).toBe(expected)
  })
})

describe('applyPlacement', () => {
  it('marks the placement cells as placed with the piece type', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())

    const solution = useGameStore.getState()._resolution!.placements
    expect(solution).not.toBeNull()
    const firstPlacement = solution![0]

    act(() => useGameStore.getState().applyPlacement(firstPlacement))

    const grid = useGameStore.getState().grid
    for (const [r, c] of firstPlacement.cells) {
      expect(grid[r][c].status).toBe('placed')
      expect(grid[r][c].pieceType).toBe(firstPlacement.pieceType)
    }
  })

  it('does not change phase', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())
    const solution = useGameStore.getState()._resolution!.placements

    act(() => useGameStore.getState().applyPlacement(solution[0]))
    expect(useGameStore.getState().phase).toBe('resolving')
  })
})

describe('commitRoundScore', () => {
  it('adds roundScore.total to running score', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())

    const before = useGameStore.getState().score
    const total = useGameStore.getState().roundScore!.total

    act(() => useGameStore.getState().commitRoundScore())

    expect(useGameStore.getState().score).toBe(before + total)
  })

  it('does not change phase', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())
    act(() => useGameStore.getState().commitRoundScore())

    expect(useGameStore.getState().phase).toBe('resolving')
  })

  it('is a no-op when roundScore is null', () => {
    const before = useGameStore.getState().score
    act(() => useGameStore.getState().commitRoundScore())
    expect(useGameStore.getState().score).toBe(before)
  })
})

describe('DIFFICULTY_TABLE', () => {
  it('round 1 starts at a quick 4000ms view duration', () => {
    expect(DIFFICULTY_TABLE[0].viewDuration).toBe(4000)
  })

  it('has 15 rounds', () => {
    expect(DIFFICULTY_TABLE).toHaveLength(15)
  })

  it('grows the view timer as gaps are added — round 2 gives more time than round 1', () => {
    expect(DIFFICULTY_TABLE[1].viewDuration).toBeGreaterThan(DIFFICULTY_TABLE[0].viewDuration)
  })

  it('view duration rises monotonically with gap count so every level stays solvable', () => {
    for (let i = 1; i < DIFFICULTY_TABLE.length; i++) {
      expect(DIFFICULTY_TABLE[i].viewDuration).toBeGreaterThanOrEqual(DIFFICULTY_TABLE[i - 1].viewDuration)
    }
  })

  it('keeps a comfortable per-gap memorize budget (~1.0–1.5s/gap) across the run', () => {
    for (const cfg of DIFFICULTY_TABLE) {
      const perGap = cfg.viewDuration / cfg.gapCount
      expect(perGap).toBeGreaterThanOrEqual(1000)
      expect(perGap).toBeLessThanOrEqual(1500)
    }
  })

  it('selection time is never the bottleneck — always longer than the memorize window', () => {
    for (const cfg of DIFFICULTY_TABLE) {
      expect(cfg.selectDuration).toBeGreaterThan(cfg.viewDuration)
    }
  })

  it('the deep-game view duration caps at 17000ms', () => {
    expect(DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1].viewDuration).toBe(17000)
  })

  it('gap count climbs across the run so the board stays full', () => {
    expect(DIFFICULTY_TABLE[0].gapCount).toBe(3)
    expect(DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1].gapCount).toBeGreaterThanOrEqual(13)
  })
})

function fullGrid(): Grid {
  return Array.from({ length: 12 }, () =>
    Array.from({ length: 12 }, (): Cell => ({ status: 'filled' })))
}
function emptyAt(grid: Grid, cells: [number, number][]): Grid {
  for (const [r, c] of cells) grid[r][c] = { status: 'empty' }
  return grid
}
// Resolution is gap-driven: the reason is derived from the gaps vs. the
// selection, so each test supplies the gaps that carve the grid.
function submitWith(grid: Grid, gaps: Gap[], selection: { pieceType: PieceType; freeCount: number }[]) {
  useGameStore.setState({
    grid, gaps, selection, triesUsed: 1, maxTries: 3,
    difficulty: DIFFICULTY_TABLE[0], phaseStartTime: Date.now(),
  })
  act(() => useGameStore.getState().submitSelection())
  return useGameStore.getState()._resolution
}
const O_GAP_1: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 1]]
const O_GAP_2: [number, number][] = [[0, 3], [0, 4], [1, 3], [1, 4]]
const O_GAP_3: [number, number][] = [[0, 6], [0, 7], [1, 6], [1, 7]]
const oGap = (cells: [number, number][]): Gap =>
  ({ pieceType: 'O', rotation: 0, anchorRow: cells[0][0], anchorCol: cells[0][1], cells })

describe('submitSelection — failure reason', () => {
  it('"too-many": all gaps covered but extra pieces selected', () => {
    const grid = emptyAt(fullGrid(), O_GAP_1)
    const res = submitWith(grid, [oGap(O_GAP_1)], [
      { pieceType: 'O', freeCount: 1 },
      { pieceType: 'T', freeCount: 1 },
    ])
    expect(res?.kind).toBe('partial')
    expect(res?.reason).toBe('too-many')
  })

  it('"wrong-shapes": enough cells but shapes do not fit', () => {
    const grid = emptyAt(fullGrid(), O_GAP_1)
    const res = submitWith(grid, [oGap(O_GAP_1)], [{ pieceType: 'I', freeCount: 1 }])
    expect(res?.kind).toBe('partial')
    expect(res?.reason).toBe('wrong-shapes')
  })

  it('"missed-one": under-selected by one piece', () => {
    const grid = emptyAt(emptyAt(fullGrid(), O_GAP_1), O_GAP_2)
    const res = submitWith(grid, [oGap(O_GAP_1), oGap(O_GAP_2)], [{ pieceType: 'O', freeCount: 1 }])
    expect(res?.kind).toBe('partial')
    expect(res?.reason).toBe('missed-one')
  })

  it('"missed-many": under-selected by more than one piece', () => {
    const grid = emptyAt(emptyAt(emptyAt(fullGrid(), O_GAP_1), O_GAP_2), O_GAP_3)
    const res = submitWith(grid, [oGap(O_GAP_1), oGap(O_GAP_2), oGap(O_GAP_3)], [{ pieceType: 'O', freeCount: 1 }])
    expect(res?.kind).toBe('partial')
    expect(res?.reason).toBe('missed-many')
  })
})

// Penalty reads only gaps.length (for "needed"), so a length-only stub is fine.
function stubGaps(n: number): Gap[] {
  return Array.from({ length: n }, () => ({
    pieceType: 'O' as const, rotation: 0 as const, anchorRow: 0, anchorCol: 0, cells: [],
  }))
}
function submitForScore(
  grid: Grid,
  gaps: Gap[],
  selection: { pieceType: PieceType; freeCount: number }[],
) {
  useGameStore.setState({
    grid, gaps, selection, triesUsed: 1, maxTries: 3,
    difficulty: DIFFICULTY_TABLE[0], phaseStartTime: Date.now(),
  })
  act(() => useGameStore.getState().submitSelection())
  return useGameStore.getState().roundScore!
}

describe('submitSelection — failure scores zero', () => {
  it('a failed round zeroes every pillar (no negative penalty), with extra pieces', () => {
    // one O gap (4 cells, needs 1 piece); select O + T → T is wasted (1 extra)
    const grid = emptyAt(fullGrid(), O_GAP_1)
    const rs = submitForScore(grid, stubGaps(1), [
      { pieceType: 'O', freeCount: 1 },
      { pieceType: 'T', freeCount: 1 },
    ])
    expect(rs.accuracy).toBe(0)
    expect(rs.speedBonus).toBe(0)
    expect(rs.efficiencyBonus).toBe(0)
    expect(rs.attemptsBonus).toBe(0)
    expect(rs.stars).toBe(0)
    expect(rs.total).toBe(0)
  })

  it('a failed round zeroes the score even when pieces are missing', () => {
    // two O gaps (needs 2), select nothing → 2 missing
    const grid = emptyAt(emptyAt(fullGrid(), O_GAP_1), O_GAP_2)
    const rs = submitForScore(grid, stubGaps(2), [])
    expect(rs.accuracy).toBe(0)
    expect(rs.total).toBe(0)
  })
})

describe('commitRoundScore', () => {
  it('floors the running score at 0 (defensive — a round total is never negative)', () => {
    useGameStore.setState({
      score: 50,
      roundScore: { accuracy: -200, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: -200 },
    })
    act(() => useGameStore.getState().commitRoundScore())
    expect(useGameStore.getState().score).toBe(0)   // 50 + (-200) = -150 → floored to 0
  })
})

describe('retryRound', () => {
  it('replays the SAME puzzle at the same round and re-opens on the countdown', () => {
    act(() => useGameStore.getState().startGame())
    const before = useGameStore.getState().round
    const sessionGrid = useGameStore.getState().sessionGrid
    act(() => useGameStore.getState().retryRound())
    const s = useGameStore.getState()
    expect(s.round).toBe(before)   // round does NOT advance
    expect(s.phase).toBe('countdown')
    // the board is restored to the pristine session board (same puzzle)
    expect(s.grid).toEqual(sessionGrid)
  })

  it('preserves triesUsed (the failed try already advanced it)', () => {
    act(() => useGameStore.getState().startGame())
    useGameStore.setState({ triesUsed: 2 })
    act(() => useGameStore.getState().retryRound())
    expect(useGameStore.getState().triesUsed).toBe(2)
  })
})

describe('nextRound', () => {
  it('advances the round number', () => {
    act(() => useGameStore.getState().startGame())
    const before = useGameStore.getState().round
    act(() => useGameStore.getState().nextRound())
    expect(useGameStore.getState().round).toBe(before + 1)
  })
})

describe('mode', () => {
  it('defaults to practice mode', () => {
    expect(useGameStore.getState().mode).toBe('practice')
  })

  it('startPractice sets practice mode and opens the countdown', () => {
    act(() => useGameStore.getState().startPractice())
    const s = useGameStore.getState()
    expect(s.mode).toBe('practice')
    expect(s.phase).toBe('countdown')
  })
})
