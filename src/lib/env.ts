/**
 * Tiny env-gate helper: is this a dev/preview build where dev-only UI
 * should be shown? True in local dev and on Vercel preview/production
 * deployments under the default `*.vercel.app` domain; false on the
 * production custom domain (and in any other unrecognized host).
 */
export function isSandboxEnv(): boolean {
  if (import.meta.env.DEV) return true
  if (typeof location === 'undefined') return false
  return location.hostname.endsWith('.vercel.app')
}
