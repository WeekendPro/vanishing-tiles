import { useRef } from 'react'
import { motion } from 'framer-motion'

export type CtaVariant = 'next' | 'retry' | 'newgame'

interface Props {
  show: boolean
  onClick: () => void
  label: string
  variant: CtaVariant
}

const VARIANT_CLASSES: Record<CtaVariant, string> = {
  next:    'border-neon-green text-neon-green shadow-neon-green hover:bg-neon-green/10',
  retry:   'border-neon-magenta text-neon-magenta shadow-neon-magenta hover:bg-neon-magenta/10',
  newgame: 'border-neon-cyan text-neon-cyan shadow-neon-cyan hover:bg-neon-cyan/10',
}

export function NextRoundButton({ show, onClick, label, variant }: Props) {
  const fired = useRef(false)

  if (!show) return null

  const handleClick = () => {
    if (fired.current) return
    fired.current = true
    onClick()
  }

  return (
    <motion.button
      onClick={handleClick}
      className={`w-full py-3 cursor-pointer font-pixel uppercase tracking-[0.08em] text-xs rounded-md border-2 bg-arcade-panel transition-colors ${VARIANT_CLASSES[variant]}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {label}
    </motion.button>
  )
}
