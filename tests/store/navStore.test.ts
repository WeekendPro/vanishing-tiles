import { describe, it, expect, beforeEach } from 'vitest'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  useNavStore.getState().reset()
})

describe('navStore', () => {
  it('starts on the auth view', () => {
    expect(useNavStore.getState().appView).toBe('auth')
  })

  it('goHome / goAuth toggle between home and auth', () => {
    useNavStore.getState().goHome()
    expect(useNavStore.getState().appView).toBe('home')
    useNavStore.getState().goAuth()
    expect(useNavStore.getState().appView).toBe('auth')
  })

  it('goStagger enters the stagger view', () => {
    useNavStore.getState().goStagger()
    expect(useNavStore.getState().appView).toBe('stagger')
  })

  it('goTraining enters the training view', () => {
    useNavStore.getState().goTraining()
    expect(useNavStore.getState().appView).toBe('training')
  })

  it('goLeaderboard enters the leaderboard view', () => {
    useNavStore.getState().goLeaderboard()
    expect(useNavStore.getState().appView).toBe('leaderboard')
  })

  it('goSoundDesign / goClaimName reach their views', () => {
    useNavStore.getState().goSoundDesign()
    expect(useNavStore.getState().appView).toBe('soundDesign')
    useNavStore.getState().goClaimName()
    expect(useNavStore.getState().appView).toBe('claimName')
  })

  it('reset returns to the auth view', () => {
    useNavStore.getState().goHome()
    useNavStore.getState().reset()
    expect(useNavStore.getState().appView).toBe('auth')
  })

  it('goAuth carries an optional email prefill and clears it when omitted', () => {
    useNavStore.getState().goAuth('player@example.com')
    expect(useNavStore.getState().appView).toBe('auth')
    expect(useNavStore.getState().authPrefillEmail).toBe('player@example.com')
    // A plain goAuth (e.g. sign-out) must not resurrect a stale prefill.
    useNavStore.getState().goAuth()
    expect(useNavStore.getState().authPrefillEmail).toBeNull()
  })

  it('reset clears any pending email prefill', () => {
    useNavStore.getState().goAuth('player@example.com')
    useNavStore.getState().reset()
    expect(useNavStore.getState().authPrefillEmail).toBeNull()
  })
})
