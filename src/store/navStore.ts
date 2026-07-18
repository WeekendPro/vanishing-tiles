import { create } from 'zustand'

export type AppView =
  | 'auth' | 'home' | 'stagger' | 'training'
  | 'leaderboard' | 'soundDesign' | 'claimName'

interface NavState {
  appView: AppView
  goAuth: () => void
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
}

export const useNavStore = create<NavState>((set) => ({
  ...INITIAL,
  goAuth: () => set({ appView: 'auth' }),
  goHome: () => set({ appView: 'home' }),
  goStagger: () => set({ appView: 'stagger' }),
  goTraining: () => set({ appView: 'training' }),
  goLeaderboard: () => set({ appView: 'leaderboard' }),
  goSoundDesign: () => set({ appView: 'soundDesign' }),
  goClaimName: () => set({ appView: 'claimName' }),
  reset: () => set({ ...INITIAL }),
}))
