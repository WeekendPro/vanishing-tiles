import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore, colorShapeTypeCount } from '../../src/store/gameStore'
import type { Gap, Cell, Grid } from '@shared/types'
import { ROWS, COLS } from '@shared/types'

function gridWith(gaps: Gap[]): Grid {
  const grid: Grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => ({ status: 'filled' })))
  for (const g of gaps) for (const [r, c] of g.cells) grid[r][c] = { status: 'empty' }
  return grid
}

const greenO: Gap = { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
  cells: [[0, 0], [0, 1], [1, 0], [1, 1]], color: 'green' }
const redO: Gap = { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 4,
  cells: [[0, 4], [0, 5], [1, 4], [1, 5]], color: 'red' }

beforeEach(() => { useGameStore.getState().resetGame() })

describe('colorShapeTypeCount', () => {
  it('scales 1→4 by gap count, starting at 1', () => {
    expect(colorShapeTypeCount(3)).toBe(1)
    expect(colorShapeTypeCount(4)).toBe(2)
    expect(colorShapeTypeCount(6)).toBe(2)
    expect(colorShapeTypeCount(7)).toBe(3)
    expect(colorShapeTypeCount(10)).toBe(3)
    expect(colorShapeTypeCount(11)).toBe(4)
    expect(colorShapeTypeCount(16)).toBe(4)
  })
})

describe('color-aware selection cart', () => {
  it('keys selection entries by (pieceType, color)', () => {
    const { incrementSelection } = useGameStore.getState()
    incrementSelection('O', 'green')
    incrementSelection('O', 'green')
    incrementSelection('O', 'red')
    const sel = useGameStore.getState().selection
    expect(sel).toHaveLength(2)
    expect(sel.find(e => e.color === 'green')?.freeCount).toBe(2)
    expect(sel.find(e => e.color === 'red')?.freeCount).toBe(1)
  })

  it('decrements the matching (pieceType, color) entry only', () => {
    const { incrementSelection, decrementSelection } = useGameStore.getState()
    incrementSelection('O', 'green')
    incrementSelection('O', 'red')
    decrementSelection('O', 'green')
    const sel = useGameStore.getState().selection
    expect(sel).toHaveLength(1)
    expect(sel[0].color).toBe('red')
  })

  it('clears a color-coded round when shapes AND colors match', () => {
    const gaps = [greenO, redO]
    useGameStore.setState({
      phase: 'selecting', roundTheme: 'colorCoded', grid: gridWith(gaps), gaps,
      difficulty: { viewDuration: 4000, selectDuration: 10000, placeDuration: 0, gapCount: 2, complexity: 'simple' },
      phaseStartTime: Date.now(), viewTimeRemaining: 0, livesRemaining: 3,
      selection: [
        { pieceType: 'O', color: 'green', freeCount: 1 },
        { pieceType: 'O', color: 'red', freeCount: 1 },
      ],
    })
    useGameStore.getState().submitSelection()
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s._resolution?.kind).toBe('perfect')
    expect(s.livesRemaining).toBe(3) // a clear costs no life
    expect(s.roundScore?.total).toBeGreaterThan(0)
  })

  it('fails a color-coded round on wrong colors and spends a life', () => {
    const gaps = [greenO, redO]
    useGameStore.setState({
      phase: 'selecting', roundTheme: 'colorCoded', grid: gridWith(gaps), gaps,
      difficulty: { viewDuration: 4000, selectDuration: 10000, placeDuration: 0, gapCount: 2, complexity: 'simple' },
      phaseStartTime: Date.now(), viewTimeRemaining: 0, livesRemaining: 3,
      selection: [
        { pieceType: 'O', color: 'blue', freeCount: 1 },
        { pieceType: 'O', color: 'pink', freeCount: 1 },
      ],
    })
    useGameStore.getState().submitSelection()
    const s = useGameStore.getState()
    expect(s._resolution?.kind).toBe('partial')
    expect(s.livesRemaining).toBe(2)
    expect(s.roundScore?.total).toBe(0)
  })
})

describe('applyPlacement color', () => {
  it('applyPlacement records the placement color on placed cells', () => {
    useGameStore.setState({ grid: gridWith([greenO]) })
    useGameStore.getState().applyPlacement({
      pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
      cells: [[0,0],[0,1],[1,0],[1,1]], color: 'green',
    })
    const cell = useGameStore.getState().grid[0][0]
    expect(cell.status).toBe('placed')
    expect(cell.color).toBe('green')
  })
})

describe('round 2 is color-coded', () => {
  it('startPractice→advance to round 2 generates colored gaps (single-shape at round-1 difficulty)', () => {
    const store = useGameStore.getState()
    store.startPractice()             // round 1 (basic)
    // Force a clear of round 1 by setting a non-null roundScore so advanceRound banks it.
    useGameStore.setState({ roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 100 } })
    useGameStore.getState().advanceRound()  // → round 2
    const s = useGameStore.getState()
    expect(s.roundIndex).toBe(1)
    expect(s.roundTheme).toBe('colorCoded')
    expect(s.gaps.length).toBeGreaterThan(0)
    expect(s.gaps.every(g => g.color !== undefined)).toBe(true)
    // Practice round 2 reuses round-1 difficulty (gapCount 3 → colorShapeTypeCount 1),
    // so this board is single-shape; the multi-shape ramp kicks in on larger boards.
    expect(new Set(s.gaps.map(g => g.pieceType)).size).toBe(1)
  })
})
