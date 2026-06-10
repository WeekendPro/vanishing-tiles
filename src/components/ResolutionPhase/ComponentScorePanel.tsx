import { ArcadePanel } from '../ui'
// (temporary until ComponentScorePanel is removed in a later task)
const LIVES_TOTAL = 3, LIFE_VALUE = 20

export function ComponentScorePanel({
  show, componentLabel, solved, livesLost, componentTotal, levelTotal, stars,
}: {
  show: boolean
  componentLabel: string
  solved: boolean
  livesLost: number
  componentTotal: number
  levelTotal: number
  stars: number
}) {
  const base = solved ? LIFE_VALUE * (LIVES_TOTAL - Math.min(2, livesLost)) : 0
  const speed = Math.max(0, componentTotal - base)
  return (
    <ArcadePanel className={`p-4 w-full transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-neon-cyan">{componentLabel}</span>
        <span className="font-pixel text-base tabular-nums text-white">{componentTotal}</span>
      </div>
      {solved && (
        <>
          <Row label="Completion" value={base} />
          <Row label="Speed" value={speed} />
        </>
      )}
      <div className="flex justify-between items-baseline mt-3 pt-2 border-t border-arcade-edge">
        <span className="font-pixel text-[9px] uppercase tracking-[0.1em] text-neon-yellow">Level Total</span>
        <span className="font-pixel text-[11px] tabular-nums text-neon-yellow text-glow-yellow">{levelTotal} / 500</span>
      </div>
      <div className="text-center text-xl mt-2">
        {[0, 1, 2, 3, 4].map(i => (
          <span key={i} data-star className={i < stars ? 'text-neon-yellow text-glow-yellow' : 'text-arcade-edge'}>★</span>
        ))}
      </div>
    </ArcadePanel>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-baseline mb-1">
      <span className="font-pixel text-[9px] uppercase tracking-[0.1em] text-gray-400">{label}</span>
      <span className="font-pixel text-[11px] tabular-nums text-white">{value}</span>
    </div>
  )
}
