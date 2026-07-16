import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({ getStaggerLeaderboard: vi.fn() }))
vi.mock('../../src/lib/auth', () => ({ signOut: vi.fn().mockResolvedValue({ error: null }) }))
import { getStaggerLeaderboard, type StaggerLeaderboard } from '../../src/lib/api'
import * as auth from '../../src/lib/auth'
import { LeaderboardScreen } from '../../src/components/LeaderboardScreen'
import { useNavStore } from '../../src/store/navStore'
import { useSettingsStore } from '../../src/store/settingsStore'

const fetchBoard = vi.mocked(getStaggerLeaderboard)

function makeBoard(overrides: Partial<StaggerLeaderboard> = {}): StaggerLeaderboard {
  return {
    total: 1204,
    top: [
      { rank: 1, displayName: 'MNEMO', highScore: 18300, bestStreak: 24, bestAccuracy: 97 },
      { rank: 2, displayName: 'Tetra', highScore: 16450, bestStreak: 21, bestAccuracy: 95 },
      { rank: 3, displayName: 'Rin_09', highScore: 15100, bestStreak: 18, bestAccuracy: 93 },
    ],
    me: {
      displayName: 'Luis', isGuest: false,
      highScore: 6450, bestStreak: 11, bestAccuracy: 88,
      rank: 23, streakRank: 9, accuracyRank: 17,
    },
    ...overrides,
  }
}

beforeEach(() => {
  useNavStore.getState().reset()
  useNavStore.setState({ appView: 'leaderboard' })
  useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'transit', difficulty: 'medium' } })
  vi.clearAllMocks()
  fetchBoard.mockResolvedValue(makeBoard())
})

describe('LeaderboardScreen', () => {
  it('renders the three difficulty tabs with the persisted difficulty active, and fetches that board', async () => {
    render(<LeaderboardScreen />)

    const easy = screen.getByRole('button', { name: /easy/i })
    const medium = screen.getByRole('button', { name: /medium/i })
    const hard = screen.getByRole('button', { name: /hard/i })
    expect(easy).toHaveAttribute('aria-pressed', 'false')
    expect(medium).toHaveAttribute('aria-pressed', 'true')
    expect(hard).toHaveAttribute('aria-pressed', 'false')

    await waitFor(() => expect(fetchBoard).toHaveBeenCalledWith('medium'))
  })

  it('renders the you-hero card: name, rank of total, and all three bests with per-metric ranks', async () => {
    render(<LeaderboardScreen />)

    expect(await screen.findByText('Luis')).toBeInTheDocument()
    // "#23" appears twice by design: the hero rank line AND the score tile's rank chip.
    expect(screen.getAllByText(/#23/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/of 1,204/i)).toBeInTheDocument()
    expect(screen.getByText(/top 2%/i)).toBeInTheDocument()
    expect(screen.getByText('6,450')).toBeInTheDocument()
    expect(screen.getByText('×11')).toBeInTheDocument()
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('#9')).toBeInTheDocument()
    expect(screen.getByText('#17')).toBeInTheDocument()
  })

  it('lists the top players with score / streak / accuracy', async () => {
    render(<LeaderboardScreen />)

    expect(await screen.findByText('MNEMO')).toBeInTheDocument()
    expect(screen.getByText('18,300')).toBeInTheDocument()
    expect(screen.getByText('×24')).toBeInTheDocument()
    expect(screen.getByText('97%')).toBeInTheDocument()
    expect(screen.getByText('Tetra')).toBeInTheDocument()
    expect(screen.getByText('Rin_09')).toBeInTheDocument()
  })

  it('tags your row with YOU when your rank is in the visible list', async () => {
    fetchBoard.mockResolvedValue(makeBoard({
      me: {
        displayName: 'Tetra', isGuest: false,
        highScore: 16450, bestStreak: 21, bestAccuracy: 95,
        rank: 2, streakRank: 3, accuracyRank: 4,
      },
    }))
    render(<LeaderboardScreen />)

    expect(await screen.findByText('YOU')).toBeInTheDocument()
  })

  it('does not show a YOU tag when your rank is outside the visible list', async () => {
    render(<LeaderboardScreen />) // me.rank 23, top shows 1–3

    await screen.findByText('MNEMO')
    expect(screen.queryByText('YOU')).not.toBeInTheDocument()
  })

  it('switching tabs fetches that mode and moves the active segment', async () => {
    const user = userEvent.setup()
    render(<LeaderboardScreen />)
    await screen.findByText('MNEMO')

    await user.click(screen.getByRole('button', { name: /hard/i }))

    await waitFor(() => expect(fetchBoard).toHaveBeenCalledWith('hard'))
    expect(screen.getByRole('button', { name: /hard/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('a guest gets no hero card but the dashed sign-up footer; Sign up tears down to auth', async () => {
    fetchBoard.mockResolvedValue(makeBoard({
      me: {
        displayName: 'Guest', isGuest: true,
        highScore: 900, bestStreak: 4, bestAccuracy: 71,
        rank: null, streakRank: null, accuracyRank: null,
      },
    }))
    const user = userEvent.setup()
    render(<LeaderboardScreen />)

    expect(await screen.findByText(/guests play unranked/i)).toBeInTheDocument()
    expect(screen.queryByText(/top 2%/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /sign up/i }))
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(useNavStore.getState().appView).toBe('auth'))
  })

  it('a signed-in player with no runs on the mode gets a play-a-run nudge instead of the hero', async () => {
    fetchBoard.mockResolvedValue(makeBoard({
      me: {
        displayName: 'Luis', isGuest: false,
        highScore: null, bestStreak: null, bestAccuracy: null,
        rank: null, streakRank: null, accuracyRank: null,
      },
    }))
    render(<LeaderboardScreen />)

    expect(await screen.findByText(/finish a run/i)).toBeInTheDocument()
    expect(screen.queryByText(/top 2%/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/guests play unranked/i)).not.toBeInTheDocument()
  })

  it('Back returns to the Home screen', async () => {
    const user = userEvent.setup()
    render(<LeaderboardScreen />)

    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(useNavStore.getState().appView).toBe('home')
  })

  it('a failed fetch shows an error state whose Retry refetches', async () => {
    fetchBoard.mockRejectedValueOnce(new Error('network down'))
    const user = userEvent.setup()
    render(<LeaderboardScreen />)

    expect(await screen.findByText(/couldn.t load/i)).toBeInTheDocument()

    fetchBoard.mockResolvedValue(makeBoard())
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('MNEMO')).toBeInTheDocument()
  })
})
