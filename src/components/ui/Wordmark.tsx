interface WordmarkProps {
  size?: 'sm' | 'lg'
  as?: 'h1' | 'h2'
  /**
   * Hero treatment: stack the two words ("Vanishing" over "Tiles") on two
   * lines, the way the auth + home heroes present the wordmark. When false the
   * name renders inline on a single line.
   */
  stacked?: boolean
  className?: string
}

const SIZE: Record<NonNullable<WordmarkProps['size']>, string> = {
  sm: 'text-lg',
  lg: 'text-3xl',
}

export function Wordmark({ size = 'sm', as: Tag = 'h1', stacked = false, className = '' }: WordmarkProps) {
  return (
    <Tag
      className={[
        'font-pixel font-bold uppercase tracking-[0.05em] leading-none text-white text-glow-cyan',
        SIZE[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {stacked ? <>Vanishing<br />Tiles</> : 'Vanishing Tiles'}
    </Tag>
  )
}
