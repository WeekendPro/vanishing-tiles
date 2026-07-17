import { create } from 'zustand'
import {
  sfx, ONE_SHOT_IDS,
  type OneShotId, type SoundPatch,
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
 *    `DEFAULT_PATCHES` in code (bonusLift was the first).
 *
 * (The ambient bed's overrides/presets were cut with the synth bed; stale
 * 'bed' entries in an existing localStorage bank are dropped at load.)
 */

export const SOUNDLAB_STORAGE_KEY = 'vt:soundlab:v1'

export type LabSoundId = OneShotId

export interface SoundPreset {
  id: string
  label: string
  soundId: LabSoundId
  data: SoundPatch
  savedAt: string // ISO — so an exported bank reads chronologically
}

interface Persisted {
  overrides: Partial<Record<OneShotId, SoundPatch>>
  presets: SoundPreset[]
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(SOUNDLAB_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Persisted>) : {}
    const known = new Set<string>(ONE_SHOT_IDS)
    // Drop overrides/presets for sounds that no longer exist (cut gestures —
    // 'bed', 'streakMilestone' — linger in older banks).
    const overrides: Persisted['overrides'] = {}
    for (const [id, patch] of Object.entries(parsed.overrides ?? {})) {
      if (known.has(id) && patch) overrides[id as OneShotId] = patch
    }
    return {
      overrides,
      presets: (parsed.presets ?? []).filter(p => known.has(p.soundId)),
    }
  } catch {
    return { overrides: {}, presets: [] }
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
  /** Drop a sound's override — engine back to the shipped default. */
  resetSound: (id: OneShotId) => void
  resetAll: () => void
  /** Snapshot the sound's CURRENT knobs under a label. */
  savePreset: (soundId: OneShotId, label: string) => void
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
      const next: Persisted = { overrides: { ...s.overrides, [id]: patch }, presets: s.presets }
      save(next)
      return next
    })
  },

  resetSound: (id) => {
    sfx.resetPatch(id)
    set((s) => {
      const overrides = { ...s.overrides }
      delete overrides[id]
      const next: Persisted = { overrides, presets: s.presets }
      save(next)
      return next
    })
  },

  resetAll: () => {
    ONE_SHOT_IDS.forEach(id => sfx.resetPatch(id))
    set((s) => {
      const next: Persisted = { overrides: {}, presets: s.presets }
      save(next)
      return next
    })
  },

  savePreset: (soundId, label) => {
    const trimmed = label.trim()
    if (!trimmed) return
    const s = get()
    const data: SoundPatch = s.overrides[soundId] ?? sfx.getPatch(soundId)
    const preset: SoundPreset = { id: newId(), label: trimmed, soundId, data: JSON.parse(JSON.stringify(data)), savedAt: new Date().toISOString() }
    set((state) => {
      const next: Persisted = { overrides: state.overrides, presets: [...state.presets, preset] }
      save(next)
      return next
    })
  },

  applyPreset: (presetId) => {
    const preset = get().presets.find(p => p.id === presetId)
    if (!preset) return
    get().setPatch(preset.soundId, preset.data)
  },

  deletePreset: (presetId) => {
    set((s) => {
      const next: Persisted = { overrides: s.overrides, presets: s.presets.filter(p => p.id !== presetId) }
      save(next)
      return next
    })
  },

  exportJson: () => {
    const { overrides, presets } = get()
    return JSON.stringify({ overrides, presets }, null, 2)
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
}
