import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useGameStore, DIFFICULTY_TABLE } from '../../src/store/gameStore'
import { act } from '@testing-library/react'
import type { Grid, Cell, PieceType, Gap } from '../../src/types'

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

  it('starts with 3 lives', () => {
    expect(useGameStore.getState().lives).toBe(3)
  })

  it('starts with score 0', () => {
    expect(useGameStore.getState().score).toBe(0)
  })
})

describe('startGame', () => {
  it('transitions to viewing phase', () => {
    act(() => useGameStore.getState().startGame())
    expect(useGameStore.getState().phase).toBe('viewing')
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
  it('goes to resolving, deducts a life, and applies a negative accuracy penalty', () => {
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().endViewing())
    act(() => useGameStore.getState().incrementSelection('SINGLE')) // 1 cell, never a full fill
    act(() => useGameStore.getState().submitSelection())
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s._resolution?.kind).toBe('partial')
    expect(s.lives).toBe(2)
    expect(s._resolution!.placements.length).toBeGreaterThan(0)
    expect(s._resolution!.coverage).toBeGreaterThan(0)
    expect(s._resolution!.coverage).toBeLessThan(1)
    expect(s.roundScore!.correctness).toBeLessThan(0)   // penalty, not credit
    expect(s.roundScore!.speedBonus).toBe(0)
    expect(s.roundScore!.efficiencyBonus).toBe(0)
  })
})

describe('lives and game over', () => {
  it('a wrong selection on the last life routes through resolving (not game-over)', () => {
    useGameStore.setState({ lives: 1 })
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().endViewing())
    act(() => useGameStore.getState().incrementSelection('SINGLE'))
    act(() => useGameStore.getState().submitSelection())
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s.lives).toBe(0)
    expect(s._resolution?.kind).toBe('partial')
  })

  it('endGame transitions to game-over', () => {
    useGameStore.setState({ lives: 0, phase: 'resolving' })
    act(() => useGameStore.getState().endGame())
    expect(useGameStore.getState().phase).toBe('game-over')
  })
})

describe('scoring', () => {
  it('correct selection awards correctness points', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())
    // submitSelection already sets roundScore for the auto-place path
    const { roundScore } = useGameStore.getState()
    expect(roundScore?.correctness).toBeGreaterThan(0)
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
  it('round 1 still starts at a 5000ms view duration', () => {
    expect(DIFFICULTY_TABLE[0].viewDuration).toBe(5000)
  })

  it('has 15 rounds', () => {
    expect(DIFFICULTY_TABLE).toHaveLength(15)
  })

  it('eases the view timer gently — round 2 is only ~300ms faster', () => {
    expect(DIFFICULTY_TABLE[1].viewDuration).toBe(4700)
  })

  it('view duration never increases and floors at 2500ms', () => {
    for (let i = 1; i < DIFFICULTY_TABLE.length; i++) {
      expect(DIFFICULTY_TABLE[i].viewDuration).toBeLessThanOrEqual(DIFFICULTY_TABLE[i - 1].viewDuration)
    }
    expect(DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1].viewDuration).toBe(2500)
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
// reason depends only on grid + selection (not gaps); gaps:[] is fine here.
function submitWith(grid: Grid, selection: { pieceType: PieceType; freeCount: number }[]) {
  useGameStore.setState({
    grid, gaps: [], selection, lives: 3,
    difficulty: DIFFICULTY_TABLE[0], phaseStartTime: Date.now(),
  })
  act(() => useGameStore.getState().submitSelection())
  return useGameStore.getState()._resolution
}
const O_GAP_1: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 1]]
const O_GAP_2: [number, number][] = [[0, 3], [0, 4], [1, 3], [1, 4]]
const O_GAP_3: [number, number][] = [[0, 6], [0, 7], [1, 6], [1, 7]]

describe('submitSelection — failure reason', () => {
  it('"too-many": all gaps covered but extra pieces selected', () => {
    const grid = emptyAt(fullGrid(), O_GAP_1)
    const res = submitWith(grid, [
      { pieceType: 'O', freeCount: 1 },
      { pieceType: 'T', freeCount: 1 },
    ])
    expect(res?.kind).toBe('partial')
    expect(res?.reason).toBe('too-many')
  })

  it('"wrong-shapes": enough cells but shapes do not fit', () => {
    const grid = emptyAt(fullGrid(), O_GAP_1)
    const res = submitWith(grid, [{ pieceType: 'I', freeCount: 1 }])
    expect(res?.kind).toBe('partial')
    expect(res?.reason).toBe('wrong-shapes')
  })

  it('"missed-one": under-selected by one piece', () => {
    const grid = emptyAt(emptyAt(fullGrid(), O_GAP_1), O_GAP_2)
    const res = submitWith(grid, [{ pieceType: 'O', freeCount: 1 }])
    expect(res?.kind).toBe('partial')
    expect(res?.reason).toBe('missed-one')
  })

  it('"missed-many": under-selected by more than one piece', () => {
    const grid = emptyAt(emptyAt(emptyAt(fullGrid(), O_GAP_1), O_GAP_2), O_GAP_3)
    const res = submitWith(grid, [{ pieceType: 'O', freeCount: 1 }])
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
    grid, gaps, selection, lives: 3,
    difficulty: DIFFICULTY_TABLE[0], phaseStartTime: Date.now(),
  })
  act(() => useGameStore.getState().submitSelection())
  return useGameStore.getState().roundScore!
}

describe('submitSelection — failure penalty', () => {
  it('penalizes extra pieces by -50 each, with no speed/efficiency', () => {
    // one O gap (4 cells, needs 1 piece); select O + T → T is wasted (1 extra)
    const grid = emptyAt(fullGrid(), O_GAP_1)
    const rs = submitForScore(grid, stubGaps(1), [
      { pieceType: 'O', freeCount: 1 },
      { pieceType: 'T', freeCount: 1 },
    ])
    expect(rs.correctness).toBe(-50)
    expect(rs.speedBonus).toBe(0)
    expect(rs.efficiencyBonus).toBe(0)
    expect(rs.total).toBe(-50)
  })

  it('penalizes missing pieces by -50 each', () => {
    // two O gaps (needs 2), select nothing → 2 missing
    const grid = emptyAt(emptyAt(fullGrid(), O_GAP_1), O_GAP_2)
    const rs = submitForScore(grid, stubGaps(2), [])
    expect(rs.correctness).toBe(-100)
    expect(rs.total).toBe(-100)
  })

  it('caps the penalty at -400', () => {
    // pretend 12 gaps are needed but nothing is selected → 12 missing → -600, capped at -400
    const grid = emptyAt(fullGrid(), O_GAP_1)
    const rs = submitForScore(grid, stubGaps(12), [])
    expect(rs.correctness).toBe(-400)
  })
})

describe('commitRoundScore', () => {
  it('floors the running score at 0 on a net-negative round', () => {
    useGameStore.setState({
      score: 50,
      roundScore: { correctness: -200, speedBonus: 0, efficiencyBonus: 0, total: -200 },
    })
    act(() => useGameStore.getState().commitRoundScore())
    expect(useGameStore.getState().score).toBe(0)   // 50 + (-200) = -150 → floored to 0
  })
})

describe('retryRound', () => {
  it('regenerates the puzzle at the same round and returns to viewing', () => {
    act(() => useGameStore.getState().startGame())
    const before = useGameStore.getState().round
    act(() => useGameStore.getState().retryRound())
    expect(useGameStore.getState().round).toBe(before)   // round does NOT advance
    expect(useGameStore.getState().phase).toBe('viewing')
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
