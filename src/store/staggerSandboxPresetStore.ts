import { create } from 'zustand'
import type { LevelKey } from '../lib/staggerLevels'
import { type SandboxOverrides, NO_OVERRIDES } from '../lib/staggerMechanic'

/**
 * Persisted, per-level named presets for the Infinite Stagger calibration
 * sandbox (dev/preview tooling). Each preset captures a full SandboxOverrides
 * snapshot under a free-text name, scoped to ONE level — TWINS presets never
 * appear in the SOLOS sandbox, etc. The live `sandboxOverrides` on staggerStore
 * stay ephemeral; this store is the separate, durable preset library you load
 * from / save to. Mirrors runHistoryStore's manual-localStorage pattern.
 */

export const SANDBOX_PRESET_STORAGE_KEY = 'gapcity:sandbox-presets:v1'

export interface SandboxPreset {
  name: string
  overrides: SandboxOverrides
}

/** Presets bucketed by level key (absent key = no presets saved for that level). */
export type SandboxPresetMap = Partial<Record<LevelKey, SandboxPreset[]>>

interface PresetStore {
  presets: SandboxPresetMap
  savePreset: (level: LevelKey, name: string, overrides: SandboxOverrides) => void  // upsert by trimmed, case-insensitive name
  deletePreset: (level: LevelKey, name: string) => void
}

function load(): SandboxPresetMap {
  try {
    const raw = localStorage.getItem(SANDBOX_PRESET_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SandboxPresetMap) : {}
  } catch {
    return {}
  }
}

function save(presets: SandboxPresetMap): void {
  try {
    localStorage.setItem(SANDBOX_PRESET_STORAGE_KEY, JSON.stringify(presets))
  } catch {
    /* ignore quota / unavailable storage */
  }
}

export const useStaggerSandboxPresetStore = create<PresetStore>((set) => ({
  presets: load(),

  savePreset: (level, name, overrides) => set((state) => {
    const trimmed = name.trim()
    if (!trimmed) return state
    // Normalize to the full overrides shape so older/partial snapshots round-trip.
    const preset: SandboxPreset = { name: trimmed, overrides: { ...NO_OVERRIDES, ...overrides } }
    const list = state.presets[level] ? [...state.presets[level]!] : []
    const i = list.findIndex(p => p.name.toLowerCase() === trimmed.toLowerCase())
    if (i >= 0) list[i] = preset
    else list.push(preset)
    const next = { ...state.presets, [level]: list }
    save(next)
    return { presets: next }
  }),

  deletePreset: (level, name) => set((state) => {
    const list = state.presets[level]
    if (!list) return state
    const filtered = list.filter(p => p.name.toLowerCase() !== name.trim().toLowerCase())
    const next = { ...state.presets, [level]: filtered }
    save(next)
    return { presets: next }
  }),
}))
