// Shared types for every Journey map renderer (transit, mental brain, …).
// All map components accept the same props so JourneyScreen can swap them freely.

export interface JourneyLevel {
  level_id: string
  display_number: number
  name: string
  my_pr: number | null
  my_stars: number
  completedCount: number
  cleared: boolean
  current: boolean
  locked: boolean
  last_played: string | null
  global_best: number | null
}

export interface JourneyTheme {
  theme_id: string
  slug: string
  name: string
  mechanic: string
  sort_order: number
  levels: JourneyLevel[]
}

/** The uniform contract shared by TransitMap and MentalMapBrain. */
export interface JourneyMapProps {
  themes: JourneyTheme[]
  onSelect: (levelId: string, locked: boolean) => void
}
