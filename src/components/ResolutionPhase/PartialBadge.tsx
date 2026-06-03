import { motion } from 'framer-motion'
import type { ResolutionReason } from '@shared/types'

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
  'wrong-order': 'Wrong order',
}

type Tier = 'close' | 'tough' | 'yikes'

const TIER: Record<Tier, {
  label: string; glyph: string; gradient: string; shadow: string; text: string
}> = {
  close: {
    label: 'So close!', glyph: '≈',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    shadow: '0 8px 24px rgba(245,158,11,.35), 0 0 0 4px rgba(245,158,11,.15)',
    text: 'text-neon-yellow text-glow-yellow',
  },
  tough: {
    label: 'Tough Round', glyph: '✕',
    gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    shadow: '0 8px 24px rgba(239,68,68,.35), 0 0 0 4px rgba(239,68,68,.15)',
    text: 'text-neon-red text-glow-red',
  },
  yikes: {
    label: 'Yikes', glyph: '✕',
    gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    shadow: '0 8px 24px rgba(239,68,68,.35), 0 0 0 4px rgba(239,68,68,.15)',
    text: 'text-neon-red text-glow-red',
  },
}

export function PartialBadge({ show, coverage, reason }: Props) {
  if (!show) return null
  const tier: Tier = coverage >= 0.66 ? 'close' : coverage >= 0.33 ? 'tough' : 'yikes'
  const t = TIER[tier]
  const subLabel = reason ? REASON_LABEL[reason] : ''

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-20">
      <motion.div
        className="flex items-center justify-center"
        style={{
          width: 84, height: 84, borderRadius: 22,
          background: t.gradient,
          boxShadow: t.shadow,
        }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: [0, 1.15, 1] }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <span className="text-5xl font-black text-white leading-none">{t.glyph}</span>
      </motion.div>
      <motion.span
        className={`mt-3 font-pixel text-xs uppercase tracking-[0.1em] ${t.text}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.2 }}
      >
        {t.label}
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
