import type { ReactNode } from 'react'

interface PixelHeadingProps {
  children: ReactNode
  as?: 'h1' | 'h2' | 'h3'
  glow?: boolean
  underline?: boolean
  className?: string
}

export function PixelHeading({
  children,
  as: Tag = 'h1',
  glow = true,
  underline = false,
  className = '',
}: PixelHeadingProps) {
  return (
    <Tag
      className={[
        'font-pixel font-bold uppercase tracking-[0.08em] text-neon-cyan',
        glow ? 'text-glow-cyan' : '',
        underline ? 'inline-block border-b-2 border-neon-magenta pb-1' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  )
}
