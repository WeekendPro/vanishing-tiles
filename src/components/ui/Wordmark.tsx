interface WordmarkProps {
  size?: 'sm' | 'lg'
  as?: 'h1' | 'h2'
  className?: string
}

const SIZE: Record<NonNullable<WordmarkProps['size']>, string> = {
  sm: 'text-lg',
  lg: 'text-3xl',
}

export function Wordmark({ size = 'sm', as: Tag = 'h1', className = '' }: WordmarkProps) {
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
      Gap City
    </Tag>
  )
}
