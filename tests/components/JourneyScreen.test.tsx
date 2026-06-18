import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({ getJourney: vi.fn() }))
import * as api from '../../src/lib/api'
import { JourneyScreen } from '../../src/components/JourneyScreen'
import { useNavStore } from '../../src/store/navStore'
import { useProgressStore, emptyLevelProgress, type ProgressMap } from '../../src/store/progressStore'

/** Build a client-progress map that clears the given levels (total ≥ 65% = 325). */
function clearedProgress(levelIds: string[]): ProgressMap {
  const out: ProgressMap = {}
  for (const id of levelIds) {
    const p = emptyLevelProgress()
    p.best = { main: 100, colors: 100, inSequence: 100, flash: 50, riddle: 0 } // 350
    out[id] = p
  }
  return out
}

const JOURNEY = [
  { theme_id: 't1', slug: 'the_hollows', name: 'The Hollows', mechanic: 'standard', sort_order: 1,
    levels: [
      { level_id: 'l1', display_number: 1, name: 'Vacant Heights', my_pr: 1820, my_stars: 3, cleared: true, current: false, locked: false, last_played: null, global_best: 1900 },
      { level_id: 'l2', display_number: 2, name: 'Open Lots', my_pr: null, my_stars: 0, cleared: false, current: true, locked: false, last_played: null, global_best: null },
    ] },
  { theme_id: 't3', slug: 'the_grid', name: 'Gridlock', mechanic: 'standard', sort_order: 2,
    levels: [
      { level_id: 'l11', display_number: 11, name: 'Highrise Row', my_pr: null, my_stars: 0, cleared: false, current: false, locked: true, last_played: null, global_best: null },
    ] },
]

// Every level cleared → all-clear end state.
const ALL_CLEAR = JOURNEY.map(t => ({
  ...t,
  levels: t.levels.map(l => ({ ...l, cleared: true, current: false, locked: false })),
}))

beforeEach(() => {
  useNavStore.getState().reset()
  useProgressStore.setState({ byLevel: {} })
  localStorage.clear()
  vi.clearAllMocks()
})

describe('JourneyScreen', () => {
  it('renders the transit map with station buttons', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    render(<JourneyScreen />)
    expect(await screen.findByRole('button', { name: /Vacant Heights/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Highrise Row/i })).toBeInTheDocument()
  })

  it('opens the level detail when a tappable station is clicked', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    const user = userEvent.setup()
    render(<JourneyScreen />)
    await screen.findByRole('button', { name: /Vacant Heights/i })
    await user.click(screen.getByRole('button', { name: /Vacant Heights/i }))
    const s = useNavStore.getState()
    expect(s.appView).toBe('levelDetail')
    expect(s.selectedLevelId).toBe('l1')
    expect(s.selectedLevelLocked).toBe(false)
  })

  it('opens a locked station detail flagged as locked', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    const user = userEvent.setup()
    render(<JourneyScreen />)
    await screen.findByRole('button', { name: /Highrise Row/i })
    await user.click(screen.getByRole('button', { name: /Highrise Row/i }))
    const s = useNavStore.getState()
    expect(s.appView).toBe('levelDetail')
    expect(s.selectedLevelId).toBe('l11')
    expect(s.selectedLevelLocked).toBe(true)
  })

  it('shows the marker legend (Complete / Current / Locked)', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    render(<JourneyScreen />)
    await screen.findByRole('button', { name: /Vacant Heights/i })
    expect(screen.getByText('Complete')).toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getByText('Locked')).toBeInTheDocument()
  })

  it('shows the all-clear badge when every level is cleared', async () => {
    ;(api.getJourney as any).mockResolvedValue(ALL_CLEAR)
    // Completion is client-derived: mark every level's Main solved.
    useProgressStore.setState({ byLevel: clearedProgress(['l1', 'l2', 'l11']) })
    render(<JourneyScreen />)
    expect(await screen.findByText(/Journey cleared/i)).toBeInTheDocument()
  })

  it('does not show the all-clear badge while levels remain', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    render(<JourneyScreen />)
    await screen.findByRole('button', { name: /Vacant Heights/i })
    expect(screen.queryByText(/Journey cleared/i)).not.toBeInTheDocument()
  })

  it('shows a retry affordance when the journey fetch fails', async () => {
    ;(api.getJourney as any).mockRejectedValue(new Error('network'))
    render(<JourneyScreen />)
    expect(await screen.findByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })
})
