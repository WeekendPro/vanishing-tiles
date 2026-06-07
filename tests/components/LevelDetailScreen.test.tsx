import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({ getLevel: vi.fn() }))
const startJourneyLevel = vi.fn()
vi.mock('../../src/store/gameStore', () => ({
  useGameStore: (sel: any) => sel({ startJourneyLevel }),
}))
import * as api from '../../src/lib/api'
import { LevelDetailScreen } from '../../src/components/LevelDetailScreen'
import { useNavStore } from '../../src/store/navStore'

const LEVEL = {
  level_id: 'l1', display_number: 1, name: 'Vacant Heights', theme_name: 'The Hollows',
  view_duration_ms: 7000, select_duration_ms: 9000,
  gap_count: 4, shape_complexity: 'simple', adjacency: 1,
  my_pr: 1820, my_stars: 3, global_high: 1950, last_played: null,
}

beforeEach(() => {
  useNavStore.getState().reset()
  useNavStore.getState().openLevel('l1')
  vi.clearAllMocks()
})

describe('LevelDetailScreen', () => {
  it('shows the level metadata once loaded', async () => {
    ;(api.getLevel as any).mockResolvedValue(LEVEL)
    render(<LevelDetailScreen />)
    expect(await screen.findByText(/Vacant Heights/)).toBeInTheDocument()
    expect(screen.getByText(/The Hollows/)).toBeInTheDocument()
    expect(screen.getByText(/1820/)).toBeInTheDocument()
    expect(screen.getByText(/1950/)).toBeInTheDocument()
  })

  it('PLAY starts a journey level with the fixed difficulty profile and enters playing', async () => {
    ;(api.getLevel as any).mockResolvedValue(LEVEL)
    const user = userEvent.setup()
    render(<LevelDetailScreen />)
    await screen.findByText(/Vacant Heights/)
    await user.click(screen.getByRole('button', { name: /PLAY/i }))
    expect(startJourneyLevel).toHaveBeenCalledWith(
      'l1',
      { viewDuration: 7000, selectDuration: 9000, placeDuration: 0, gapCount: 4, complexity: 'simple', adjacency: 1 },
      1820, 1, 'Vacant Heights',
    )
    expect(useNavStore.getState().appView).toBe('playing')
  })

  it('communicates a locked level and offers no PLAY action', async () => {
    useNavStore.getState().openLevel('l1', true)
    ;(api.getLevel as any).mockResolvedValue(LEVEL)
    const user = userEvent.setup()
    render(<LevelDetailScreen />)
    await screen.findByText(/Vacant Heights/)
    expect(screen.getByText(/Clear the current station to unlock/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^PLAY$/i })).not.toBeInTheDocument()
    const locked = screen.getByRole('button', { name: /^Locked$/i })
    expect(locked).toBeDisabled()
    await user.click(locked)
    expect(startJourneyLevel).not.toHaveBeenCalled()
    expect(useNavStore.getState().appView).toBe('levelDetail')
  })
})
