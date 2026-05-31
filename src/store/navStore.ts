import { create } from 'zustand'

export type AppView =
  | 'auth' | 'journey' | 'levelDetail' | 'playing' | 'results' | 'practice'

interface NavState {
  appView: AppView
  selectedLevelId: string | null
  goAuth: () => void
  goJourney: () => void
  openLevel: (id: string) => void
  enterPlaying: () => void
  showResults: () => void
  backToMap: () => void
  goPractice: () => void
  reset: () => void
}

const INITIAL = { appView: 'auth' as AppView, selectedLevelId: null as string | null }

export const useNavStore = create<NavState>((set) => ({
  ...INITIAL,
  goAuth: () => set({ appView: 'auth' }),
  goJourney: () => set({ appView: 'journey' }),
  openLevel: (id) => set({ appView: 'levelDetail', selectedLevelId: id }),
  enterPlaying: () => set({ appView: 'playing' }),
  showResults: () => set({ appView: 'results' }),
  backToMap: () => set({ appView: 'journey' }),
  goPractice: () => set({ appView: 'practice' }),
  reset: () => set({ ...INITIAL }),
}))
