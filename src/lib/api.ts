import { supabase } from './supabase'
import type { Difficulty } from '../store/settingsStore'

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

/** Erases the caller's own Infinite Stagger history — every stagger_runs row
 *  and per-mode stagger_stats aggregate scoped to auth.uid() (migration 0017).
 *  This is what removes the caller from (or resets their bests on) every
 *  leaderboard board. Leaves the profile + account intact ("Erase my In-Game
 *  Data"). */
export async function eraseStaggerRecords(): Promise<void> {
  const { error } = await supabase.rpc('erase_stagger_records')
  if (error) throw error
}

/** Deletes the caller's entire account — the auth.users row, which cascades to
 *  their profile and ALL game history (migration 0018, "Erase my Account").
 *  Irreversible. The caller's session is invalid afterward, so the client must
 *  sign out immediately once this resolves. */
export async function deleteOwnAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_own_account')
  if (error) throw error
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
 *  never rank (see get_stagger_leaderboard, migrations 0014/0015). */
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

/** The caller's own profiles row. RLS ("own profile", migration 0003) scopes
 *  the select to auth.uid(), so no explicit id filter is needed. Null when
 *  no row is visible (no session, or the trigger somehow skipped —
 *  set_display_name self-heals the latter). */
export interface OwnProfile {
  displayName: string | null
  isGuest: boolean
}

export async function getOwnProfile(): Promise<OwnProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name,is_guest')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { displayName: data.display_name, isGuest: data.is_guest }
}

/** Claims/edits the caller's display name via the 0015 RPC. Validation and
 *  uniqueness are decided server-side; `taken`/`invalid`/`guest` come back
 *  as typed results (not thrown) so forms can render inline errors. */
export type SetDisplayNameResult =
  | { ok: true; displayName: string }
  | { ok: false; reason: 'invalid' | 'taken' | 'guest' }

export async function setDisplayName(name: string): Promise<SetDisplayNameResult> {
  const { data, error } = await supabase.rpc('set_display_name', { p_name: name })
  if (error) throw error
  const raw = data as { ok: boolean; display_name?: string; reason?: 'invalid' | 'taken' | 'guest' }
  return raw.ok
    ? { ok: true, displayName: raw.display_name as string }
    : { ok: false, reason: raw.reason as 'invalid' | 'taken' | 'guest' }
}
