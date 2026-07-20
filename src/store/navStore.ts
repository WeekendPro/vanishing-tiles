import { create } from 'zustand'

export type AppView =
  | 'auth' | 'home' | 'stagger' | 'training'
  | 'leaderboard' | 'soundDesign' | 'claimName'

interface NavState {
  appView: AppView
  /** Email to seed the AuthScreen form with — set when a guest starts sign-up
   *  from somewhere that already knows their address (the game-over CTA), so
   *  they don't retype it. Null unless goAuth was handed one. */
  authPrefillEmail: string | null
  goAuth: (prefillEmail?: string) => void
  goHome: () => void
  goStagger: () => void
  goTraining: () => void
  goLeaderboard: () => void
  goSoundDesign: () => void
  goClaimName: () => void
  reset: () => void
}

const INITIAL = {
  appView: 'auth' as AppView,
  authPrefillEmail: null as string | null,
}

export const useNavStore = create<NavState>((set) => ({
  ...INITIAL,
  goAuth: (prefillEmail) => set({ appView: 'auth', authPrefillEmail: prefillEmail ?? null }),
  goHome: () => set({ appView: 'home' }),
  goStagger: () => set({ appView: 'stagger' }),
  goTraining: () => set({ appView: 'training' }),
  goLeaderboard: () => set({ appView: 'leaderboard' }),
  goSoundDesign: () => set({ appView: 'soundDesign' }),
  goClaimName: () => set({ appView: 'claimName' }),
  reset: () => set({ ...INITIAL }),
}))
