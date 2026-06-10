import { useAsyncStatus } from '../store/asyncStatus'
import { ArcadeLoader } from './ArcadeLoader'

/**
 * App-root arcade loading overlay; reflects all tracked async work on the
 * full-screen routes (auth, journey load, level load, start session). The
 * in-game answer submit shows its own full-screen ArcadeLoader from GameShell.
 */
export function GlobalLoadingOverlay() {
  const pending = useAsyncStatus(s => s.pending)
  return <ArcadeLoader active={pending > 0} />
}
