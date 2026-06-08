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

describe('level order + next level', () => {
  beforeEach(() => useNavStore.getState().reset())

  it('stores the ordered level ids', () => {
    useNavStore.getState().setLevelOrder(['a', 'b', 'c'])
    expect(useNavStore.getState().levelOrder).toEqual(['a', 'b', 'c'])
  })

  it('goNextLevel opens the following level, no-op at the end', () => {
    const nav = useNavStore.getState()
    nav.setLevelOrder(['a', 'b', 'c'])
    nav.openLevel('b')
    nav.goNextLevel()
    expect(useNavStore.getState().selectedLevelId).toBe('c')
    expect(useNavStore.getState().appView).toBe('levelDetail')
    nav.goNextLevel() // already at last → stays
    expect(useNavStore.getState().selectedLevelId).toBe('c')
  })

  it('hasNextLevel reflects position', () => {
    const nav = useNavStore.getState()
    nav.setLevelOrder(['a', 'b'])
    nav.openLevel('a')
    expect(useNavStore.getState().hasNextLevel()).toBe(true)
    nav.openLevel('b')
    expect(useNavStore.getState().hasNextLevel()).toBe(false)
  })
})
