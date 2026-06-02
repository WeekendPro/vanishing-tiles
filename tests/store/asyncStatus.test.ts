import { describe, it, expect, beforeEach } from 'vitest'
import { useAsyncStatus, track } from '../../src/store/asyncStatus'

beforeEach(() => {
  useAsyncStatus.setState({ pending: 0 })
})

describe('useAsyncStatus', () => {
  it('starts with no pending work', () => {
    expect(useAsyncStatus.getState().pending).toBe(0)
  })

  it('start/done increment and decrement the counter', () => {
    useAsyncStatus.getState().start()
    expect(useAsyncStatus.getState().pending).toBe(1)
    useAsyncStatus.getState().done()
    expect(useAsyncStatus.getState().pending).toBe(0)
  })

  it('done never drops below zero', () => {
    useAsyncStatus.getState().done()
    expect(useAsyncStatus.getState().pending).toBe(0)
  })
})

describe('track', () => {
  it('resolves with the promise value and clears pending', async () => {
    const result = await track(Promise.resolve('ok'))
    expect(result).toBe('ok')
    expect(useAsyncStatus.getState().pending).toBe(0)
  })

  it('decrements even when the tracked promise rejects', async () => {
    await expect(track(Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    expect(useAsyncStatus.getState().pending).toBe(0)
  })

  it('stays pending until all overlapping promises settle', async () => {
    let resolveA!: () => void
    let resolveB!: () => void
    const ta = track(new Promise<void>(r => { resolveA = r }))
    const tb = track(new Promise<void>(r => { resolveB = r }))
    expect(useAsyncStatus.getState().pending).toBe(2)
    resolveA(); await ta
    expect(useAsyncStatus.getState().pending).toBe(1)
    resolveB(); await tb
    expect(useAsyncStatus.getState().pending).toBe(0)
  })
})
