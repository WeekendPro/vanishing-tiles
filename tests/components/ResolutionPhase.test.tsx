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
      triesUsed: 2, maxTries: 3,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      // O is used; T is left over (bad)
      selection: [{ pieceType: 'O', freeCount: 1 }, { pieceType: 'T', freeCount: 1 }],
      roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 },
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
      phase: 'resolving', triesUsed: 2, maxTries: 3,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 },
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

  it('very low coverage → "Yikes" with the reason sub-label', () => {
    showPartial(0.25, 'missed-many')
    render(<ResolutionPhase />)
    expect(screen.getByText('Yikes')).toBeInTheDocument()
    expect(screen.getByText('Missed some pieces')).toBeInTheDocument()
  })

  it('mid coverage → "Tough Round"', () => {
    showPartial(0.5, 'wrong-shapes')
    render(<ResolutionPhase />)
    expect(screen.getByText('Tough Round')).toBeInTheDocument()
  })
})

describe('ResolutionPhase — accuracy icon (reduced motion)', () => {
  function showPartial(coverage: number) {
    useGameStore.setState({
      phase: 'resolving', triesUsed: 2, maxTries: 3,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 },
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
      phase: 'resolving', triesUsed: 2, maxTries: 3,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }, { pieceType: 'T', freeCount: 1 }],
      roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 },
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
  it('shows the amber "So close!" badge and a Try Again CTA for high coverage with tries left', () => {
    useGameStore.setState({
      phase: 'resolving',
      triesUsed: 2, maxTries: 3,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 },
      _resolution: {
        kind: 'partial',
        coverage: 0.75,
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
    render(<ResolutionPhase />)
    expect(screen.getByText(/So close/i)).toBeInTheDocument()
    expect(screen.getByText(/Try Again/)).toBeInTheDocument()
  })

  it('Try Again regenerates the round without advancing, re-opening on the countdown', async () => {
    const user = userEvent.setup()
    act(() => useGameStore.getState().startGame())   // establishes round 1 + a grid
    useGameStore.setState({
      phase: 'resolving',
      triesUsed: 2, maxTries: 3,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 },
      _resolution: {
        kind: 'partial',
        coverage: 0.5,
        reason: 'too-many',
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
    render(<ResolutionPhase />)
    const before = useGameStore.getState().round
    await user.click(screen.getByText(/Try Again/))
    expect(useGameStore.getState().round).toBe(before)       // same round
    expect(useGameStore.getState().phase).toBe('countdown')  // fresh puzzle, counts in
  })

  it('shows a "Start New Game" CTA on the last try, and clicking it restarts at round 1', async () => {
    const user = userEvent.setup()
    useGameStore.setState({
      phase: 'resolving',
      triesUsed: 3, maxTries: 3,
      round: 4,
      score: 1234,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 },
      _resolution: {
        kind: 'partial',
        coverage: 0.5,
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
    render(<ResolutionPhase />)
    expect(screen.getByText(/Start New Game/i)).toBeInTheDocument()
    await user.click(screen.getByText(/Start New Game/i))
    const s = useGameStore.getState()
    expect(s.round).toBe(1)
    expect(s.triesUsed).toBe(1)
    expect(s.phase).toBe('countdown')
  })
})

describe('ResolutionPhase — score panel (reduced motion)', () => {
  function showPartial(accuracy: number, coverage = 0.3) {
    useGameStore.setState({
      phase: 'resolving', triesUsed: 2, maxTries: 3,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { accuracy, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: accuracy },
      _resolution: {
        kind: 'partial', coverage, reason: 'too-many',
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
  }

  function showPerfect(speedBonus: number) {
    useGameStore.setState({
      phase: 'resolving', triesUsed: 1, maxTries: 3,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { accuracy: 800, speedBonus, efficiencyBonus: 100, attemptsBonus: 400, stars: 3, total: 1300 + speedBonus },
      _resolution: {
        kind: 'perfect', coverage: 1,
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
  }

  it('renders a zero Accuracy value on a failed round', () => {
    showPartial(0)
    render(<ResolutionPhase />)
    const accRow = screen.getByText('Accuracy').closest('div')!
    expect(accRow.textContent).toContain('+0')
  })

  it('hides the Speed, Efficiency, and Attempts rows on a failed round', () => {
    showPartial(0)
    render(<ResolutionPhase />)
    expect(screen.queryByText('Speed')).not.toBeInTheDocument()
    expect(screen.queryByText('Efficiency')).not.toBeInTheDocument()
    expect(screen.queryByText('Attempts')).not.toBeInTheDocument()
  })

  it('shows a turtle on the Speed row when a successful round was slow', () => {
    showPerfect(50) // <= 100 (20% of 500)
    render(<ResolutionPhase />)
    const speedRow = screen.getByText('Speed').closest('div')!
    expect(speedRow.textContent).toContain('🐢')
  })

  it('shows a lightning bolt when a successful round was fast', () => {
    showPerfect(400)
    render(<ResolutionPhase />)
    const speedRow = screen.getByText('Speed').closest('div')!
    expect(speedRow.textContent).toContain('⚡')
  })
})
