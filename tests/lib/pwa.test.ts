import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  INSTALL_DISMISS_KEY,
  isInstallDismissed,
  setInstallDismissed,
  isStandalone,
  isIOSSafari,
} from '../../src/lib/pwa'

const setUA = (ua: string) => {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
}
const setTouchPoints = (n: number) => {
  Object.defineProperty(navigator, 'maxTouchPoints', { value: n, configurable: true })
}

describe('pwa install helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('dismissal persistence', () => {
    it('starts undismissed', () => {
      expect(isInstallDismissed()).toBe(false)
    })

    it('persists a dismissal to localStorage under the versioned key', () => {
      setInstallDismissed()
      expect(localStorage.getItem(INSTALL_DISMISS_KEY)).toBe('1')
      expect(isInstallDismissed()).toBe(true)
    })

    it('swallows storage errors instead of throwing', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota')
      })
      expect(() => setInstallDismissed()).not.toThrow()
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      expect(isInstallDismissed()).toBe(false)
    })
  })

  describe('isStandalone', () => {
    it('is false in a normal browser tab', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
      expect(isStandalone()).toBe(false)
    })

    it('is true when display-mode is standalone', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
      expect(isStandalone()).toBe(true)
    })

    it('is true when iOS navigator.standalone is set', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
      Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true })
      expect(isStandalone()).toBe(true)
      Object.defineProperty(window.navigator, 'standalone', { value: undefined, configurable: true })
    })
  })

  describe('isIOSSafari', () => {
    it('detects an iPhone running Safari', () => {
      setUA(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      )
      expect(isIOSSafari()).toBe(true)
    })

    it('rejects Chrome on iOS (no Add to Home Screen there)', () => {
      setUA(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
      )
      expect(isIOSSafari()).toBe(false)
    })

    it('detects an iPadOS 13+ device masquerading as a Mac (touch points > 1)', () => {
      setUA(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      )
      setTouchPoints(5)
      expect(isIOSSafari()).toBe(true)
    })

    it('rejects a real desktop Mac (no touch)', () => {
      setUA(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      )
      setTouchPoints(0)
      expect(isIOSSafari()).toBe(false)
    })

    it('rejects Android Chrome (uses the native install prompt instead)', () => {
      setUA(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
      )
      setTouchPoints(5)
      expect(isIOSSafari()).toBe(false)
    })
  })
})
