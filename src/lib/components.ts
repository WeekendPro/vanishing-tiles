import type { RoundTheme } from '@shared/types'

/** A playable puzzle within a level. `riddle` is a placeholder (not yet playable). */
export type ComponentKey = 'main' | 'colors' | 'inSequence' | 'flash' | 'riddle'
export type PlayableComponent = Exclude<ComponentKey, 'riddle'>

/** Display order on the level hub (main first, then the four badges). */
export const LEVEL_COMPONENTS: ComponentKey[] = ['main', 'colors', 'inSequence', 'flash', 'riddle']

/** The four badge components (everything except the main puzzle). */
export const BADGE_COMPONENTS: ComponentKey[] = ['colors', 'inSequence', 'flash', 'riddle']

/** Map each playable component onto the existing engine theme. */
export const COMPONENT_THEME: Record<PlayableComponent, RoundTheme> = {
  main: 'basic',
  colors: 'colorCoded',
  inSequence: 'sequential',
  flash: 'flashMob',
}

export const COMPONENT_LABEL: Record<ComponentKey, string> = {
  main: 'Main',
  colors: 'Colors',
  inSequence: 'In-Sequence',
  flash: 'Flash',
  riddle: 'Riddle',
}

export function isPlayable(c: ComponentKey): c is PlayableComponent {
  return c !== 'riddle'
}
