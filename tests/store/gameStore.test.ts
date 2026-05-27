import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useGameStore, DIFFICULTY_TABLE } from '../../src/store/gameStore'
import { act } from '@testing-library/react'

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
    expect(entry?.lockedCount).toBe(0)
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

  it('cannot decrement locked pieces', () => {
    useGameStore.setState({ carryOvers: [{ pieceType: 'I', count: 1 }] })
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().endViewing())
    act(() => useGameStore.getState().decrementSelection('I'))
    const entry = useGameStore.getState().selection.find(e => e.pieceType === 'I')
    expect(entry?.lockedCount).toBe(1)
  })
})

describe('submitSelection — correct', () => {
  it('transitions to auto-placing when selection is correct', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => {
      for (const gap of gaps) {
        useGameStore.getState().incrementSelection(gap.pieceType)
      }
    })
    act(() => useGameStore.getState().submitSelection())
    expect(useGameStore.getState().phase).toBe('auto-placing')
  })
})

describe('submitSelection — incorrect', () => {
  it('transitions to manual-placing and deducts a life', () => {
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().endViewing())
    act(() => useGameStore.getState().incrementSelection('SINGLE'))
    act(() => useGameStore.getState().submitSelection())
    expect(useGameStore.getState().phase).toBe('manual-placing')
    expect(useGameStore.getState().lives).toBe(2)
  })
})

describe('lives and game over', () => {
  it('game over when lives reach 0', () => {
    useGameStore.setState({ lives: 1 })
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().endViewing())
    act(() => useGameStore.getState().incrementSelection('SINGLE'))
    act(() => useGameStore.getState().submitSelection())
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

    const solution = useGameStore.getState()._autoPlaceSolution
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
    const solution = useGameStore.getState()._autoPlaceSolution!

    act(() => useGameStore.getState().applyPlacement(solution[0]))
    expect(useGameStore.getState().phase).toBe('auto-placing')
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

  it('clears carryOvers', () => {
    useGameStore.setState({ carryOvers: [{ pieceType: 'I', count: 2 }] })
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())
    act(() => useGameStore.getState().commitRoundScore())

    expect(useGameStore.getState().carryOvers).toEqual([])
  })

  it('does not change phase', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())
    act(() => useGameStore.getState().commitRoundScore())

    expect(useGameStore.getState().phase).toBe('auto-placing')
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
