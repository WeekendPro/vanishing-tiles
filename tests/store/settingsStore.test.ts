import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore, SETTINGS_STORAGE_KEY } from '../../src/store/settingsStore'
import { sfx } from '../../src/lib/sfx'
import { haptics } from '../../src/lib/haptics'

beforeEach(() => {
  localStorage.clear()
  useSettingsStore.setState({ settings: { difficulty: 'easy', soundEnabled: true, sfxVolume: 1, hapticsEnabled: true, hideDemo: false } })
  sfx.setEnabled(true)
  haptics.setEnabled(true)
})

describe('settingsStore', () => {
  it('setDifficulty updates the tier and persists to localStorage', () => {
    expect(useSettingsStore.getState().settings.difficulty).toBe('easy')
    useSettingsStore.getState().setDifficulty('hard')
    expect(useSettingsStore.getState().settings.difficulty).toBe('hard')
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)
    expect(stored.difficulty).toBe('hard')
  })

  it('sound defaults to on', () => {
    expect(useSettingsStore.getState().settings.soundEnabled).toBe(true)
  })

  it('setSoundEnabled persists and drives the sfx engine mute', () => {
    useSettingsStore.getState().setSoundEnabled(false)
    expect(useSettingsStore.getState().settings.soundEnabled).toBe(false)
    expect(sfx.isEnabled()).toBe(false)
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)
    expect(stored.soundEnabled).toBe(false)

    useSettingsStore.getState().setSoundEnabled(true)
    expect(sfx.isEnabled()).toBe(true)
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!).soundEnabled).toBe(true)
  })

  it('SFX volume defaults to full and persists via its setter', () => {
    expect(useSettingsStore.getState().settings.sfxVolume).toBe(1)
    useSettingsStore.getState().setSfxVolume(0.4)
    expect(useSettingsStore.getState().settings.sfxVolume).toBe(0.4)
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)
    expect(stored.sfxVolume).toBe(0.4)
  })

  it('haptics defaults to on', () => {
    expect(useSettingsStore.getState().settings.hapticsEnabled).toBe(true)
  })

  it('setHapticsEnabled persists and drives the haptics engine mute', () => {
    useSettingsStore.getState().setHapticsEnabled(false)
    expect(useSettingsStore.getState().settings.hapticsEnabled).toBe(false)
    expect(haptics.isEnabled()).toBe(false)
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)
    expect(stored.hapticsEnabled).toBe(false)

    useSettingsStore.getState().setHapticsEnabled(true)
    expect(haptics.isEnabled()).toBe(true)
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!).hapticsEnabled).toBe(true)
  })
})
