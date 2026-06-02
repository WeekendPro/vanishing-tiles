export type ShapeComplexity = 'simple' | 'medium' | 'complex'

export interface LevelConfig {
  displayNumber: number
  theme: 'the_hollows' | 'the_stacks' | 'the_grid'
  viewDuration: number
  selectDuration: number
  gapCount: number
  shapeComplexity: ShapeComplexity
  adjacency: number   // 0 = scatter gaps; higher = more clustered/touching
}

// adjacency seeded from complexity tier (simple=0, medium=1, complex=2) as a
// starting point; tunable per level later.
const ADJ: Record<ShapeComplexity, number> = { simple: 0, medium: 1, complex: 2 }

// Memorize (viewDuration) rises with gapCount on a comfortable ~1.2–1.33s/gap
// curve so every level stays solvable — the challenge is HOW FAST you clear it.
// selectDuration rises too so picking pieces is never the bottleneck. Keep in
// sync with the client DIFFICULTY_TABLE (gameStore.ts) and seed.sql.
const RAW: Omit<LevelConfig, 'theme' | 'adjacency'>[] = [
  { displayNumber: 1,  viewDuration: 4000,  selectDuration: 10000, gapCount: 3,  shapeComplexity: 'simple'  },
  { displayNumber: 2,  viewDuration: 5000,  selectDuration: 11000, gapCount: 4,  shapeComplexity: 'simple'  },
  { displayNumber: 3,  viewDuration: 6500,  selectDuration: 12000, gapCount: 5,  shapeComplexity: 'simple'  },
  { displayNumber: 4,  viewDuration: 8000,  selectDuration: 14000, gapCount: 6,  shapeComplexity: 'medium'  },
  { displayNumber: 5,  viewDuration: 9000,  selectDuration: 15000, gapCount: 7,  shapeComplexity: 'medium'  },
  { displayNumber: 6,  viewDuration: 10000, selectDuration: 16000, gapCount: 8,  shapeComplexity: 'medium'  },
  { displayNumber: 7,  viewDuration: 11000, selectDuration: 17000, gapCount: 9,  shapeComplexity: 'complex' },
  { displayNumber: 8,  viewDuration: 12000, selectDuration: 18000, gapCount: 10, shapeComplexity: 'complex' },
  { displayNumber: 9,  viewDuration: 13000, selectDuration: 19000, gapCount: 11, shapeComplexity: 'complex' },
  { displayNumber: 10, viewDuration: 14000, selectDuration: 20000, gapCount: 12, shapeComplexity: 'complex' },
  { displayNumber: 11, viewDuration: 15000, selectDuration: 21000, gapCount: 13, shapeComplexity: 'complex' },
  { displayNumber: 12, viewDuration: 16000, selectDuration: 22000, gapCount: 14, shapeComplexity: 'complex' },
  { displayNumber: 13, viewDuration: 16500, selectDuration: 22000, gapCount: 15, shapeComplexity: 'complex' },
  { displayNumber: 14, viewDuration: 17000, selectDuration: 23000, gapCount: 16, shapeComplexity: 'complex' },
  { displayNumber: 15, viewDuration: 17000, selectDuration: 23000, gapCount: 16, shapeComplexity: 'complex' },
]

export function themeForLevel(n: number): 'the_hollows' | 'the_stacks' | 'the_grid' {
  if (n <= 5) return 'the_hollows'
  if (n <= 10) return 'the_stacks'
  return 'the_grid'
}

export const LEVEL_CONFIGS: LevelConfig[] = RAW.map(r => ({
  ...r,
  theme: themeForLevel(r.displayNumber),
  adjacency: ADJ[r.shapeComplexity],
}))
