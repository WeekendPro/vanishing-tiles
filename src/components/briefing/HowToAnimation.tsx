import { useReducedMotion } from 'framer-motion'
import './howto.css'
import { ClassicDemo } from './animations/ClassicDemo'
import { ColorsDemo } from './animations/ColorsDemo'
import { OrderDemo } from './animations/OrderDemo'
import { FlashDemo } from './animations/FlashDemo'
import type { PlayableComponent } from '../../lib/components'

export function HowToAnimation({ component }: { component: PlayableComponent }) {
  const reduce = useReducedMotion()
  return (
    <div className={`howto${reduce ? ' howto-static' : ''}`} data-testid={`howto-${component}`} aria-hidden="true">
      {component === 'main' && <ClassicDemo />}
      {component === 'colors' && <ColorsDemo />}
      {component === 'inSequence' && <OrderDemo />}
      {component === 'flash' && <FlashDemo />}
    </div>
  )
}
