import { track } from '@vercel/analytics'
import type { Difficulty } from '../store/settingsStore'

// Single choke-point for Vercel Web Analytics custom events. Keeping the
// `@vercel/analytics` import isolated here means the RN-portable stores/engine
// never pull in a web-only dependency, and swapping analytics providers (or
// no-op'ing on native) is a one-file change.
//
// Vercel custom-event props must be primitives (string | number | boolean |
// null) — objects throw in the SDK — so every field below is a scalar. Keep
// events at the MILESTONE grain (run start/end, screen opens, auth): custom
// events are volume-capped per plan, so per-pick/per-tile tracking is off-limits.

/** Which way a visitor authenticated — the acquisition split (guest vs real). */
export type AuthMethod = 'guest' | 'email_signin' | 'email_signup' | 'google'

export const analytics = {
  /** A real Infinite Stagger run begins (fires on countdown, not the demo). */
  runStarted: (mode: Difficulty) => track('run_started', { mode }),

  /** A run ends at 0 lives — the engagement payload: how far, how well. */
  runEnded: (p: {
    mode: Difficulty
    level: number
    score: number
    bestStreak: number
    accuracy: number
  }) => track('run_ended', { ...p }),

  /** The naming drill is launched from the global menu. */
  trainingStarted: () => track('training_started'),

  /** The global rankings screen is opened (menu or game-over CTA). */
  leaderboardOpened: () => track('leaderboard_opened'),

  /** A session is established — carries the method so we can see the split. */
  authCompleted: (method: AuthMethod) => track('auth', { method }),

  /** A player shared their game-over card — `method` is the native share sheet
   *  vs. the desktop download/copy fallback (the acquisition-loop signal). */
  resultShared: (p: { mode: Difficulty; method: 'native' | 'download' }) =>
    track('result_shared', { ...p }),

  /** A player shared their leaderboard rank card (the standing flex). */
  rankShared: (p: { mode: Difficulty; method: 'native' | 'download' }) =>
    track('rank_shared', { ...p }),
}
