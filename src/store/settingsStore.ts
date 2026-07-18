import { create } from 'zustand'
import { sfx } from '../lib/sfx'

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
/**
 * Stagger reveal difficulty (set from the home screen; snapshotted into
 * `staggerStore.mode` at `startRun` — that snapshot, not this setting, drives
 * all in-run visuals and ordering). The recall tray is always in piece colours,
 * in every tier — only the memorize/reveal phase and recall ordering change.
 * Each tier layers on the last:
 *  - `easy`   — reveal in piece colours; recall in any order.
 *  - `medium` — reveal monochrome branded pink; recall in any order.
 *  - `hard`   — reveal monochrome branded pink; recall must follow the reveal
 *               order (ordered-recall enforced in `pickPiece`, surfaced as an
 *               "IN ORDER" chip during selecting).
 */
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface UserSettings {
  /** Selected Stagger reveal difficulty. Defaults to the gentlest (easy). */
  difficulty: Difficulty
  /** Sound-effects toggle (the per-gesture one-shots, `src/lib/sfx.ts`).
   *  (Music was cut with the synth bed — a produced audio bed returns later,
   *  and its channel settings come back with it.) */
  soundEnabled: boolean
  /** Sound-effects volume, 0–1. */
  sfxVolume: number
  /** First-run demo opt-out ("Don't show this again") — global across all difficulties. */
  hideDemo: boolean
}

function emptySettings(): UserSettings {
  return { difficulty: 'easy', soundEnabled: true, sfxVolume: 1, hideDemo: false }
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
  setDifficulty: (difficulty: Difficulty) => void
  setSoundEnabled: (on: boolean) => void
  setSfxVolume: (v: number) => void
  setHideDemo: (hidden: boolean) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: load(),

  setDifficulty: (difficulty) => {
    set((state) => {
      const next: UserSettings = { ...state.settings, difficulty }
      save(next)
      return { settings: next }
    })
  },

  setSoundEnabled: (on) => {
    sfx.setEnabled(on)
    set((state) => {
      const next: UserSettings = { ...state.settings, soundEnabled: on }
      save(next)
      return { settings: next }
    })
  },

  setHideDemo: (hidden) => {
    set((state) => {
      const next: UserSettings = { ...state.settings, hideDemo: hidden }
      save(next)
      return { settings: next }
    })
  },

  setSfxVolume: (v) => {
    sfx.setSfxVolume(v)
    set((state) => {
      const next: UserSettings = { ...state.settings, sfxVolume: v }
      save(next)
      return { settings: next }
    })
  },
}))

// Sync the engine's channel state with the persisted settings at boot (the
// store is the source of truth; sfx just mirrors it).
{
  const s = useSettingsStore.getState().settings
  sfx.setEnabled(s.soundEnabled)
  sfx.setSfxVolume(s.sfxVolume)
}
