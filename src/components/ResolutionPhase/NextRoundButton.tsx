import { useRef } from 'react'
import { motion } from 'framer-motion'

interface Props {
  show: boolean
  onClick: () => void
  label?: string
  danger?: boolean
}

export function NextRoundButton({ show, onClick, label = 'Next Round →', danger = false }: Props) {
  const fired = useRef(false)

  if (!show) return null

  const handleClick = () => {
    if (fired.current) return
    fired.current = true
    onClick()
  }

  const colorClasses = danger
    ? 'bg-red-900 border-2 border-red-500 text-red-300'
    : 'bg-green-700 hover:bg-green-600 text-white shadow-lg shadow-green-900/40'

  return (
    <motion.button
      onClick={handleClick}
      className={`w-full py-3 rounded-xl font-bold cursor-pointer ${colorClasses}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {label}
    </motion.button>
  )
}
