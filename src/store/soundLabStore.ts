import { create } from 'zustand'
import {
  sfx, ONE_SHOT_IDS,
  type OneShotId, type SoundPatch, type BedPatch,
} from '../lib/sfx'

/**
 * The Sound Design lab's persistence (localStorage). Two things live here:
 *
 *  - OVERRIDES — the currently-active tweaks. Applied into the sfx engine at
 *    boot and on every knob commit, so the REAL GAME plays the tweaked
 *    palette immediately (that's the point: tune, then go play a run).
 *    A sound with no override plays its shipped default.
 *
 *  - PRESETS — labeled snapshots of a single sound's knobs ("bloom v3,
 *    softer shing"). The design conversation currency: the designer saves
 *    and labels candidates here, then EXPORTS the whole bank as JSON to
 *    paste into a chat/issue so the tuned values can be promoted into
 *    `DEFAULT_PATCHES` in code.
 */

export const SOUNDLAB_STORAGE_KEY = 'vt:soundlab:v1'

/** Everything tweakable: the one-shot gestures plus the ambient bed. */
export type LabSoundId = OneShotId | 'bed'

export interface SoundPreset {
  id: string
  label: string
  soundId: LabSoundId
  data: SoundPatch | BedPatch
  savedAt: string // ISO — so an exported bank reads chronologically
}

interface Persisted {
  overrides: Partial<Record<OneShotId, SoundPatch>>
  bedOverride: BedPatch | null
  presets: SoundPreset[]
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(SOUNDLAB_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Persisted>) : {}
    return { overrides: parsed.overrides ?? {}, bedOverride: parsed.bedOverride ?? null, presets: parsed.presets ?? [] }
  } catch {
    return { overrides: {}, bedOverride: null, presets: [] }
  }
}

function save(s: Persisted): void {
  try {
    localStorage.setItem(SOUNDLAB_STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* ignore quota / unavailable storage */
  }
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

interface SoundLabStore extends Persisted {
  /** Commit a one-shot's knobs: live in the engine + persisted. */
  setPatch: (id: OneShotId, patch: SoundPatch) => void
  /** Commit the bed's knobs: live (re-voices a running bed) + persisted. */
  setBed: (patch: BedPatch) => void
  /** Drop a sound's override — engine back to the shipped default. */
  resetSound: (id: LabSoundId) => void
  resetAll: () => void
  /** Snapshot the sound's CURRENT knobs under a label. */
  savePreset: (soundId: LabSoundId, label: string) => void
  /** Load a preset back into the active knobs (and the engine). */
  applyPreset: (presetId: string) => void
  deletePreset: (presetId: string) => void
  /** The whole bank as pretty JSON — for pasting into a design conversation. */
  exportJson: () => string
}

export const useSoundLabStore = create<SoundLabStore>((set, get) => ({
  ...load(),

  setPatch: (id, patch) => {
    sfx.setPatch(id, patch)
    set((s) => {
      const next: Persisted = { overrides: { ...s.overrides, [id]: patch }, bedOverride: s.bedOverride, presets: s.presets }
      save(next)
      return next
    })
  },

  setBed: (patch) => {
    sfx.setBedPatch(patch)
    set((s) => {
      const next: Persisted = { overrides: s.overrides, bedOverride: patch, presets: s.presets }
      save(next)
      return next
    })
  },

  resetSound: (id) => {
    set((s) => {
      let next: Persisted
      if (id === 'bed') {
        sfx.resetBed()
        next = { overrides: s.overrides, bedOverride: null, presets: s.presets }
      } else {
        sfx.resetPatch(id)
        const overrides = { ...s.overrides }
        delete overrides[id]
        next = { overrides, bedOverride: s.bedOverride, presets: s.presets }
      }
      save(next)
      return next
    })
  },

  resetAll: () => {
    ONE_SHOT_IDS.forEach(id => sfx.resetPatch(id))
    sfx.resetBed()
    set((s) => {
      const next: Persisted = { overrides: {}, bedOverride: null, presets: s.presets }
      save(next)
      return next
    })
  },

  savePreset: (soundId, label) => {
    const trimmed = label.trim()
    if (!trimmed) return
    const s = get()
    const data: SoundPatch | BedPatch = soundId === 'bed'
      ? (s.bedOverride ?? sfx.getBedPatch())
      : (s.overrides[soundId] ?? sfx.getPatch(soundId))
    const preset: SoundPreset = { id: newId(), label: trimmed, soundId, data: JSON.parse(JSON.stringify(data)), savedAt: new Date().toISOString() }
    set((state) => {
      const next: Persisted = { overrides: state.overrides, bedOverride: state.bedOverride, presets: [...state.presets, preset] }
      save(next)
      return next
    })
  },

  applyPreset: (presetId) => {
    const preset = get().presets.find(p => p.id === presetId)
    if (!preset) return
    if (preset.soundId === 'bed') get().setBed(preset.data as BedPatch)
    else get().setPatch(preset.soundId, preset.data as SoundPatch)
  },

  deletePreset: (presetId) => {
    set((s) => {
      const next: Persisted = { overrides: s.overrides, bedOverride: s.bedOverride, presets: s.presets.filter(p => p.id !== presetId) }
      save(next)
      return next
    })
  },

  exportJson: () => {
    const { overrides, bedOverride, presets } = get()
    return JSON.stringify({ overrides, bedOverride, presets }, null, 2)
  },
}))

// Boot: push any persisted tweaks into the engine so the game plays the
// designer's palette from the first load (the store is the source of truth;
// sfx mirrors it — same pattern as settingsStore's channel sync).
{
  const s = useSoundLabStore.getState()
  for (const id of ONE_SHOT_IDS) {
    const patch = s.overrides[id]
    if (patch) sfx.setPatch(id, patch)
  }
  if (s.bedOverride) sfx.setBedPatch(s.bedOverride)
}
