import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({ getJourney: vi.fn() }))
import * as api from '../../src/lib/api'
import { JourneyScreen } from '../../src/components/JourneyScreen'
import { useNavStore } from '../../src/store/navStore'

const JOURNEY = [
  { theme_id: 't1', slug: 'the_bronx', name: 'The Bronx', mechanic: 'standard', sort_order: 1, locked: false,
    levels: [
      { level_id: 'l1', display_number: 1, name: 'Castle Hill', my_pr: 1820, my_stars: 3, cleared: true, last_played: null, global_best: 1900 },
      { level_id: 'l2', display_number: 2, name: 'East Tremont', my_pr: null, my_stars: 0, cleared: false, last_played: null, global_best: null },
    ] },
  { theme_id: 't3', slug: 'manhattan', name: 'Manhattan', mechanic: 'standard', sort_order: 2, locked: true,
    levels: [
      { level_id: 'l11', display_number: 11, name: 'Harlem', my_pr: null, my_stars: 0, cleared: false, last_played: null, global_best: null },
    ] },
]

beforeEach(() => {
  useNavStore.getState().reset()
  vi.clearAllMocks()
})

describe('JourneyScreen', () => {
  it('renders unlocked theme sections with level cards and PR badges', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    render(<JourneyScreen />)
    expect(await screen.findByText('The Bronx')).toBeInTheDocument()
    expect(screen.getByText('Manhattan')).toBeInTheDocument()
    expect(screen.getByText(/1820/)).toBeInTheDocument()
  })

  it('opens the level detail when an unlocked card is tapped', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    const user = userEvent.setup()
    render(<JourneyScreen />)
    await screen.findByText('The Bronx')
    await user.click(screen.getByRole('button', { name: /Castle Hill/i }))
    const s = useNavStore.getState()
    expect(s.appView).toBe('levelDetail')
    expect(s.selectedLevelId).toBe('l1')
  })

  it('does not open locked-theme levels', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    render(<JourneyScreen />)
    await screen.findByText('Manhattan')
    const locked = screen.getByRole('button', { name: /Harlem/i })
    expect(locked).toBeDisabled()
  })

  it('shows a retry affordance when the journey fetch fails', async () => {
    ;(api.getJourney as any).mockRejectedValue(new Error('network'))
    render(<JourneyScreen />)
    expect(await screen.findByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })
})
