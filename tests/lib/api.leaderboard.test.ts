import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))
import { supabase } from '../../src/lib/supabase'
import { getStaggerLeaderboard } from '../../src/lib/api'

const rpc = vi.mocked(supabase.rpc)

/** The raw jsonb payload shape the get_stagger_leaderboard RPC (migration 0014)
 *  returns: snake_case, `me` null only when unauthenticated, per-metric ranks
 *  null for guests (unranked) and stats null when the caller has no runs yet. */
const RAW = {
  total: 1204,
  top: [
    { rank: 1, display_name: 'MNEMO', high_score: 18300, best_streak: 24, best_accuracy: 97 },
    { rank: 2, display_name: 'Tetra', high_score: 16450, best_streak: 21, best_accuracy: 95 },
  ],
  me: {
    display_name: 'Luis', is_guest: false,
    high_score: 6450, best_streak: 11, best_accuracy: 88,
    rank: 23, streak_rank: 9, accuracy_rank: 17,
  },
}

beforeEach(() => vi.clearAllMocks())

describe('getStaggerLeaderboard', () => {
  it('calls the get_stagger_leaderboard RPC with the mode and maps to camelCase', async () => {
    rpc.mockResolvedValueOnce({ data: RAW, error: null } as never)

    const board = await getStaggerLeaderboard('medium')

    expect(rpc).toHaveBeenCalledWith('get_stagger_leaderboard', { p_mode: 'medium' })
    expect(board.total).toBe(1204)
    expect(board.top).toEqual([
      { rank: 1, displayName: 'MNEMO', highScore: 18300, bestStreak: 24, bestAccuracy: 97 },
      { rank: 2, displayName: 'Tetra', highScore: 16450, bestStreak: 21, bestAccuracy: 95 },
    ])
    expect(board.me).toEqual({
      displayName: 'Luis', isGuest: false,
      highScore: 6450, bestStreak: 11, bestAccuracy: 88,
      rank: 23, streakRank: 9, accuracyRank: 17,
    })
  })

  it('passes through a null me (unauthenticated) and an empty board', async () => {
    rpc.mockResolvedValueOnce({ data: { total: 0, top: [], me: null }, error: null } as never)

    const board = await getStaggerLeaderboard('hard')

    expect(board).toEqual({ total: 0, top: [], me: null })
  })

  it('keeps a guest unranked: rank fields stay null while bests pass through', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        total: 12,
        top: [],
        me: {
          display_name: 'Guest', is_guest: true,
          high_score: 900, best_streak: 4, best_accuracy: 71,
          rank: null, streak_rank: null, accuracy_rank: null,
        },
      },
      error: null,
    } as never)

    const board = await getStaggerLeaderboard('easy')

    expect(board.me?.isGuest).toBe(true)
    expect(board.me?.rank).toBeNull()
    expect(board.me?.highScore).toBe(900)
  })

  it('throws when the RPC returns an error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } } as never)

    await expect(getStaggerLeaderboard('easy')).rejects.toEqual({ message: 'boom' })
  })
})
