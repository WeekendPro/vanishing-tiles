import { useShallow } from 'zustand/shallow'
import { useGameStore } from '../store/gameStore'
import { useNavStore } from '../store/navStore'
import { PILLAR_MAX } from '@shared/core/scoring'
import { NeonButton, ArcadePanel } from './ui'

const PILLARS: { key: keyof typeof PILLAR_MAX; label: string; color: string }[] = [
  { key: 'accuracy', label: 'Accuracy', color: 'bg-neon-green shadow-neon-green' },
  { key: 'speed', label: 'Speed', color: 'bg-neon-cyan shadow-neon-cyan' },
  { key: 'efficiency', label: 'Efficiency', color: 'bg-neon-magenta shadow-neon-magenta' },
  { key: 'attempts', label: 'Attempts', color: 'bg-neon-yellow' },
]

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="font-pixel text-[9px] uppercase tracking-[0.1em] text-neon-cyan">{label}</span>
        <span className="font-pixel text-[9px] text-gray-400">{value} / {max}</span>
      </div>
      <div className="h-2 rounded-full bg-arcade-well overflow-hidden">
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
  // A failed attempt that still covered every gap can only mean the player
  // picked the right pieces PLUS extras — a clear needs the EXACT pieces.
  const overSelected = !isClear && attempt.coverage >= 1

  const tryAgain = () => { retryJourney(); enterPlaying() }

  return (
    <div className="min-h-dvh bg-arcade-bg text-white flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="font-pixel text-xl uppercase tracking-[0.08em] text-neon-cyan text-glow-cyan mb-1">
            {isClear ? 'Cleared!'
              : session_status === 'exhausted' ? 'Out of tries'
              : overSelected ? 'Too many pieces'
              : 'Missed it'}
          </div>
          <div className="text-2xl">
            {[0, 1, 2].map(i => (
              <span key={i} className={i < attempt.stars ? 'text-neon-yellow text-glow-yellow' : 'text-arcade-edge'}>★</span>
            ))}
          </div>
          {prBreak && <div className="font-pixel text-[10px] uppercase tracking-[0.08em] text-neon-yellow text-glow-yellow mt-2">🎉 New PR — {attempt.total}!</div>}
          {!isClear && (
            overSelected
              ? <div className="text-gray-400 text-sm mt-2">Every gap was covered — but you picked extra pieces. Choose the exact pieces that fit, nothing spare.</div>
              : <div className="text-gray-400 text-sm mt-2">Coverage {Math.round(attempt.coverage * 100)}%</div>
          )}
        </div>

        <ArcadePanel className="p-4 mb-6">
          {PILLARS.map(p => (
            <Bar key={p.key} label={p.label} value={attempt.pillars[p.key]} max={PILLAR_MAX[p.key]} color={p.color} />
          ))}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-arcade-edge mt-2">
            <span className="font-pixel text-[10px] uppercase tracking-[0.1em]">Total</span><span className="font-pixel text-neon-yellow text-glow-yellow">{attempt.total}</span>
          </div>
        </ArcadePanel>

        <div className="flex flex-col gap-3">
          {canRetry && (
            <NeonButton fullWidth variant="primary" onClick={tryAgain}>Try Again ↺</NeonButton>
          )}
          <NeonButton fullWidth variant="ghost" onClick={backToMap}>Back to Map</NeonButton>
        </div>
      </div>
    </div>
  )
}
