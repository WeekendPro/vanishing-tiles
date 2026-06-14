import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

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
  it('renders the name, district, score bar, difficulty pips, and the deck focused on The Classic', async () => {
    render(<LevelScreen />)
    expect(await screen.findByText('Cellar Door')).toBeTruthy()
    // District is shown again (uppercased)
    expect(screen.getByText('THE HOLLOWS')).toBeTruthy()
    // Score bar replaces the old star row
    expect(screen.getByTestId('score-bar')).toBeTruthy()
    // Five difficulty pips
    expect(screen.getAllByTestId('difficulty-pip')).toHaveLength(5)
    // The deck opens on The Classic (its detail + play button)
    expect(screen.getByText('THE CLASSIC')).toBeTruthy()
    expect(screen.getByTestId('puzzle-detail-main')).toBeTruthy()
    expect(screen.getByTestId('puzzle-play-main')).toBeTruthy()
  })

  it('makes every puzzle playable from the start (no main-puzzle gate)', async () => {
    render(<LevelScreen />)
    await screen.findByText('Cellar Door')
    // No progress at all — advance the deck to Chromatic and confirm it is playable
    fireEvent.click(screen.getByRole('button', { name: 'Next puzzle' }))
    expect(screen.getByTestId('puzzle-play-colors')).not.toBeDisabled()
  })

  it('keeps Riddle a coming-soon placeholder', async () => {
    render(<LevelScreen />)
    await screen.findByText('Cellar Door')
    // Riddle is the left neighbor of The Classic — step back to focus it
    fireEvent.click(screen.getByRole('button', { name: 'Previous puzzle' }))
    expect(screen.getByTestId('puzzle-play-riddle')).toBeDisabled()
  })
})
