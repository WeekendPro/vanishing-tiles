import { useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { getSession } from './lib/auth'
import { useNavStore } from './store/navStore'
import { routeAfterAuth } from './store/profileStore'
import { AuthScreen } from './components/AuthScreen'
import { ClaimNameScreen } from './components/ClaimNameScreen'
import { HomeScreen } from './components/HomeScreen'
import { StaggerScreen } from './components/StaggerScreen'
import { TrainingScreen } from './components/TrainingScreen'
import { LeaderboardScreen } from './components/LeaderboardScreen'
import { SoundDesignScreen } from './components/SoundDesignScreen'
import { GlobalLoadingOverlay } from './components/GlobalLoadingOverlay'
import { GlobalMenu } from './components/GlobalMenu'
import { InstallPrompt } from './components/InstallPrompt'

export default function App() {
  const appView = useNavStore(s => s.appView)
  const goAuth = useNavStore(s => s.goAuth)

  useEffect(() => {
    let cancelled = false
    getSession()
      .then(({ data }) => {
        if (cancelled) return
        // routeAfterAuth is the one post-auth router: named → home,
        // unnamed non-guest → the claim gate, guests → home.
        if (data?.session) void routeAfterAuth()
        else goAuth()
      })
      .catch(() => { if (!cancelled) goAuth() })
    return () => { cancelled = true }
  }, [goAuth])

  const view = (() => {
    switch (appView) {
      case 'auth': return <AuthScreen />
      case 'claimName': return <ClaimNameScreen />
      case 'home': return <HomeScreen />
      case 'stagger': return <StaggerScreen />
      case 'training': return <TrainingScreen />
      case 'leaderboard': return <LeaderboardScreen />
      case 'soundDesign': return <SoundDesignScreen />
      default: return <AuthScreen />
    }
  })()

  // The Infinite Stagger and Training layouts own their own Pause/Exit
  // controls, so the global menu is suppressed there (and on the auth screen
  // and the claim-name gate — nowhere to navigate until the name exists).
  const showMenu = appView !== 'auth' && appView !== 'claimName'
    && appView !== 'stagger' && appView !== 'training'

  return (
    <>
      {/* Virtual page views: this is a single-URL SPA, so feed the active view
          as the route/path. The @vercel/analytics/react component disables URL
          auto-tracking when given `route` and fires a fresh page view on each
          change — turning every screen (home/stagger/leaderboard/…) into its
          own "page" in the dashboard without any router. */}
      <Analytics route={appView} path={`/${appView}`} />
      <GlobalLoadingOverlay />
      {view}
      {showMenu && <GlobalMenu />}
      {/* Dismissible PWA install nudge — only on non-gameplay screens so it
          never overlaps the in-run HUD (same gate as the global menu). */}
      {showMenu && <InstallPrompt />}
    </>
  )
}
