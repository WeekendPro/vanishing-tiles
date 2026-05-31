import { describe, it, expect, beforeEach } from 'vitest'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  useNavStore.getState().reset()
})

describe('navStore', () => {
  it('starts on the auth view with no selected level', () => {
    const s = useNavStore.getState()
    expect(s.appView).toBe('auth')
    expect(s.selectedLevelId).toBeNull()
  })

  it('goJourney moves to the journey view', () => {
    useNavStore.getState().goJourney()
    expect(useNavStore.getState().appView).toBe('journey')
  })

  it('openLevel records the level id and shows the detail sheet', () => {
    useNavStore.getState().openLevel('lvl-7')
    const s = useNavStore.getState()
    expect(s.appView).toBe('levelDetail')
    expect(s.selectedLevelId).toBe('lvl-7')
  })

  it('enterPlaying, showResults, and backToMap drive the play→results→map loop', () => {
    const s = useNavStore.getState()
    s.openLevel('lvl-7')
    s.enterPlaying()
    expect(useNavStore.getState().appView).toBe('playing')
    s.showResults()
    expect(useNavStore.getState().appView).toBe('results')
    s.backToMap()
    expect(useNavStore.getState().appView).toBe('journey')
  })

  it('goPractice enters the practice view; goAuth returns to auth', () => {
    useNavStore.getState().goPractice()
    expect(useNavStore.getState().appView).toBe('practice')
    useNavStore.getState().goAuth()
    expect(useNavStore.getState().appView).toBe('auth')
  })
})
