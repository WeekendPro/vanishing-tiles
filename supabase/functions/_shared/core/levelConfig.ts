export type ShapeComplexity = 'simple' | 'medium' | 'complex'

export interface LevelConfig {
  displayNumber: number
  theme: 'beginner' | 'intermediate'
  viewDuration: number
  selectDuration: number
  gapCount: number
  shapeComplexity: ShapeComplexity
  adjacency: number   // 0 = scatter gaps; higher = more clustered/touching
}

// adjacency seeded from complexity tier (simple=0, medium=1, complex=2) as a
// starting point; tunable per level later.
const ADJ: Record<ShapeComplexity, number> = { simple: 0, medium: 1, complex: 2 }

const RAW: Omit<LevelConfig, 'theme' | 'adjacency'>[] = [
  { displayNumber: 1,  viewDuration: 10000, selectDuration: 15000, gapCount: 3,  shapeComplexity: 'simple'  },
  { displayNumber: 2,  viewDuration: 9000,  selectDuration: 15000, gapCount: 4,  shapeComplexity: 'simple'  },
  { displayNumber: 3,  viewDuration: 8100,  selectDuration: 14000, gapCount: 5,  shapeComplexity: 'simple'  },
  { displayNumber: 4,  viewDuration: 9300,  selectDuration: 14000, gapCount: 6,  shapeComplexity: 'medium'  },
  { displayNumber: 5,  viewDuration: 8600,  selectDuration: 13000, gapCount: 7,  shapeComplexity: 'medium'  },
  { displayNumber: 6,  viewDuration: 8000,  selectDuration: 13000, gapCount: 8,  shapeComplexity: 'medium'  },
  { displayNumber: 7,  viewDuration: 9500,  selectDuration: 12000, gapCount: 9,  shapeComplexity: 'complex' },
  { displayNumber: 8,  viewDuration: 9000,  selectDuration: 12000, gapCount: 10, shapeComplexity: 'complex' },
  { displayNumber: 9,  viewDuration: 8500,  selectDuration: 11000, gapCount: 11, shapeComplexity: 'complex' },
  { displayNumber: 10, viewDuration: 8100,  selectDuration: 11000, gapCount: 12, shapeComplexity: 'complex' },
  { displayNumber: 11, viewDuration: 7700,  selectDuration: 10000, gapCount: 13, shapeComplexity: 'complex' },
  { displayNumber: 12, viewDuration: 7300,  selectDuration: 10000, gapCount: 14, shapeComplexity: 'complex' },
  { displayNumber: 13, viewDuration: 7000,  selectDuration: 9000,  gapCount: 15, shapeComplexity: 'complex' },
  { displayNumber: 14, viewDuration: 6700,  selectDuration: 9000,  gapCount: 16, shapeComplexity: 'complex' },
  { displayNumber: 15, viewDuration: 6500,  selectDuration: 9000,  gapCount: 16, shapeComplexity: 'complex' },
]

export function themeForLevel(n: number): 'beginner' | 'intermediate' {
  return n <= 7 ? 'beginner' : 'intermediate'
}

export const LEVEL_CONFIGS: LevelConfig[] = RAW.map(r => ({
  ...r,
  theme: themeForLevel(r.displayNumber),
  adjacency: ADJ[r.shapeComplexity],
}))
