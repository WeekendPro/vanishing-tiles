import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useGameStore, DIFFICULTY_TABLE } from '../../src/store/gameStore'
import { act } from '@testing-library/react'
import type { Grid, Cell, PieceType } from '../../src/types'

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
    expect(useGameStore.getState().grid).toHaveLength(10)
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
  it('goes to resolving, deducts a life, and awards partial credit', () => {
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().endViewing())
    act(() => useGameStore.getState().incrementSelection('SINGLE')) // 1 cell, never a full fill
    act(() => useGameStore.getState().submitSelection())
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s._resolution?.kind).toBe('partial')
    expect(s.lives).toBe(2)
    expect(s._resolution!.placements.length).toBeGreaterThan(0) // the SINGLE lands somewhere
    expect(s._resolution!.coverage).toBeGreaterThan(0)
    expect(s.roundScore!.correctness).toBeGreaterThan(0)        // partial credit, not zero
    expect(s._resolution!.coverage).toBeLessThan(1)
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
  it('round 1 has 5000ms view duration', () => {
    expect(DIFFICULTY_TABLE[0].viewDuration).toBe(5000)
  })

  it('view duration decreases in later rounds', () => {
    expect(DIFFICULTY_TABLE[4].viewDuration).toBeLessThan(DIFFICULTY_TABLE[0].viewDuration)
  })
})

function fullGrid(): Grid {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 8 }, (): Cell => ({ status: 'filled' })))
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
    expect(res?.reason).toBe('wrong-shapes')
  })

  it('"missed-one": under-selected by one piece', () => {
    const grid = emptyAt(emptyAt(fullGrid(), O_GAP_1), O_GAP_2)
    const res = submitWith(grid, [{ pieceType: 'O', freeCount: 1 }])
    expect(res?.reason).toBe('missed-one')
  })

  it('"missed-many": under-selected by more than one piece', () => {
    const grid = emptyAt(emptyAt(emptyAt(fullGrid(), O_GAP_1), O_GAP_2), O_GAP_3)
    const res = submitWith(grid, [{ pieceType: 'O', freeCount: 1 }])
    expect(res?.reason).toBe('missed-many')
  })
})
