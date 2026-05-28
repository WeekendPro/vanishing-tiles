import { motion } from 'framer-motion'
import type { ResolutionReason } from '../../types'

interface Props {
  show: boolean
  coverage: number
  reason?: ResolutionReason
}

const REASON_LABEL: Record<ResolutionReason, string> = {
  'too-many': 'Too many pieces',
  'wrong-shapes': "Some pieces don't fit",
  'missed-one': 'Missed a piece',
  'missed-many': 'Missed some pieces',
}

export function PartialBadge({ show, coverage, reason }: Props) {
  if (!show) return null
  const close = coverage >= 0.66
  const mainLine = close ? 'So close!' : 'Nice try'
  const glyph = close ? '≈' : '✕'
  const subLabel = reason ? REASON_LABEL[reason] : ''

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-20">
      <motion.div
        className="flex items-center justify-center"
        style={{
          width: 84, height: 84, borderRadius: 22,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          boxShadow: '0 8px 24px rgba(245,158,11,.35), 0 0 0 4px rgba(245,158,11,.15)',
        }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: [0, 1.15, 1] }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <span className="text-5xl font-black text-white leading-none">{glyph}</span>
      </motion.div>
      <motion.span
        className="mt-3 text-sm font-bold tracking-widest uppercase text-amber-400"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.2 }}
      >
        {mainLine}
      </motion.span>
      {subLabel && (
        <motion.span
          className="mt-1 text-xs text-gray-400"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.2 }}
        >
          {subLabel}
        </motion.span>
      )}
    </div>
  )
}
