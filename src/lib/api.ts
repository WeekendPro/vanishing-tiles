import { supabase } from './supabase'

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
