import { useEffect } from 'react'
import { useShallow } from 'zustand/shallow'
import { getSession } from './lib/auth'
import { useNavStore } from './store/navStore'
import { AuthScreen } from './components/AuthScreen'
import { JourneyScreen } from './components/JourneyScreen'
import { LevelDetailScreen } from './components/LevelDetailScreen'
import { ResultsScreen } from './components/ResultsScreen'
import { GameShell } from './components/GameShell'
import { GlobalLoadingBar } from './components/GlobalLoadingBar'

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
      case 'levelDetail':
        return <><JourneyScreen /><LevelDetailScreen /></>
      case 'results': return <ResultsScreen />
      case 'playing':
      case 'practice':
        return <GameShell />
      default: return <AuthScreen />
    }
  })()

  return (
    <>
      <GlobalLoadingBar />
      {view}
    </>
  )
}
