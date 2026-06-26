import { describe, it, expect, beforeEach } from 'vitest'
import {
  useStaggerSandboxPresetStore,
  SANDBOX_PRESET_STORAGE_KEY,
} from '../../src/store/staggerSandboxPresetStore'
import { NO_OVERRIDES, type SandboxOverrides } from '../../src/lib/staggerMechanic'

const ov = (patch: Partial<SandboxOverrides>): SandboxOverrides => ({ ...NO_OVERRIDES, ...patch })
const store = () => useStaggerSandboxPresetStore.getState()

beforeEach(() => {
  localStorage.clear()
  useStaggerSandboxPresetStore.setState({ presets: {} })
})

describe('staggerSandboxPresetStore', () => {
  it('starts with no presets', () => {
    expect(store().presets).toEqual({})
  })

  it('savePreset stores a named preset under its level', () => {
    store().savePreset('twins', 'Fast pairs', ov({ pairs: 4, revealStepMs: 600 }))
    const list = store().presets.twins!
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Fast pairs')
    expect(list[0].overrides.pairs).toBe(4)
    expect(list[0].overrides.revealStepMs).toBe(600)
  })

  it('upserts by name (case-insensitive, trimmed) instead of duplicating', () => {
    store().savePreset('twins', 'Fast pairs', ov({ pairs: 4 }))
    store().savePreset('twins', '  fast PAIRS ', ov({ pairs: 2 }))
    const list = store().presets.twins!
    expect(list).toHaveLength(1) // matched case-insensitively, not duplicated
    expect(list[0].name).toBe('fast PAIRS') // trimmed; the just-typed name wins
    expect(list[0].overrides.pairs).toBe(2) // overwritten
  })

  it('normalizes stored overrides to the full shape (missing keys → null)', () => {
    store().savePreset('twins', 'Sparse', { pairs: 1 } as SandboxOverrides)
    expect(store().presets.twins![0].overrides).toEqual(ov({ pairs: 1 }))
  })

  it('keeps presets isolated per level', () => {
    store().savePreset('twins', 'A', ov({ pairs: 3 }))
    store().savePreset('solos', 'B', ov({ gapCount: 5 }))
    expect(store().presets.twins!.map(p => p.name)).toEqual(['A'])
    expect(store().presets.solos!.map(p => p.name)).toEqual(['B'])
  })

  it('deletePreset removes only the named preset for that level', () => {
    store().savePreset('twins', 'A', ov({ pairs: 3 }))
    store().savePreset('twins', 'B', ov({ pairs: 1 }))
    store().deletePreset('twins', 'A')
    expect(store().presets.twins!.map(p => p.name)).toEqual(['B'])
  })

  it('persists to localStorage', () => {
    store().savePreset('twins', 'A', ov({ pairs: 3 }))
    const raw = localStorage.getItem(SANDBOX_PRESET_STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).twins[0].name).toBe('A')
  })
})
