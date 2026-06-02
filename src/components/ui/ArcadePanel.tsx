import type { HTMLAttributes, ReactNode } from 'react'

interface ArcadePanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function ArcadePanel({ className = '', children, ...rest }: ArcadePanelProps) {
  return (
    <div
      {...rest}
      className={['bg-arcade-panel border-2 border-arcade-edge shadow-panel-inset rounded-md', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}
