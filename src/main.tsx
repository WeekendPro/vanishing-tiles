import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGameStore } from './store/gameStore'

// Dev-only: expose the store globally so smoke tests can drive the game.
if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useGameStore }).__store = useGameStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
