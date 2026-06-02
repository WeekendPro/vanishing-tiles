import { useAsyncStatus } from '../store/asyncStatus'
import { TrickleBar } from './TrickleBar'

/** App-root loading bar pinned to the top edge; reflects all tracked async work. */
export function GlobalLoadingBar() {
  const pending = useAsyncStatus(s => s.pending)
  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <TrickleBar active={pending > 0} height="h-0.5" />
    </div>
  )
}
