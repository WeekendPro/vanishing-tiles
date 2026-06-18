interface WordmarkProps {
  size?: 'sm' | 'lg'
  as?: 'h1' | 'h2'
  /** Stack "Gap" over "City" on two lines (landing-page hero treatment). */
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
        'font-pixel uppercase tracking-[0.08em] leading-none text-white text-glow-cyan',
        SIZE[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {stacked ? (
        <>
          Gap<br />City
        </>
      ) : (
        'Gap City'
      )}
    </Tag>
  )
}
