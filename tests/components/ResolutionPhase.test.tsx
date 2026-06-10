import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResolutionPhase } from '../../src/components/ResolutionPhase'
import { useGameStore } from '../../src/store/gameStore'
import type { Grid, Cell, ResolutionReason } from '@shared/types'

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
    const before = useGameStore.getState().roundIndex
    await user.click(screen.getByText(/Next Round/))
    expect(useGameStore.getState().roundIndex).toBe(before + 1)
  })

  it('Next Round button is idempotent — multiple clicks advance only one round', async () => {
    const user = userEvent.setup()
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())

    render(<ResolutionPhase />)
    const before = useGameStore.getState().roundIndex
    const btn = screen.getByText(/Next Round/)
    await user.click(btn)
    await user.click(btn)
    await user.click(btn)
    expect(useGameStore.getState().roundIndex).toBe(before + 1)
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
  it('shows the amber "So close!" badge and a Try Again CTA for high coverage with lives left', () => {
    useGameStore.setState({
      phase: 'resolving',
      triesUsed: 2, maxTries: 3, livesRemaining: 2,
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
      triesUsed: 2, maxTries: 3, livesRemaining: 2,
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
    const before = useGameStore.getState().roundIndex
    await user.click(screen.getByText(/Try Again/))
    expect(useGameStore.getState().roundIndex).toBe(before)  // same round
    expect(useGameStore.getState().phase).toBe('countdown')  // fresh puzzle, counts in
  })

  it('shows a "Game Over" CTA when out of lives, and clicking it routes to results', async () => {
    const user = userEvent.setup()
    useNavStore.getState().reset()
    useGameStore.setState({
      phase: 'resolving',
      mode: 'practice',
      triesUsed: 3, maxTries: 3, livesRemaining: 0,
      roundIndex: 2,
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
    expect(screen.getByText(/Game Over/i)).toBeInTheDocument()
    await user.click(screen.getByText(/Game Over/i))
    expect(useNavStore.getState().appView).toBe('results')
  })

  it('shows a "Level Complete" CTA on the last round clear, and clicking it routes to results', async () => {
    const user = userEvent.setup()
    useNavStore.getState().reset()
    useGameStore.setState({
      phase: 'resolving',
      mode: 'practice',
      triesUsed: 1, maxTries: 3, livesRemaining: 3,
      roundIndex: 3,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundResults: [800, 800, 800],
      roundScore: { accuracy: 800, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 800 },
      _resolution: {
        kind: 'perfect',
        coverage: 1,
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
    render(<ResolutionPhase />)
    expect(screen.getByText(/Level Complete/i)).toBeInTheDocument()
    await user.click(screen.getByText(/Level Complete/i))
    expect(useGameStore.getState().levelComplete).toBe(true)
    expect(useNavStore.getState().appView).toBe('results')
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

  it('hides all pillar rows on a failed round (round total is 0)', () => {
    showPartial(0)
    render(<ResolutionPhase />)
    expect(screen.queryByText('Speed')).not.toBeInTheDocument()
    expect(screen.queryByText('Efficiency')).not.toBeInTheDocument()
    // Accuracy and Attempts pillars no longer exist in the round model.
    expect(screen.queryByText('Accuracy')).not.toBeInTheDocument()
    expect(screen.queryByText('Attempts')).not.toBeInTheDocument()
  })

  it('shows the Speed row (and no Accuracy/Attempts/Efficiency) on a clear', () => {
    showPerfect(800)
    render(<ResolutionPhase />)
    expect(screen.getByText('Speed')).toBeInTheDocument()
    expect(screen.queryByText('Efficiency')).not.toBeInTheDocument()
    expect(screen.queryByText('Accuracy')).not.toBeInTheDocument()
    expect(screen.queryByText('Attempts')).not.toBeInTheDocument()
  })

  it('shows a turtle on the Speed row when a successful round was slow', () => {
    showPerfect(50) // <= 400 (20% of 2000)
    render(<ResolutionPhase />)
    const speedRow = screen.getByText('Speed').closest('div')!
    expect(speedRow.textContent).toContain('🐢')
  })

  it('shows a lightning bolt when a successful round was fast', () => {
    showPerfect(800) // > 400 threshold
    render(<ResolutionPhase />)
    const speedRow = screen.getByText('Speed').closest('div')!
    expect(speedRow.textContent).toContain('⚡')
  })
})

import { useNavStore } from '../../src/store/navStore'

describe('ResolutionPhase — journey single play', () => {
  it('shows Replay / More Puzzles / Next Level after a solved component', async () => {
    useNavStore.getState().reset()
    useNavStore.getState().setLevelOrder(['L1', 'L2'])
    useNavStore.getState().openLevel('L1')
    act(() => {
      useGameStore.setState({
        mode: 'journey',
        activeComponent: 'main',
        levelId: 'L1',
        phase: 'resolving',
        selection: [],
        gaps: [],
        grid: [],
        _resolution: { kind: 'perfect', placements: [], coverage: 1 },
        roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 90 },
        livesLost: 0,
      } as any)
    })
    render(<ResolutionPhase />)
    expect(await screen.findByLabelText(/Replay/i)).toBeTruthy()
    expect(screen.getByLabelText(/More Puzzles/i)).toBeTruthy()
    expect(screen.getByLabelText(/Next Level/i)).toBeTruthy()
    // the flat score card is gone — no "Level Total" / "Completion" rows
    expect(screen.queryByText(/Level Total/i)).toBeNull()
    expect(screen.queryByText(/Completion/i)).toBeNull()
  })
})

describe('ResolutionPhase — journey failure CTA', () => {
  it('journey failure WITH lives left shows Replay (retries same puzzle), not Next Level', async () => {
    useNavStore.getState().reset()
    useNavStore.getState().setLevelOrder(['L1', 'L2'])
    useNavStore.getState().openLevel('L1')
    act(() => {
      useGameStore.setState({
        mode: 'journey', activeComponent: 'main', levelId: 'L1', phase: 'resolving',
        selection: [], gaps: [], grid: [], livesRemaining: 2, livesLost: 1,
        _resolution: { kind: 'partial', placements: [], coverage: 0.5, reason: 'missed-one' },
        roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 },
      } as any)
    })
    render(<ResolutionPhase />)
    expect(await screen.findByLabelText(/Replay/i)).toBeTruthy()
    expect(screen.getByLabelText(/More Puzzles/i)).toBeTruthy()
    expect(screen.queryByLabelText(/Next Level/i)).toBeNull()
  })

  it('journey failure OUT of lives shows Replay (replayComponent), not retryComponent', async () => {
    useNavStore.getState().reset()
    useNavStore.getState().setLevelOrder(['L1'])   // no next level
    useNavStore.getState().openLevel('L1')
    const replaySpy = vi.fn()
    const retrySpy = vi.fn()
    useGameStore.setState({ replayComponent: replaySpy, retryComponent: retrySpy } as any)
    act(() => {
      useGameStore.setState({
        mode: 'journey', activeComponent: 'main', levelId: 'L1', phase: 'resolving',
        selection: [], gaps: [], grid: [], livesRemaining: 0, livesLost: 2,
        _resolution: { kind: 'partial', placements: [], coverage: 0.3, reason: 'missed-many' },
        roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 },
      } as any)
    })
    const user = userEvent.setup()
    render(<ResolutionPhase />)
    const btn = await screen.findByLabelText(/Replay/i)
    expect(btn).toBeTruthy()
    await user.click(btn)
    expect(replaySpy).toHaveBeenCalled()
    expect(retrySpy).not.toHaveBeenCalled()
  })
})

describe('ResolutionPhase in journey mode', () => {
  it('shows the journey per-component CTAs (Replay / More Puzzles) on a clear — NOT a practice-style Next Round', () => {
    useNavStore.getState().reset()
    useNavStore.getState().setLevelOrder(['L1'])
    useNavStore.getState().openLevel('L1')
    // Journey shows the component-result CTAs, not the practice round-by-round gauntlet.
    act(() => {
      useGameStore.setState({
        mode: 'journey',
        activeComponent: 'main',
        levelId: 'L1',
        phase: 'resolving',
        roundIndex: 1,
        livesRemaining: 3,
        livesLost: 0,
        selection: [{ pieceType: 'O', freeCount: 1 }],
        grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
        roundScore: { accuracy: 0, speedBonus: 1200, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 1200 },
        _resolution: {
          kind: 'perfect', coverage: 1,
          placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
            cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
        },
      } as any)
    })
    render(<ResolutionPhase />)
    expect(screen.getByLabelText(/Replay/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/More Puzzles/i)).toBeInTheDocument()
    expect(useNavStore.getState().appView).not.toBe('results')
  })

  it('More Puzzles navigates to the level detail screen', async () => {
    const user = userEvent.setup()
    useNavStore.getState().reset()
    useNavStore.getState().setLevelOrder(['L1'])
    useNavStore.getState().openLevel('L1')
    act(() => {
      useGameStore.setState({
        mode: 'journey',
        activeComponent: 'main',
        levelId: 'L1',
        phase: 'resolving',
        roundIndex: 3,
        livesRemaining: 3,
        livesLost: 0,
        roundResults: [1200, 1200, 1200],
        selection: [{ pieceType: 'O', freeCount: 1 }],
        grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
        roundScore: { accuracy: 0, speedBonus: 1200, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 1200 },
        _resolution: {
          kind: 'perfect', coverage: 1,
          placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
            cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
        },
      } as any)
    })
    render(<ResolutionPhase />)
    await user.click(screen.getByLabelText(/More Puzzles/i))
    expect(useNavStore.getState().appView).toBe('levelDetail')
    expect(useNavStore.getState().selectedLevelId).toBe('L1')
  })
})
