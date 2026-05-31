import { describe, it, expect } from 'vitest'
import { PROVIDERS_ENABLED } from '../../src/lib/config'

describe('client config', () => {
  it('ships with OAuth providers gated off by default', () => {
    expect(PROVIDERS_ENABLED).toBe(false)
  })
})
