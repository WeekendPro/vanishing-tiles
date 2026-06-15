// Shared, layout-agnostic model for the "mental map" (brain) renderers.
//
// MentalMapBrain (low-poly) consumes this instead of touching the raw
// JourneyTheme[] — it flattens the journey into
// an ordered list of nodes, each tagged with its display state and lobe, so each
// renderer only has to map node.index -> a hub coordinate in its own layout.

import type { JourneyTheme } from './types'

export type NodeState = 'cleared' | 'next' | 'ghost'

export interface BrainNode {
  /** 0-based position across the whole journey (maps to hub[index] in a layout). */
  index: number
  levelId: string
  displayNumber: number
  name: string
  /** Theme/district index (0,1,2,…) — drives lobe color. */
  lobe: number
  state: NodeState
  /** Pass straight to onSelect; ghost/locked still open the level detail (display-only gating). */
  locked: boolean
  stars: number
  completedCount: number
}

export interface BrainModel {
  nodes: BrainNode[]
  /** index of the single 'next' node, or -1 when every level is cleared. */
  nextIndex: number
  clearedCount: number
  totalStars: number
  /** Number of distinct lobes (themes). */
  lobeCount: number
}

/**
 * Flatten themes -> ordered nodes. Mirrors TransitMap's state logic: a level is
 * 'cleared' if solved, else 'next' if it's the current frontier, else 'ghost'.
 * The RPC guarantees at most one current level across the whole journey.
 */
export function flattenJourney(themes: JourneyTheme[]): BrainModel {
  const nodes: BrainNode[] = []
  let nextIndex = -1
  let clearedCount = 0
  let totalStars = 0

  themes.forEach((theme, lobe) => {
    ;(theme.levels ?? []).forEach((lvl) => {
      const state: NodeState = lvl.cleared ? 'cleared' : lvl.current ? 'next' : 'ghost'
      const index = nodes.length
      if (state === 'next') nextIndex = index
      if (state === 'cleared') {
        clearedCount++
        totalStars += lvl.my_stars
      }
      nodes.push({
        index,
        levelId: lvl.level_id,
        displayNumber: lvl.display_number,
        name: lvl.name,
        lobe,
        state,
        locked: lvl.locked,
        stars: lvl.my_stars,
        completedCount: lvl.completedCount,
      })
    })
  })

  return { nodes, nextIndex, clearedCount, totalStars, lobeCount: themes.length }
}
