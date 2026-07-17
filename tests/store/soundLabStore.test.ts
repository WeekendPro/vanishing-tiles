import { describe, it, expect, beforeEach } from 'vitest'
import { useSoundLabStore, SOUNDLAB_STORAGE_KEY } from '../../src/store/soundLabStore'
import { sfx, DEFAULT_PATCHES, type SoundPatch } from '../../src/lib/sfx'

// jsdom has no AudioContext, so the engine's playback side no-ops — but its
// patch registry is plain data and fully testable. The lab store's contract:
// overrides flow into the engine AND localStorage; presets are labeled
// snapshots that can round-trip back into the active knobs.

const TWEAK: SoundPatch = { layers: [{ kind: 'tone', freq: 777, dur: 0.3, gain: 0.2 }] }

beforeEach(() => {
  localStorage.clear()
  useSoundLabStore.setState({ overrides: {}, presets: [] })
  useSoundLabStore.getState().resetAll()
})

describe('soundLabStore', () => {
  it('setPatch applies to the engine and persists', () => {
    useSoundLabStore.getState().setPatch('batchClear', TWEAK)
    expect(sfx.getPatch('batchClear')).toEqual(TWEAK)
    const stored = JSON.parse(localStorage.getItem(SOUNDLAB_STORAGE_KEY)!)
    expect(stored.overrides.batchClear).toEqual(TWEAK)
  })

  it('resetSound drops the override and restores the shipped default', () => {
    useSoundLabStore.getState().setPatch('batchClear', TWEAK)
    useSoundLabStore.getState().resetSound('batchClear')
    expect(sfx.getPatch('batchClear')).toEqual(DEFAULT_PATCHES.batchClear)
    expect(useSoundLabStore.getState().overrides.batchClear).toBeUndefined()
  })

  it('savePreset snapshots current knobs (default when untweaked) with a label', () => {
    useSoundLabStore.getState().savePreset('gameOver', 'somber v1')
    const preset = useSoundLabStore.getState().presets[0]
    expect(preset.label).toBe('somber v1')
    expect(preset.soundId).toBe('gameOver')
    expect(preset.data).toEqual(DEFAULT_PATCHES.gameOver)
    // Unlabeled saves are rejected.
    useSoundLabStore.getState().savePreset('gameOver', '   ')
    expect(useSoundLabStore.getState().presets).toHaveLength(1)
  })

  it('applyPreset round-trips a saved sound back into the active knobs', () => {
    useSoundLabStore.getState().setPatch('bloom', TWEAK)
    useSoundLabStore.getState().savePreset('bloom', 'sharp shing')
    useSoundLabStore.getState().resetSound('bloom')
    expect(sfx.getPatch('bloom')).toEqual(DEFAULT_PATCHES.bloom)

    const id = useSoundLabStore.getState().presets[0].id
    useSoundLabStore.getState().applyPreset(id)
    expect(sfx.getPatch('bloom')).toEqual(TWEAK)
    expect(useSoundLabStore.getState().overrides.bloom).toEqual(TWEAK)
  })

  it('deletePreset removes it; exportJson carries labels for the design chat', () => {
    useSoundLabStore.getState().savePreset('uiTap', 'tick A')
    useSoundLabStore.getState().savePreset('uiTap', 'tick B')
    const [a] = useSoundLabStore.getState().presets
    useSoundLabStore.getState().deletePreset(a.id)
    expect(useSoundLabStore.getState().presets.map(p => p.label)).toEqual(['tick B'])
    expect(useSoundLabStore.getState().exportJson()).toContain('tick B')
  })
})
