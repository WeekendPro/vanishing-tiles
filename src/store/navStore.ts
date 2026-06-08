import { create } from 'zustand'

export type AppView =
  | 'auth' | 'journey' | 'levelDetail' | 'playing' | 'results' | 'practice'

interface NavState {
  appView: AppView
  selectedLevelId: string | null
  selectedLevelLocked: boolean
  levelOrder: string[]
  goAuth: () => void
  goJourney: () => void
  openLevel: (id: string, locked?: boolean) => void
  enterPlaying: () => void
  showResults: () => void
  backToMap: () => void
  goPractice: () => void
  setLevelOrder: (ids: string[]) => void
  goNextLevel: () => void
  hasNextLevel: () => boolean
  reset: () => void
}

const INITIAL = {
  appView: 'auth' as AppView,
  selectedLevelId: null as string | null,
  selectedLevelLocked: false,
  levelOrder: [] as string[],
}

export const useNavStore = create<NavState>((set, get) => ({
  ...INITIAL,
  goAuth: () => set({ appView: 'auth' }),
  goJourney: () => set({ appView: 'journey' }),
  openLevel: (id, locked = false) =>
    set({ appView: 'levelDetail', selectedLevelId: id, selectedLevelLocked: locked }),
  enterPlaying: () => set({ appView: 'playing' }),
  showResults: () => set({ appView: 'results' }),
  backToMap: () => set({ appView: 'journey' }),
  goPractice: () => set({ appView: 'practice' }),
  setLevelOrder: (ids) => set({ levelOrder: ids }),
  goNextLevel: () => {
    const { levelOrder, selectedLevelId } = get()
    const i = selectedLevelId ? levelOrder.indexOf(selectedLevelId) : -1
    const next = i >= 0 && i < levelOrder.length - 1 ? levelOrder[i + 1] : null
    if (next) set({ appView: 'levelDetail', selectedLevelId: next, selectedLevelLocked: false })
  },
  hasNextLevel: () => {
    const { levelOrder, selectedLevelId } = get()
    const i = selectedLevelId ? levelOrder.indexOf(selectedLevelId) : -1
    return i >= 0 && i < levelOrder.length - 1
  },
  reset: () => set({ ...INITIAL }),
}))
