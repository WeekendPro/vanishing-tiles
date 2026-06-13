// STUB — replaced by Agent B with the dense dendrite-bloom ("Mental Map (Complex)") renderer.
// Contract: accepts JourneyMapProps; flatten with flattenJourney() from ./brainModel.
import type { JourneyMapProps } from './types'
import { flattenJourney } from './brainModel'

export function MentalMapComplex({ themes, onSelect }: JourneyMapProps) {
  const model = flattenJourney(themes)
  return (
    <div className="relative mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <div className="font-pixel text-sm text-neon-magenta text-glow-magenta">Mental Map (Complex)</div>
      <p className="text-xs text-gray-400">Dendrite bloom — coming up.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        {model.nodes.map((n) => (
          <button
            key={n.levelId}
            onClick={() => onSelect(n.levelId, n.locked)}
            className={`h-3 w-3 rounded-full border ${
              n.state === 'cleared'
                ? 'border-neon-magenta bg-neon-magenta'
                : n.state === 'next'
                ? 'border-white bg-white'
                : 'border-gray-600'
            }`}
            aria-label={n.name}
          />
        ))}
      </div>
    </div>
  )
}
