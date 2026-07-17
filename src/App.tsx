import { useEffect } from 'react'
import { getSession } from './lib/auth'
import { useNavStore } from './store/navStore'
import { routeAfterAuth } from './store/profileStore'
import { AuthScreen } from './components/AuthScreen'
import { ClaimNameScreen } from './components/ClaimNameScreen'
import { HomeScreen } from './components/HomeScreen'
import { JourneyScreen } from './components/JourneyScreen'
import { LevelScreen } from './components/LevelScreen'
import { ResultsScreen } from './components/ResultsScreen'
import { GameShell } from './components/GameShell'
import { StaggerScreen } from './components/StaggerScreen'
import { TrainingScreen } from './components/TrainingScreen'
import { LeaderboardScreen } from './components/LeaderboardScreen'
import { SoundDesignScreen } from './components/SoundDesignScreen'
import { GlobalLoadingOverlay } from './components/GlobalLoadingOverlay'
import { GlobalMenu } from './components/GlobalMenu'

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
      case 'journey': return <JourneyScreen />
      case 'levelDetail': return <LevelScreen />
      case 'results': return <ResultsScreen />
      case 'stagger': return <StaggerScreen />
      case 'training': return <TrainingScreen />
      case 'leaderboard': return <LeaderboardScreen />
      case 'soundDesign': return <SoundDesignScreen />
      case 'playing':
      case 'practice':
        return <GameShell />
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
      <GlobalLoadingOverlay />
      {view}
      {showMenu && <GlobalMenu />}
    </>
  )
}
