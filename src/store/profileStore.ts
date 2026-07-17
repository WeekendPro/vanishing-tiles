// Single source of truth for WHO the player is on screen. The name comes
// only from public.profiles (the leaderboard's source), never from auth
// metadata — that split is exactly what had the menu saying "Luis Alejo"
// while the board said "Player". Auth metadata still contributes email,
// avatar art, and the prefill suggestion (authName).
import { create } from 'zustand'
import { getOwnProfile, setDisplayName, type SetDisplayNameResult } from '../lib/api'
import { getUser } from '../lib/auth'
import { validateDisplayName } from '../lib/displayName'
import { useNavStore } from './navStore'

export interface ProfileSnapshot {
  displayName: string | null
  isGuest: boolean
  email: string | null
  avatarUrl: string | null
  /** Auth-metadata name (Google full name etc.) — prefill fodder, never shown. */
  authName: string | null
}

interface ProfileState extends ProfileSnapshot {
  loaded: boolean
  loadProfile: () => Promise<ProfileSnapshot | null>
  claimDisplayName: (raw: string) => Promise<SetDisplayNameResult>
  clear: () => void
}

const EMPTY: ProfileSnapshot & { loaded: boolean } = {
  loaded: false, displayName: null, isGuest: false, email: null, avatarUrl: null, authName: null,
}

export const useProfileStore = create<ProfileState>((set) => ({
  ...EMPTY,

  loadProfile: async () => {
    const { data } = await getUser()
    if (!data.user) {
      set({ ...EMPTY })
      return null
    }
    const m = data.user.user_metadata ?? {}
    // is_anonymous decides guesthood even before a profiles row exists;
    // a missing row otherwise reads as "unnamed non-guest" and the claim
    // RPC self-heals it on submit.
    const row = await getOwnProfile()
    const snap: ProfileSnapshot = {
      displayName: row?.displayName ?? null,
      isGuest: row?.isGuest ?? (data.user.is_anonymous ?? false),
      email: data.user.email ?? null,
      avatarUrl: (m.avatar_url || m.picture || null) as string | null,
      authName: (m.full_name || m.name || null) as string | null,
    }
    set({ ...snap, loaded: true })
    return snap
  },

  claimDisplayName: async (raw) => {
    const v = validateDisplayName(raw)
    if (!v.ok) return { ok: false, reason: 'invalid' }
    const res = await setDisplayName(v.name)
    if (res.ok) set({ displayName: res.displayName })
    return res
  },

  clear: () => set({ ...EMPTY }),
}))

/** The one post-auth router: session → (claim gate | home), no session → auth.
 *  Used by App's mount effect AND AuthScreen's email/guest paths, so every
 *  entrance goes through the same gate. */
export async function routeAfterAuth(): Promise<void> {
  const snap = await useProfileStore.getState().loadProfile()
  const nav = useNavStore.getState()
  if (!snap) { nav.goAuth(); return }
  if (!snap.isGuest && snap.displayName === null) nav.goClaimName()
  else nav.goHome()
}
