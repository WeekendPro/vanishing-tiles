import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGameStore } from './store/gameStore'
import { useAsyncStatus } from './store/asyncStatus'

// Dev-only: expose the stores globally so smoke tests can drive the game and
// the async-loading overlay.
if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useGameStore }).__store = useGameStore
  ;(window as unknown as { __async: typeof useAsyncStatus }).__async = useAsyncStatus
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
