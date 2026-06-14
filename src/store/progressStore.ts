import { create } from 'zustand'
import type { ComponentKey } from '../lib/components'
import {
  type ComponentBests, sumBests, levelStarsFromTotal, levelUnlocked,
} from '../lib/journeyScoring'

export const PROGRESS_STORAGE_KEY = 'gapcity:progress:v1'

export interface LevelProgress {
  best: ComponentBests
  timesPlayed: number
  lastPlayed: number | null
}

export function emptyLevelProgress(): LevelProgress {
  return {
    best: { main: 0, colors: 0, inSequence: 0, flash: 0, riddle: 0 },
    timesPlayed: 0,
    lastPlayed: null,
  }
}

export type ProgressMap = Record<string, LevelProgress>

function load(): ProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ProgressMap) : {}
  } catch {
    return {}
  }
}

function save(map: ProgressMap): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota / unavailable storage */
  }
}

interface ProgressStore {
  byLevel: ProgressMap
  getLevel: (levelId: string) => LevelProgress
  recordPlay: (levelId: string, component: ComponentKey, score: number) => void
  /** Admin/dev: hard-wipe all progress, returning the journey to level 1 with no scores. */
  resetProgress: () => void
}

export const useProgressStore = create<ProgressStore>((set, get) => ({
  byLevel: load(),

  getLevel: (levelId) => get().byLevel[levelId] ?? emptyLevelProgress(),

  recordPlay: (levelId, component, score) => {
    set((state) => {
      const prev = state.byLevel[levelId] ?? emptyLevelProgress()
      const next: LevelProgress = {
        best: { ...prev.best, [component]: Math.max(prev.best[component], score) },
        timesPlayed: prev.timesPlayed + 1,
        lastPlayed: Date.now(),
      }
      const byLevel = { ...state.byLevel, [levelId]: next }
      save(byLevel)
      return { byLevel }
    })
  },

  resetProgress: () => {
    try {
      localStorage.removeItem(PROGRESS_STORAGE_KEY)
    } catch {
      /* ignore unavailable storage */
    }
    set({ byLevel: {} })
  },
}))

// ── Derived selectors (pure over a LevelProgress) ──
export const levelTotal = (p: LevelProgress): number => sumBests(p.best)
export const levelStars = (p: LevelProgress): number => levelStarsFromTotal(levelTotal(p), p.best.main > 0)
/** A level is cleared (and unlocks the next) once its total reaches the 65% threshold. */
export const levelCleared = (p: LevelProgress): boolean => levelUnlocked(levelTotal(p))
export const isEarned = (p: LevelProgress, c: ComponentKey): boolean => p.best[c] > 0
