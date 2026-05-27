import { useRef } from 'react'
import { motion } from 'framer-motion'

interface Props {
  show: boolean
  onClick: () => void
}

export function NextRoundButton({ show, onClick }: Props) {
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
      className="w-full py-3 bg-green-700 hover:bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-900/40 cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
    >
      Next Round →
    </motion.button>
  )
}
