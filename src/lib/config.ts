// Gate for real Apple/Google OAuth. The provider buttons on AuthScreen always
// render and are clickable; this flag only governs an optional "coming soon"
// affordance and never hides the buttons. Flip to true once real credentials land.
export const PROVIDERS_ENABLED = false

/**
 * Admin-only surfaces — the Sound Design lab and "Erase My Records" — render
 * ONLY for the developer running the app locally, never on a deployed build.
 * Vite sets import.meta.env.DEV true during `npm run dev` (which talks to the
 * local Supabase) and false in every production build, so this cleanly splits
 * the local admin session from the public app. The localhost-hostname check is
 * a belt-and-suspenders fallback for a locally-served preview build.
 */
export function isAdminEnv(): boolean {
  if (import.meta.env.DEV) return true
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
}
