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
  next:    'bg-green-700 hover:bg-green-600 text-white shadow-lg shadow-green-900/40',
  retry:   'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/40',
  newgame: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40',
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
      className={`w-full py-3 rounded-xl font-bold cursor-pointer ${VARIANT_CLASSES[variant]}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {label}
    </motion.button>
  )
}
