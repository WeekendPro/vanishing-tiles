import { create } from 'zustand'

export type AppView =
  | 'auth' | 'journey' | 'levelDetail' | 'playing' | 'results' | 'practice'

interface NavState {
  appView: AppView
  selectedLevelId: string | null
  selectedLevelLocked: boolean
  goAuth: () => void
  goJourney: () => void
  openLevel: (id: string, locked?: boolean) => void
  enterPlaying: () => void
  showResults: () => void
  backToMap: () => void
  goPractice: () => void
  reset: () => void
}

const INITIAL = {
  appView: 'auth' as AppView,
  selectedLevelId: null as string | null,
  selectedLevelLocked: false,
}

export const useNavStore = create<NavState>((set) => ({
  ...INITIAL,
  goAuth: () => set({ appView: 'auth' }),
  goJourney: () => set({ appView: 'journey' }),
  openLevel: (id, locked = false) =>
    set({ appView: 'levelDetail', selectedLevelId: id, selectedLevelLocked: locked }),
  enterPlaying: () => set({ appView: 'playing' }),
  showResults: () => set({ appView: 'results' }),
  backToMap: () => set({ appView: 'journey' }),
  goPractice: () => set({ appView: 'practice' }),
  reset: () => set({ ...INITIAL }),
}))
