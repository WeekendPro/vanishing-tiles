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
    expect(await screen.findByText('Cellar Door')).toBeTruthy()
    expect(screen.getByRole('button', { name: /play/i })).toBeTruthy()
    for (const b of ['Colors', 'In-Sequence', 'Flash', 'Riddle']) {
      expect(screen.getByText(b)).toBeTruthy()
    }
    expect(screen.getAllByTestId('difficulty-pip')).toHaveLength(5)
  })

  it('locks badges until the main puzzle is solved', async () => {
    render(<LevelScreen />)
    await screen.findByText('Cellar Door')
    const colors = screen.getByRole('button', { name: /Colors/i })
    expect(colors).toBeDisabled()
    useProgressStore.getState().recordPlay('L1', 'main', 90)
    await waitFor(() => expect(screen.getByRole('button', { name: /Colors/i })).not.toBeDisabled())
  })

  it('Riddle stays a Coming soon placeholder even after main is solved', async () => {
    useProgressStore.getState().recordPlay('L1', 'main', 90)
    render(<LevelScreen />)
    await screen.findByText('Cellar Door')
    expect(screen.getByRole('button', { name: /Riddle/i })).toBeDisabled()
  })
})
