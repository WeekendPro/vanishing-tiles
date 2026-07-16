import { supabase } from './supabase'
import type { Difficulty } from '../store/settingsStore'

// Journey now plays 4 themed rounds entirely client-side (mirroring Practice)
// using the level's difficulty profile, then submits ONE aggregate level result.
// The level's difficulty profile comes from get_level (see getLevel below); the
// aggregate is recorded by record_level_result.

export interface SubmitLevelInput {
  levelId: string
  total: number
  stars: number
  cleared: boolean
}

/** Records the aggregate result of a Journey level (best_total/best_stars/cleared
 *  via a greatest() upsert) and returns the updated level_progress row. */
export async function submitLevelResult(a: SubmitLevelInput): Promise<unknown> {
  const { data, error } = await supabase.rpc('record_level_result', {
    p_level_id: a.levelId, p_total: a.total, p_stars: a.stars, p_cleared: a.cleared,
  })
  if (error) throw error
  return data
}

export interface SubmitStaggerRunInput {
  mode: Difficulty
  score: number
  bestStreak: number
  accuracy: number     // integer 0..100
  gapsRecalled: number
}

/** Records a finished Infinite Stagger run server-side (migration 0013):
 *  appends a stagger_runs row and greatest()-upserts the caller's
 *  per-(user, mode) stagger_stats aggregate. Works for guests too —
 *  anonymous sign-ins are authenticated users, so their stats persist
 *  under their anon uid (and carry over if they convert the account). */
export async function submitStaggerRun(a: SubmitStaggerRunInput): Promise<unknown> {
  const { data, error } = await supabase.rpc('record_stagger_run', {
    p_mode: a.mode, p_score: a.score, p_best_streak: a.bestStreak,
    p_accuracy: a.accuracy, p_gaps_recalled: a.gapsRecalled,
  })
  if (error) throw error
  return data
}

/** One ranked (non-guest) player on a mode's global board. */
export interface LeaderboardRow {
  rank: number
  displayName: string
  highScore: number
  bestStreak: number
  bestAccuracy: number
}

/** The caller's own standing. Stats are null until they finish a run in the
 *  mode; every rank is null for guests — their bests record privately but
 *  never rank (see stagger_mode_best in migration 0013). */
export interface LeaderboardMe {
  displayName: string
  isGuest: boolean
  highScore: number | null
  bestStreak: number | null
  bestAccuracy: number | null
  rank: number | null
  streakRank: number | null
  accuracyRank: number | null
}

export interface StaggerLeaderboard {
  total: number            // ranked (non-guest) players on this mode's board
  top: LeaderboardRow[]
  me: LeaderboardMe | null // null only when unauthenticated
}

interface RawLeaderboardRow {
  rank: number; display_name: string; high_score: number; best_streak: number; best_accuracy: number
}
interface RawLeaderboardMe {
  display_name: string; is_guest: boolean
  high_score: number | null; best_streak: number | null; best_accuracy: number | null
  rank: number | null; streak_rank: number | null; accuracy_rank: number | null
}

/** Fetches one mode's global leaderboard (migration 0014): the top ranked
 *  players plus the caller's own bests and per-metric ranks. */
export async function getStaggerLeaderboard(mode: Difficulty): Promise<StaggerLeaderboard> {
  const { data, error } = await supabase.rpc('get_stagger_leaderboard', { p_mode: mode })
  if (error) throw error
  const raw = data as { total: number; top: RawLeaderboardRow[]; me: RawLeaderboardMe | null }
  return {
    total: raw.total,
    top: (raw.top ?? []).map(r => ({
      rank: r.rank, displayName: r.display_name,
      highScore: r.high_score, bestStreak: r.best_streak, bestAccuracy: r.best_accuracy,
    })),
    me: raw.me && {
      displayName: raw.me.display_name, isGuest: raw.me.is_guest,
      highScore: raw.me.high_score, bestStreak: raw.me.best_streak, bestAccuracy: raw.me.best_accuracy,
      rank: raw.me.rank, streakRank: raw.me.streak_rank, accuracyRank: raw.me.accuracy_rank,
    },
  }
}

export async function getJourney() {
  const { data, error } = await supabase.rpc('get_journey')
  if (error) throw error
  return data
}

export async function getLevel(levelId: string) {
  const { data, error } = await supabase.rpc('get_level', { p_level_id: levelId })
  if (error) throw error
  return data
}

export async function getStats() {
  const { data, error } = await supabase.rpc('get_stats')
  if (error) throw error
  return data
}
