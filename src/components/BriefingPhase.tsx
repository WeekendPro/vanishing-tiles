import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { COMPONENT_LABEL, isPlayable } from '../lib/components'
import { BRIEFING_OBJECTIVE } from '../lib/briefingCopy'
import { HowToAnimation } from './briefing/HowToAnimation'

export function BriefingPhase() {
  const { activeComponent, beginCountdown } = useGameStore(useShallow(s => ({
    activeComponent: s.activeComponent,
    beginCountdown: s.beginCountdown,
  })))

  // Riddle isn't reachable (not playable); render nothing rather than guess.
  if (!activeComponent || !isPlayable(activeComponent)) return null

  const title = COMPONENT_LABEL[activeComponent].toUpperCase()
  const objective = BRIEFING_OBJECTIVE[activeComponent]

  return (
    <div className="flex flex-col items-center text-center gap-5 w-full max-w-[360px]">
      <h2 className="font-pixel text-[15px] text-neon-cyan text-glow-cyan tracking-wide">{title}</h2>
      <p className="text-zinc-300 text-[15px] leading-relaxed max-w-[300px]">{objective}</p>

      <div className="text-[9px] font-pixel tracking-[0.2em] text-zinc-500">HOW IT WORKS</div>
      <div className="rounded-xl border border-arcade-edge bg-arcade-panel shadow-panel-inset p-5">
        <HowToAnimation component={activeComponent} />
      </div>

      <div className="inline-flex flex-col items-stretch w-full">
        <button
          data-testid="briefing-play"
          onClick={beginCountdown}
          className="font-pixel text-[15px] tracking-[0.15em] text-white rounded-2xl py-5 w-full transition active:translate-y-px"
          style={{
            background: 'linear-gradient(135deg,#22d3ee,#2563eb)',
            boxShadow: '0 0 22px rgba(34,211,238,.55), inset 0 2px 0 rgba(255,255,255,.35), inset 0 -3px 0 rgba(0,0,0,.25)',
          }}
        >
          PLAY
        </button>
        <div className="text-zinc-600 text-[11px] mt-3">3 lives · Play starts the countdown</div>
      </div>
    </div>
  )
}
