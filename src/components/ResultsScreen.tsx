import { useShallow } from 'zustand/shallow'
import { useGameStore } from '../store/gameStore'
import { useNavStore } from '../store/navStore'
import { PILLAR_MAX } from '@shared/core/scoring'

const PILLARS: { key: keyof typeof PILLAR_MAX; label: string; color: string }[] = [
  { key: 'accuracy', label: 'Accuracy', color: 'bg-green-500' },
  { key: 'speed', label: 'Speed', color: 'bg-cyan-400' },
  { key: 'efficiency', label: 'Efficiency', color: 'bg-purple-400' },
  { key: 'attempts', label: 'Attempts', color: 'bg-amber-400' },
]

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">{value} / {max}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function ResultsScreen() {
  const { journeyResult, priorPr, retryJourney } = useGameStore(useShallow(s => ({
    journeyResult: s.journeyResult,
    priorPr: s.priorPr,
    retryJourney: s.retryJourney,
  })))
  const { enterPlaying, backToMap } = useNavStore(useShallow(s => ({
    enterPlaying: s.enterPlaying,
    backToMap: s.backToMap,
  })))

  if (!journeyResult) return null
  const { attempt, session_status } = journeyResult
  const isClear = attempt.solved
  const prBreak = isClear && attempt.total > priorPr
  const canRetry = session_status === 'active'

  const tryAgain = () => { retryJourney(); enterPlaying() }

  return (
    <div className="min-h-dvh bg-gray-950 text-white flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold mb-1">
            {isClear ? 'Cleared!' : session_status === 'exhausted' ? 'Out of tries' : 'Missed it'}
          </div>
          <div className="text-2xl">
            {[0, 1, 2].map(i => (
              <span key={i} className={i < attempt.stars ? 'text-yellow-400' : 'text-gray-700'}>★</span>
            ))}
          </div>
          {prBreak && <div className="text-yellow-300 font-bold mt-2">🎉 New PR — {attempt.total}!</div>}
          {!isClear && (
            <div className="text-gray-400 text-sm mt-2">Coverage {Math.round(attempt.coverage * 100)}%</div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
          {PILLARS.map(p => (
            <Bar key={p.key} label={p.label} value={attempt.pillars[p.key]} max={PILLAR_MAX[p.key]} color={p.color} />
          ))}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-800 mt-2">
            <span>Total</span><span className="text-yellow-400">{attempt.total}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {canRetry && (
            <button onClick={tryAgain}
              className="w-full py-3 rounded-xl font-bold bg-blue-700 hover:bg-blue-600">Try Again ↺</button>
          )}
          <button onClick={backToMap}
            className="w-full py-3 rounded-xl font-bold bg-gray-800 hover:bg-gray-700 border border-gray-600">
            Back to Map
          </button>
        </div>
      </div>
    </div>
  )
}
