import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'go' | 'danger' | 'ghost' | 'accent'
type Size = 'sm' | 'md' | 'lg'

// Buttons are border-only at rest — no static glow (it reads as "always on").
// A soft glow appears on hover/focus instead, so the light follows intent.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 hover:shadow-neon-cyan',
  go: 'border-neon-green text-neon-green hover:bg-neon-green/10 hover:shadow-neon-green',
  danger: 'border-neon-red text-neon-red hover:bg-neon-red/10 hover:shadow-neon-red',
  accent: 'border-neon-magenta text-neon-magenta hover:bg-neon-magenta/10 hover:shadow-neon-magenta',
  ghost: 'border-arcade-edge text-gray-300 hover:border-neon-cyan hover:text-neon-cyan',
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'py-2 px-3 text-[10px]',
  md: 'py-3 px-4 text-xs',
  lg: 'py-4 px-5 text-sm',
}

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  children: ReactNode
}

export function NeonButton({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...rest
}: NeonButtonProps) {
  return (
    <button
      {...rest}
      className={[
        'font-pixel uppercase tracking-[0.08em] rounded-md border-2 bg-arcade-panel',
        'transition active:translate-y-px',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  )
}
