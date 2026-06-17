import { useEffect } from 'react'
import { useShallow } from 'zustand/shallow'
import { getSession } from './lib/auth'
import { useNavStore } from './store/navStore'
import { AuthScreen } from './components/AuthScreen'
import { JourneyScreen } from './components/JourneyScreen'
import { LevelScreen } from './components/LevelScreen'
import { ResultsScreen } from './components/ResultsScreen'
import { GameShell } from './components/GameShell'
import { StaggerScreen } from './components/StaggerScreen'
import { GlobalLoadingOverlay } from './components/GlobalLoadingOverlay'
import { GlobalMenu } from './components/GlobalMenu'

export default function App() {
  const { appView, goAuth, goJourney } = useNavStore(useShallow(s => ({
    appView: s.appView,
    goAuth: s.goAuth,
    goJourney: s.goJourney,
  })))

  useEffect(() => {
    let cancelled = false
    getSession()
      .then(({ data }) => {
        if (cancelled) return
        if (data?.session) goJourney()
        else goAuth()
      })
      .catch(() => { if (!cancelled) goAuth() })
    return () => { cancelled = true }
  }, [goAuth, goJourney])

  const view = (() => {
    switch (appView) {
      case 'auth': return <AuthScreen />
      case 'journey': return <JourneyScreen />
      case 'levelDetail': return <LevelScreen />
      case 'results': return <ResultsScreen />
      case 'stagger': return <StaggerScreen />
      case 'playing':
      case 'practice':
        return <GameShell />
      default: return <AuthScreen />
    }
  })()

  return (
    <>
      <GlobalLoadingOverlay />
      {view}
      {appView !== 'auth' && <GlobalMenu />}
    </>
  )
}
