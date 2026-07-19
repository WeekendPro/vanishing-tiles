/**
 * PWA install helpers — small, pure, and side-effect-free so the install
 * prompt's logic (dismissal persistence, platform detection) is unit-testable
 * without a real browser. The actual `beforeinstallprompt` wiring lives in
 * `components/InstallPrompt.tsx`.
 */

/** localStorage flag: once the user dismisses (or completes) the install
 *  nudge, we don't pester them again. Versioned so a future redesign can reset. */
export const INSTALL_DISMISS_KEY = 'vt:pwa-install-dismissed:v1'

/** The non-standard event Chromium fires when the app is installable. Not in
 *  the DOM lib types, so we describe the shape we use. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

/** True when the app is already running as an installed standalone app
 *  (Android/desktop `display-mode: standalone`, or iOS Safari `navigator.standalone`).
 *  In that case there's nothing to prompt. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const displayModeStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  // iOS Safari exposes this legacy flag instead of matching the media query.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return displayModeStandalone || iosStandalone
}

/** True on iOS/iPadOS Safari, which has no `beforeinstallprompt` API — the
 *  only install path there is the manual Share → Add to Home Screen flow, so
 *  we detect it to show text instructions instead of a native-install button.
 *  Excludes in-app browsers (Chrome/Firefox/etc. on iOS) which can't A2HS. */
export function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOSDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports a Mac UA; disambiguate via touch support.
    (ua.includes('Macintosh') && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1)
  if (!isIOSDevice) return false
  // Real Safari, not Chrome (CriOS) / Firefox (FxiOS) / Edge (EdgiOS) on iOS.
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return isSafari
}

/** Whether the user has already dismissed (or completed) the install nudge. */
export function isInstallDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** Persist that the install nudge should stay hidden from now on. */
export function setInstallDismissed(): void {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, '1')
  } catch {
    // Private-mode / storage-disabled: worst case the banner reappears next
    // load. Not worth surfacing an error over.
  }
}
