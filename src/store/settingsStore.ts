import { create } from 'zustand'
import type { PlayableComponent } from '../lib/components'

export const SETTINGS_STORAGE_KEY = 'gapcity:settings:v1'

/**
 * Client-side user settings (localStorage).
 *
 * This is a deliberate stand-in for the future server-backed **Settings** system
 * (its own spike). Keep this shape DB-friendly — a flat, JSON-serializable object
 * keyed by setting — so it can be lifted to a `user_settings` row and synced later
 * with minimal churn. When that lands, this store becomes the local cache/optimistic
 * layer over the server value; consumers (selectors below) shouldn't need to change.
 */
/** Which Journey map rendering to use. R&D toggle while we compare directions. */
export type MapStyle = 'transit' | 'mentalBrain' | 'git'

export interface UserSettings {
  /** Per-puzzle-type opt-out of the instruction (briefing) page. Keyed by component. */
  hideBriefing: Partial<Record<PlayableComponent, boolean>>
  /** Selected Journey map style. Defaults to the original transit map. */
  mapStyle: MapStyle
}

function emptySettings(): UserSettings {
  return { hideBriefing: {}, mapStyle: 'transit' }
}

function load(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    return raw ? { ...emptySettings(), ...(JSON.parse(raw) as Partial<UserSettings>) } : emptySettings()
  } catch {
    return emptySettings()
  }
}

function save(s: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* ignore quota / unavailable storage */
  }
}

interface SettingsStore {
  settings: UserSettings
  isBriefingHidden: (component: PlayableComponent) => boolean
  setBriefingHidden: (component: PlayableComponent, hidden: boolean) => void
  setMapStyle: (style: MapStyle) => void
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: load(),

  isBriefingHidden: (component) => !!get().settings.hideBriefing[component],

  setBriefingHidden: (component, hidden) => {
    set((state) => {
      const next: UserSettings = {
        ...state.settings,
        hideBriefing: { ...state.settings.hideBriefing, [component]: hidden },
      }
      save(next)
      return { settings: next }
    })
  },

  setMapStyle: (style) => {
    set((state) => {
      const next: UserSettings = { ...state.settings, mapStyle: style }
      save(next)
      return { settings: next }
    })
  },
}))
