import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../../src/store/gameStore'

beforeEach(() => {
  useGameStore.getState().resetGame()
})

describe('ordered queue actions', () => {
  it('appendQueuePiece appends one singleton entry per tap, preserving order', () => {
    const s = useGameStore.getState()
    s.appendQueuePiece('O')
    s.appendQueuePiece('I')
    s.appendQueuePiece('O')
    const sel = useGameStore.getState().selection
    expect(sel.map(e => e.pieceType)).toEqual(['O', 'I', 'O'])
    expect(sel.every(e => e.freeCount === 1 && e.color === undefined)).toBe(true)
  })

  it('popQueuePiece removes the last pick only', () => {
    const s = useGameStore.getState()
    s.appendQueuePiece('O')
    s.appendQueuePiece('I')
    s.popQueuePiece()
    expect(useGameStore.getState().selection.map(e => e.pieceType)).toEqual(['O'])
  })

  it('popQueuePiece on an empty queue is a no-op', () => {
    useGameStore.getState().popQueuePiece()
    expect(useGameStore.getState().selection).toEqual([])
  })
})

describe('round 3 is sequential', () => {
  it('startPractice→advance to round 3 generates ordered gaps with the sequential theme', () => {
    const s = useGameStore.getState()
    s.startPractice()
    // Clear rounds 1 and 2 by forcing a cleared roundScore, then advancing.
    useGameStore.setState({ roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 } })
    s.advanceRound() // → round index 1 (color-coded)
    useGameStore.setState({ roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 } })
    s.advanceRound() // → round index 2 (sequential)
    const st = useGameStore.getState()
    expect(st.roundTheme).toBe('sequential')
    expect(st.gaps.length).toBeGreaterThan(0)
    const orders = st.gaps.map(g => g.order).sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(orders).toEqual(st.gaps.map((_, i) => i + 1))
  })
})

describe('sequential submitSelection', () => {
  function setupSequentialRound() {
    useGameStore.getState().startPractice()
    // Build a deterministic 2-gap sequential board: O at order 1, I at order 2.
    const gaps = [
      { pieceType: 'O' as const, rotation: 0 as const, anchorRow: 0, anchorCol: 0, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] as [number, number][], order: 1 },
      { pieceType: 'I' as const, rotation: 0 as const, anchorRow: 3, anchorCol: 0, cells: [[3, 0], [3, 1], [3, 2], [3, 3]] as [number, number][], order: 2 },
    ]
    const grid = useGameStore.getState().grid.map(row => row.map(c => ({ ...c })))
    // Reset to all-filled, then carve the two gaps.
    for (const row of grid) for (const c of row) { c.status = 'filled'; delete (c as { pieceType?: unknown }).pieceType }
    for (const g of gaps) for (const [r, c] of g.cells) grid[r][c] = { status: 'empty' }
    useGameStore.setState({
      phase: 'selecting', roundTheme: 'sequential', gaps, grid, selection: [],
      phaseStartTime: Date.now(), phaseDuration: 10000, viewTimeRemaining: 0,
      difficulty: { viewDuration: 4000, selectDuration: 10000, placeDuration: 0, gapCount: 2, complexity: 'simple' },
      livesRemaining: 3,
    })
  }

  it('clears the round when picked in the right order (O then I)', () => {
    setupSequentialRound()
    const s = useGameStore.getState()
    s.appendQueuePiece('O')
    s.appendQueuePiece('I')
    s.submitSelection()
    const st = useGameStore.getState()
    expect(st._resolution?.kind).toBe('perfect')
    expect(st.livesRemaining).toBe(3)
  })

  it('fails and spends a life when picked in the wrong order (I then O)', () => {
    setupSequentialRound()
    const s = useGameStore.getState()
    s.appendQueuePiece('I')
    s.appendQueuePiece('O')
    s.submitSelection()
    const st = useGameStore.getState()
    expect(st._resolution?.kind).toBe('partial')
    expect(st._resolution?.coverage).toBe(0)
    expect(st.livesRemaining).toBe(2)
  })

  it('reports an order-specific reason when shapes are right but order is wrong', () => {
    setupSequentialRound()
    const s = useGameStore.getState()
    // Correct shape multiset (one O, one I) but reversed pick order — the only
    // error is ordering, so the reason must be order-specific, not shape/count.
    s.appendQueuePiece('I')
    s.appendQueuePiece('O')
    s.submitSelection()
    expect(useGameStore.getState()._resolution?.reason).toBe('wrong-order')
  })
})
