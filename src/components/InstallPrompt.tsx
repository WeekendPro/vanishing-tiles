import { useEffect, useState } from 'react'
import {
  isStandalone,
  isIOSSafari,
  isInstallDismissed,
  setInstallDismissed,
  type BeforeInstallPromptEvent,
} from '../lib/pwa'

/**
 * A low-key, dismissible "install this game" nudge that appears once at the
 * top of the app. Two flavours:
 *
 *  - Chrome / Android / desktop Chromium: captures the `beforeinstallprompt`
 *    event and offers an INSTALL button that fires the browser's native
 *    install dialog.
 *  - iOS Safari: has no such API, so it shows the manual
 *    "Share → Add to Home Screen" instruction instead.
 *
 * It never shows when already running standalone (installed), and once
 * dismissed (or installed) it stays hidden via localStorage. Rendered only on
 * non-gameplay screens (see App.tsx) so it can't overlap the in-run HUD.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isStandalone() || isInstallDismissed()) return

    const onBeforeInstall = (e: Event) => {
      // Stop Chrome's own mini-infobar; we drive the install from our button.
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    const onInstalled = () => {
      setInstallDismissed()
      setDeferredPrompt(null)
      setShowIOSHint(false)
      setDismissed(true)
    }
    window.addEventListener('appinstalled', onInstalled)

    // iOS Safari never fires beforeinstallprompt — show the manual hint.
    if (isIOSSafari()) setShowIOSHint(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    setInstallDismissed()
    setDismissed(true)
  }

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    // Whatever the user chooses, don't nag again — an accept installs it, a
    // decline is an answer we respect.
    await deferredPrompt.userChoice.catch(() => undefined)
    setInstallDismissed()
    setDeferredPrompt(null)
    setDismissed(true)
  }

  const visible = !dismissed && (deferredPrompt !== null || showIOSHint)
  if (!visible) return null

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex justify-center pl-3 pr-14 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div
        role="dialog"
        aria-label="Install Vanishing Tiles"
        className="w-full max-w-sm flex items-center gap-3 rounded-lg border border-vt-edge
          bg-vt-panel/95 px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur"
      >
        <img src="/icons/icon-192.png" alt="" aria-hidden="true" className="h-9 w-9 rounded-md" />

        <div className="min-w-0 flex-1">
          {deferredPrompt ? (
            <p className="text-[12px] leading-snug text-vt-text font-display">
              Install <span className="font-semibold text-vt-cyan">Vanishing Tiles</span> for
              full-screen, offline play.
            </p>
          ) : (
            <p className="text-[12px] leading-snug text-vt-text font-display">
              Install: tap{' '}
              <span aria-label="the Share button" className="text-vt-cyan">Share&nbsp;↑</span> then{' '}
              <span className="font-semibold text-vt-cyan">Add to Home Screen</span>.
            </p>
          )}
        </div>

        {deferredPrompt && (
          <button
            onClick={install}
            className="shrink-0 rounded-md border border-vt-cyan px-3 py-1.5 font-pixel text-[11px]
              uppercase tracking-[0.06em] text-vt-cyan transition hover:bg-vt-cyan/10 active:translate-y-px"
          >
            Install
          </button>
        )}

        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="shrink-0 rounded-md px-2 py-1 text-vt-dim transition hover:text-vt-text"
        >
          <span aria-hidden="true" className="text-lg leading-none">×</span>
        </button>
      </div>
    </div>
  )
}
