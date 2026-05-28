// ── Pieces ──────────────────────────────────────────────────────────────────

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L' | 'SINGLE'

export type Rotation = 0 | 1 | 2 | 3  // 0=0°, 1=90°, 2=180°, 3=270°

/** Relative [row, col] offsets from the anchor cell (top-left of bounding box) */
export type PieceCells = [number, number][]

export interface PieceDefinition {
  type: PieceType
  color: string         // Tailwind bg class, e.g. 'bg-cyan-400'
  cells: PieceCells     // canonical (rotation=0) shape
}

// ── Grid ────────────────────────────────────────────────────────────────────

export type CellStatus = 'filled' | 'empty' | 'placed' | 'preview'

export interface Cell {
  status: CellStatus
  pieceType?: PieceType   // which piece occupies this cell (if placed)
}

/** Grid is ROWS × COLS. grid[row][col]. 10 rows, 8 cols. */
export type Grid = Cell[][]

export const ROWS = 10 as const
export const COLS = 8 as const

// ── Gap ─────────────────────────────────────────────────────────────────────

/** A set of cells that form one tetromino-shaped gap in the grid */
export interface Gap {
  pieceType: PieceType
  rotation: Rotation
  anchorRow: number
  anchorCol: number
  cells: PieceCells  // absolute [row, col] positions
}

// ── Placement (a piece positioned on the grid) ────────────────────────────────

export interface Placement {
  pieceType: PieceType
  rotation: Rotation
  anchorRow: number
  anchorCol: number
  cells: [number, number][]
}

// ── Selection ────────────────────────────────────────────────────────────────

export interface SelectionEntry {
  pieceType: PieceType
  freeCount: number     // freely added this round — can decrement to 0
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export interface RoundScore {
  correctness: number
  speedBonus: number
  efficiencyBonus: number
  total: number
}

// ── Resolution (drives the resolving phase animation) ─────────────────────────

export type ResolutionReason = 'too-many' | 'wrong-shapes' | 'missed-one' | 'missed-many'

export interface Resolution {
  kind: 'perfect' | 'partial'
  placements: Placement[]
  coverage: number   // 1 for perfect; filledCells/totalCells for partial
  reason?: ResolutionReason   // set only when kind === 'partial'
}

// ── Difficulty ───────────────────────────────────────────────────────────────

export interface DifficultyConfig {
  viewDuration: number     // ms
  selectDuration: number   // ms
  placeDuration: number    // ms
  gapCount: number         // number of tetromino gaps placed in the puzzle
  complexity: 'simple' | 'medium' | 'complex'
}

// ── Game phases ───────────────────────────────────────────────────────────────

export type GamePhase =
  | 'idle'
  | 'viewing'
  | 'selecting'
  | 'resolving'
  | 'game-over'

// ── Full game state ───────────────────────────────────────────────────────────

export interface GameState {
  phase: GamePhase
  round: number
  score: number
  lives: number               // 3 → 0; reaching 0 = game over
  grid: Grid
  gaps: Gap[]                 // gaps placed in current puzzle
  selection: SelectionEntry[] // current selection cart
  phaseStartTime: number      // Date.now() when current phase started
  phaseDuration: number       // ms; 0 = no timer for this phase
  roundScore: RoundScore | null
  difficulty: DifficultyConfig
}
