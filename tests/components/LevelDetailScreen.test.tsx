import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({ getLevel: vi.fn() }))
const startJourneySession = vi.fn().mockResolvedValue(undefined)
vi.mock('../../src/store/gameStore', () => ({
  useGameStore: (sel: any) => sel({ startJourneySession }),
}))
import * as api from '../../src/lib/api'
import { LevelDetailScreen } from '../../src/components/LevelDetailScreen'
import { useNavStore } from '../../src/store/navStore'

const LEVEL = {
  level_id: 'l1', display_number: 1, theme_name: 'Beginner',
  view_duration_ms: 7000, select_duration_ms: 9000,
  gap_count: 4, shape_complexity: 'simple', adjacency: 'low',
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
    expect(await screen.findByText(/Beginner/)).toBeInTheDocument()
    expect(screen.getByText(/1820/)).toBeInTheDocument()
    expect(screen.getByText(/1950/)).toBeInTheDocument()
  })

  it('PLAY starts a journey session and enters playing', async () => {
    ;(api.getLevel as any).mockResolvedValue(LEVEL)
    const user = userEvent.setup()
    render(<LevelDetailScreen />)
    await screen.findByText(/Beginner/)
    await user.click(screen.getByRole('button', { name: /PLAY/i }))
    expect(startJourneySession).toHaveBeenCalledWith('l1', 1820, 1)
    expect(useNavStore.getState().appView).toBe('playing')
  })
})
