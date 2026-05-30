import { supabase } from './supabase'
import type { Grid, Gap, PieceType } from '@shared/types'

export interface StartSessionResult {
  session_id: string
  puzzle: { grid: Grid; gaps: Gap[] }
  view_duration_ms: number
  select_duration_ms: number
  max_tries: number
}

export async function startSession(levelId: string): Promise<StartSessionResult> {
  const { data, error } = await supabase.functions.invoke('start_session', {
    body: { level_id: levelId },
  })
  if (error) throw error
  return data as StartSessionResult
}

export interface SubmitAttemptInput {
  sessionId: string
  selection: { pieceType: PieceType; count: number }[]
  viewMsRemaining: number
  selectMsRemaining: number
}

export async function submitAttempt(a: SubmitAttemptInput) {
  const { data, error } = await supabase.functions.invoke('submit_attempt', {
    body: {
      session_id: a.sessionId, selection: a.selection,
      view_ms_remaining: a.viewMsRemaining, select_ms_remaining: a.selectMsRemaining,
    },
  })
  if (error) throw error
  return data // { attempt, placements, session_status, progress }
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
