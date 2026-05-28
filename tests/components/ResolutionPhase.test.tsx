import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResolutionPhase } from '../../src/components/ResolutionPhase'
import { useGameStore } from '../../src/store/gameStore'
import type { Grid, Cell, ResolutionReason } from '../../src/types'

// Mock useReducedMotion to return true.
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return { ...actual, useReducedMotion: () => true }
})

beforeEach(() => {
  useGameStore.getState().resetGame()
})

describe('ResolutionPhase with reduced motion', () => {
  it('renders the Next Round button immediately after mount', () => {
    // Drive the store into resolving with a solved selection.
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())

    render(<ResolutionPhase />)
    // The button text is "Next Round →"
    expect(screen.getByText(/Next Round/)).toBeInTheDocument()
  })

  it('advances the round when Next Round is clicked', async () => {
    const user = userEvent.setup()
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())

    render(<ResolutionPhase />)
    const before = useGameStore.getState().round
    await user.click(screen.getByText(/Next Round/))
    expect(useGameStore.getState().round).toBe(before + 1)
  })

  it('Next Round button is idempotent — multiple clicks advance only one round', async () => {
    const user = userEvent.setup()
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())

    render(<ResolutionPhase />)
    const before = useGameStore.getState().round
    const btn = screen.getByText(/Next Round/)
    await user.click(btn)
    await user.click(btn)
    await user.click(btn)
    expect(useGameStore.getState().round).toBe(before + 1)
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

describe('ResolutionPhase — bad pieces (stamp, reduced motion)', () => {
  it('renders a red X on each unused (bad) chip', () => {
    useGameStore.setState({
      phase: 'resolving',
      lives: 2,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      // O is used; T is left over (bad)
      selection: [{ pieceType: 'O', freeCount: 1 }, { pieceType: 'T', freeCount: 1 }],
      roundScore: { correctness: 400, speedBonus: 0, efficiencyBonus: 50, total: 450 },
      _resolution: {
        kind: 'partial',
        coverage: 0.5,
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
    render(<ResolutionPhase />)
    expect(screen.getAllByLabelText('rejected piece')).toHaveLength(1)
  })
})

describe('ResolutionPhase — badge copy (reduced motion)', () => {
  function showPartial(coverage: number, reason: ResolutionReason) {
    useGameStore.setState({
      phase: 'resolving', lives: 2,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { correctness: 1, speedBonus: 0, efficiencyBonus: 0, total: 1 },
      _resolution: {
        kind: 'partial', coverage, reason,
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
  }

  it('high coverage → "So close!" with the reason sub-label, no percentage', () => {
    showPartial(0.8, 'too-many')
    render(<ResolutionPhase />)
    expect(screen.getByText('So close!')).toBeInTheDocument()
    expect(screen.getByText('Too many pieces')).toBeInTheDocument()
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument()
  })

  it('low coverage → "Nice try" with the reason sub-label', () => {
    showPartial(0.25, 'missed-many')
    render(<ResolutionPhase />)
    expect(screen.getByText('Nice try')).toBeInTheDocument()
    expect(screen.getByText('Missed some pieces')).toBeInTheDocument()
  })
})

describe('ResolutionPhase — accuracy icon (reduced motion)', () => {
  function showPartial(coverage: number) {
    useGameStore.setState({
      phase: 'resolving', lives: 2,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { correctness: 1, speedBonus: 0, efficiencyBonus: 0, total: 1 },
      _resolution: {
        kind: 'partial', coverage, reason: 'too-many',
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
  }

  // The badge glyph reuses the same character (≈/✕), so scope the assertion
  // to the Accuracy row, not the whole document.
  it('close coverage shows the amber ≈ accuracy icon', () => {
    showPartial(0.8)
    render(<ResolutionPhase />)
    const accRow = screen.getByText('Accuracy').closest('div')!
    expect(accRow.textContent).toContain('≈')
  })

  it('far coverage shows the red ✕ accuracy icon', () => {
    showPartial(0.3)
    render(<ResolutionPhase />)
    const accRow = screen.getByText('Accuracy').closest('div')!
    expect(accRow.textContent).toContain('✕')
  })
})

describe('ResolutionPhase — rejected chip styling (reduced motion)', () => {
  it('grays out the rejected piece', () => {
    useGameStore.setState({
      phase: 'resolving', lives: 2,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }, { pieceType: 'T', freeCount: 1 }],
      roundScore: { correctness: 1, speedBonus: 0, efficiencyBonus: 0, total: 1 },
      _resolution: {
        kind: 'partial', coverage: 0.5, reason: 'too-many',
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
    render(<ResolutionPhase />)
    const mark = screen.getByLabelText('rejected piece')
    const chip = mark.parentElement!
    // the piece is grayed out...
    expect(chip.querySelector('.grayscale')).not.toBeNull()
    // ...but the red ✕ overlay is NOT inside the grayscale filter (stays red)
    expect(mark.closest('.grayscale')).toBeNull()
  })
})

describe('ResolutionPhase — partial (reduced motion)', () => {
  it('shows the amber "So close!" badge for high coverage', () => {
    useGameStore.setState({
      phase: 'resolving',
      lives: 2,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { correctness: 600, speedBonus: 0, efficiencyBonus: 100, total: 700 },
      _resolution: {
        kind: 'partial',
        coverage: 0.75,
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
    render(<ResolutionPhase />)
    expect(screen.getByText(/So close/i)).toBeInTheDocument()
    expect(screen.getByText(/Next Round/)).toBeInTheDocument()
  })

  it('shows "Game Over" CTA when the partial resolution happened on the last life, and clicking it ends the game', async () => {
    const user = userEvent.setup()
    useGameStore.setState({
      phase: 'resolving',
      lives: 0,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { correctness: 600, speedBonus: 0, efficiencyBonus: 100, total: 700 },
      _resolution: {
        kind: 'partial',
        coverage: 0.75,
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
    render(<ResolutionPhase />)
    expect(screen.getByText(/Game Over/i)).toBeInTheDocument()
    await user.click(screen.getByText(/Game Over/i))
    expect(useGameStore.getState().phase).toBe('game-over')
  })
})
