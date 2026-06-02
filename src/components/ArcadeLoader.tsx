import { useEffect, useState } from 'react'

const SEGMENTS = 10

/**
 * Full-screen arcade loading overlay — a segmented cyan "power meter" that lights
 * up in a travelling sweep, with a pixel-font LOADING label and faint CRT
 * scanlines, over a dimmed scrim. Driven by `active`; waits `delay`ms before it
 * paints so sub-100ms calls never flash. Purely presentational (no store access).
 */
export function ArcadeLoader({ active, delay = 120 }: { active: boolean; delay?: number }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!active) {
      setShow(false)
      return
    }
    const t = setTimeout(() => setShow(true), delay)
    return () => clearTimeout(t)
  }, [active, delay])

  if (!show) return null

  return (
    <div
      data-testid="arcade-loader"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5"
      style={{
        background:
          'radial-gradient(120% 80% at 50% 50%, rgba(3,7,18,0.72), rgba(3,7,18,0.94))',
      }}
    >
      <div
        className="flex gap-[5px] p-[7px] rounded-md border-2"
        style={{
          borderColor: '#0e2b33',
          background: '#060d12',
          boxShadow: 'inset 0 0 14px rgba(0,0,0,0.6)',
        }}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className="arcade-seg block w-[14px] h-[30px] rounded-[2px]"
            style={{ backgroundColor: '#0c1f25', animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>

      <div
        className="font-pixel text-[11px] tracking-[0.06em] text-cyan-300"
        style={{ textShadow: '0 0 8px rgba(34,211,238,0.6)' }}
      >
        LOADING
      </div>

      <div className="absolute inset-0 arcade-scanlines opacity-20" aria-hidden />
    </div>
  )
}
