import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({ getJourney: vi.fn() }))
import * as api from '../../src/lib/api'
import { JourneyScreen } from '../../src/components/JourneyScreen'
import { useNavStore } from '../../src/store/navStore'

const JOURNEY = [
  { theme_id: 't1', slug: 'beginner', name: 'Beginner', mechanic: 'classic', sort_order: 1, locked: false,
    levels: [
      { level_id: 'l1', display_number: 1, my_pr: 1820, my_stars: 3, cleared: true, last_played: null, global_best: 1900 },
      { level_id: 'l2', display_number: 2, my_pr: null, my_stars: 0, cleared: false, last_played: null, global_best: null },
    ] },
  { theme_id: 't2', slug: 'advanced', name: 'Advanced', mechanic: 'menu-trim', sort_order: 2, locked: true,
    levels: [
      { level_id: 'l9', display_number: 9, my_pr: null, my_stars: 0, cleared: false, last_played: null, global_best: null },
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
    expect(await screen.findByText('Beginner')).toBeInTheDocument()
    expect(screen.getByText('Advanced')).toBeInTheDocument()
    expect(screen.getByText(/1820/)).toBeInTheDocument() // PR badge on cleared level
  })

  it('opens the level detail when an unlocked card is tapped', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    const user = userEvent.setup()
    render(<JourneyScreen />)
    await screen.findByText('Beginner')
    await user.click(screen.getByRole('button', { name: /Level 1/i }))
    const s = useNavStore.getState()
    expect(s.appView).toBe('levelDetail')
    expect(s.selectedLevelId).toBe('l1')
  })

  it('does not open locked-theme levels', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    render(<JourneyScreen />)
    await screen.findByText('Advanced')
    const locked = screen.getByRole('button', { name: /Level 9/i })
    expect(locked).toBeDisabled()
  })

  it('shows a retry affordance when the journey fetch fails', async () => {
    ;(api.getJourney as any).mockRejectedValue(new Error('network'))
    render(<JourneyScreen />)
    expect(await screen.findByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })
})
