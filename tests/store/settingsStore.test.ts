import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore, SETTINGS_STORAGE_KEY } from '../../src/store/settingsStore'
import { sfx } from '../../src/lib/sfx'

beforeEach(() => {
  localStorage.clear()
  useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'transit', difficulty: 'easy', soundEnabled: true } })
  sfx.setEnabled(true)
})

describe('settingsStore', () => {
  it('defaults to not hiding any briefing', () => {
    expect(useSettingsStore.getState().isBriefingHidden('main')).toBe(false)
    expect(useSettingsStore.getState().isBriefingHidden('colors')).toBe(false)
  })

  it('setBriefingHidden toggles per component and persists to localStorage', () => {
    useSettingsStore.getState().setBriefingHidden('colors', true)
    expect(useSettingsStore.getState().isBriefingHidden('colors')).toBe(true)
    // other components are unaffected
    expect(useSettingsStore.getState().isBriefingHidden('main')).toBe(false)
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)
    expect(stored.hideBriefing.colors).toBe(true)
  })

  it('can be turned back off', () => {
    useSettingsStore.getState().setBriefingHidden('flash', true)
    useSettingsStore.getState().setBriefingHidden('flash', false)
    expect(useSettingsStore.getState().isBriefingHidden('flash')).toBe(false)
  })

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
})
