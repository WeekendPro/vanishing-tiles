import { describe, it, expect, afterEach } from 'vitest'
import { isSandboxEnv } from '../../src/lib/env'

function setHostname(hostname: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, hostname },
    writable: true,
    configurable: true,
  })
}

describe('isSandboxEnv', () => {
  const originalLocation = window.location

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
    import.meta.env.DEV = false
  })

  it('is true in dev (import.meta.env.DEV)', () => {
    import.meta.env.DEV = true
    setHostname('vanishingtiles.com')
    expect(isSandboxEnv()).toBe(true)
  })

  it('is true on a *.vercel.app preview host (non-dev)', () => {
    import.meta.env.DEV = false
    setHostname('puzzle-game-abc123.vercel.app')
    expect(isSandboxEnv()).toBe(true)
  })

  it('is false on the production custom domain (non-dev)', () => {
    import.meta.env.DEV = false
    setHostname('vanishingtiles.com')
    expect(isSandboxEnv()).toBe(false)
  })
})
