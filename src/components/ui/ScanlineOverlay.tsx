interface ScanlineOverlayProps {
  className?: string
}

export function ScanlineOverlay({ className = '' }: ScanlineOverlayProps) {
  return (
    <div
      aria-hidden
      className={['absolute inset-0 arcade-scanlines opacity-20 pointer-events-none', className]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
