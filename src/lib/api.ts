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
