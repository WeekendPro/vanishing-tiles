interface WordmarkProps {
  size?: 'sm' | 'lg'
  as?: 'h1' | 'h2'
  /**
   * Legacy hero treatment that stacked "Gap" over "City" on two lines.
   * "PHOSPHOR" is a single word, so this is now a no-op kept for API
   * compatibility with existing callers (landing-page hero).
   */
  stacked?: boolean
  className?: string
}

const SIZE: Record<NonNullable<WordmarkProps['size']>, string> = {
  sm: 'text-lg',
  lg: 'text-3xl',
}

export function Wordmark({ size = 'sm', as: Tag = 'h1', stacked: _stacked = false, className = '' }: WordmarkProps) {
  return (
    <Tag
      className={[
        'font-pixel uppercase tracking-[0.08em] leading-none text-white text-glow-cyan',
        SIZE[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      Phosphor
    </Tag>
  )
}
