import { useEffect, useRef, useState } from 'react'

interface Props {
  startTime: number
  duration: number
  color?: string
  rounded?: string
}

export function ProgressBar({ startTime, duration, color = 'bg-cyan-400', rounded = 'rounded-full' }: Props) {
  const [progress, setProgress] = useState(1)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startTime
      const p = Math.max(0, 1 - elapsed / duration)
      setProgress(p)
      if (p > 0) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [startTime, duration])

  return (
    <div className={`w-full h-1.5 bg-gray-700 ${rounded} overflow-hidden`}>
      <div
        className={`h-full ${color} ${rounded} transition-none`}
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  )
}
