import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../../src/lib/api', () => ({
  getLevel: vi.fn(async () => ({
    level_id: 'L1', display_number: 1, name: 'Cellar Door', theme_name: 'The Hollows',
    view_duration_ms: 4000, select_duration_ms: 10000, gap_count: 6, shape_complexity: 'medium',
    adjacency: 0, my_pr: null, my_stars: 0, global_high: null, last_played: null,
  })),
}))

import { LevelScreen } from '../../src/components/LevelScreen'
import { useProgressStore } from '../../src/store/progressStore'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  localStorage.clear()
  useProgressStore.setState({ byLevel: {} })
  useNavStore.getState().reset()
  useNavStore.getState().openLevel('L1')
})

describe('LevelScreen', () => {
  it('renders name, difficulty pips, a Play button and four badges', async () => {
    render(<LevelScreen />)
    // Level name appears in the hero (and again as the PLAY badge caption)
    expect((await screen.findAllByText('Cellar Door')).length).toBeGreaterThan(0)
    // PLAY badge button
    expect(screen.getByTestId('badge-main')).toBeTruthy()
    // Four challenge badges by testid
    expect(screen.getByTestId('badge-colors')).toBeTruthy()
    expect(screen.getByTestId('badge-inSequence')).toBeTruthy()
    expect(screen.getByTestId('badge-flash')).toBeTruthy()
    expect(screen.getByTestId('badge-riddle')).toBeTruthy()
    // Ribbon text: COLORS / SEQUENCE / DON'T BLINK / RIDDLE
    expect(screen.getByText('COLORS')).toBeTruthy()
    expect(screen.getByText('SEQUENCE')).toBeTruthy()
    expect(screen.getByText("DON'T BLINK")).toBeTruthy()
    expect(screen.getByText('RIDDLE')).toBeTruthy()
    // Exactly 5 difficulty pips
    expect(screen.getAllByTestId('difficulty-pip')).toHaveLength(5)
  })

  it('locks badges until the main puzzle is solved', async () => {
    render(<LevelScreen />)
    await screen.findAllByText('Cellar Door')
    const colors = screen.getByTestId('badge-colors')
    expect(colors).toBeDisabled()
    useProgressStore.getState().recordPlay('L1', 'main', 90)
    await waitFor(() => expect(screen.getByTestId('badge-colors')).not.toBeDisabled())
  })

  it('Riddle stays a Coming soon placeholder even after main is solved', async () => {
    useProgressStore.getState().recordPlay('L1', 'main', 90)
    render(<LevelScreen />)
    await screen.findAllByText('Cellar Door')
    expect(screen.getByTestId('badge-riddle')).toBeDisabled()
  })

  it("Don't Blink badge renders (formerly Flash)", async () => {
    render(<LevelScreen />)
    await screen.findAllByText('Cellar Door')
    expect(screen.getByTestId('badge-flash')).toBeTruthy()
    expect(screen.getByText("DON'T BLINK")).toBeTruthy()
  })
})
