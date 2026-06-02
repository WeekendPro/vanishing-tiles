import { useEffect, useState } from 'react'

interface Props {
  /** Whether async work is in flight. */
  active: boolean
  /** Delay (ms) before the bar first paints, so fast calls never flash. */
  delay?: number
  /** Tailwind background class. */
  color?: string
  /** Tailwind height class (h-0.5 = 2px global bar, h-1.5 = 6px slot). */
  height?: string
  className?: string
}

/**
 * Indeterminate "trickle" progress bar. While active, eases toward ~90% and
 * parks; on completion snaps to 100%, fades, and unmounts. Pure view logic —
 * touches no game state. `progress === null` means "render nothing".
 */
export function TrickleBar({
  active,
  delay = 120,
  color = 'bg-cyan-400',
  height = 'h-0.5',
  className = '',
}: Props) {
  const [progress, setProgress] = useState<number | null>(null)

  useEffect(() => {
    if (active) {
      let interval: ReturnType<typeof setInterval>
      const show = setTimeout(() => {
        setProgress(0.08)
        interval = setInterval(() => {
          setProgress(p => (p == null ? p : p + (0.9 - p) * 0.12))
        }, 90)
      }, delay)
      return () => { clearTimeout(show); clearInterval(interval) }
    }
    // active === false: snap shown bars to 100%, then unmount after the fade.
    setProgress(p => (p == null ? null : 1))
    const hide = setTimeout(() => setProgress(null), 400)
    return () => clearTimeout(hide)
  }, [active, delay])

  if (progress == null) return null
  return (
    <div
      data-testid="trickle-bar"
      className={`${height} ${color} ${className} transition-[width,opacity] duration-200 ease-out`}
      style={{ width: `${Math.min(progress, 1) * 100}%`, opacity: progress >= 1 ? 0 : 1 }}
    />
  )
}
