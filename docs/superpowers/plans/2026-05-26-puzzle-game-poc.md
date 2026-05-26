# Puzzle Game POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable web POC of a memory-and-speed puzzle game where players memorize tetromino-shaped gaps in a grid, select the pieces they think are needed, and earn points for correctness, speed, and efficiency.

**Architecture:** Vite + React + TypeScript for the UI layer; a Zustand store manages all game state as a phase-based state machine (viewing → selecting → placing → scoring); pure TypeScript engine functions handle puzzle generation and auto-place solving, completely decoupled from React so they can be reused in a future React Native port.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Zustand 4, Tailwind CSS 3, Vitest + @testing-library/react

---

## File Map

```
src/
  types.ts                     # All shared types (Grid, Piece, GameState, etc.)
  engine/
    pieces.ts                  # Piece definitions, shapes, rotation logic
    puzzleGenerator.ts         # Generates 8×10 puzzle grids with tetromino gaps
    solver.ts                  # Backtracking solver: can selection fill gaps?
  store/
    gameStore.ts               # Zustand store: full game state machine + actions
  components/
    PieceShape.tsx             # Renders a single piece shape (mini grid of cells)
    Grid.tsx                   # Renders the 8×10 game grid
    ProgressBar.tsx            # Animated timer progress bar (no numbers)
    ViewingPhase.tsx           # Phase 1: grid visible + countdown
    SelectingPhase.tsx         # Phase 2: selection box + piece menu
    PlacingPhase.tsx           # Phase 3B: manual placement with tray
    ScoringPhase.tsx           # Phase 4: score breakdown + next round
    GameShell.tsx              # Top bar (round/score/lives) + phase router
  App.tsx
  main.tsx
  index.css

tests/
  engine/
    pieces.test.ts
    puzzleGenerator.test.ts
    solver.test.ts
  store/
    gameStore.test.ts
```

---

## Task 1: Project Scaffold + Types

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Create: `src/types.ts`

- [ ] **Step 1: Scaffold Vite + React + TypeScript project**

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install zustand
npm install -D tailwindcss postcss autoprefixer vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npx tailwindcss init -p
```

- [ ] **Step 2: Configure Tailwind**

In `tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

In `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Configure Vitest**

In `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
  },
})
```

Create `tests/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Write all shared types**

Create `src/types.ts`:
```ts
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

export type CellStatus = 'filled' | 'empty' | 'placed'

export interface Cell {
  status: CellStatus
  pieceType?: PieceType   // which piece occupies this cell (if placed)
}

/** Grid is ROWS × COLS. grid[row][col]. 10 rows, 8 cols. */
export type Grid = Cell[][]

export const ROWS = 10
export const COLS = 8

// ── Gap ─────────────────────────────────────────────────────────────────────

/** A set of cells that form one tetromino-shaped gap in the grid */
export interface Gap {
  pieceType: PieceType
  rotation: Rotation
  anchorRow: number
  anchorCol: number
  cells: [number, number][]  // absolute [row, col] positions
}

// ── Selection ────────────────────────────────────────────────────────────────

export interface SelectionEntry {
  pieceType: PieceType
  lockedCount: number   // carry-overs from previous round — cannot decrement
  freeCount: number     // freely added this round — can decrement to 0
}

// ── Carry-overs ─────────────────────────────────────────────────────────────

export interface CarryOver {
  pieceType: PieceType
  count: number
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export interface RoundScore {
  correctness: number
  speedBonus: number
  efficiencyBonus: number
  total: number
}

// ── Difficulty ───────────────────────────────────────────────────────────────

export interface DifficultyConfig {
  viewDuration: number     // ms
  selectDuration: number   // ms
  gapCount: number         // number of tetromino gaps placed in the puzzle
  complexity: 'simple' | 'medium' | 'complex'
}

// ── Held piece (manual placement) ────────────────────────────────────────────

export interface HeldPiece {
  pieceType: PieceType
  rotation: Rotation
}

// ── Game phases ───────────────────────────────────────────────────────────────

export type GamePhase =
  | 'idle'
  | 'viewing'
  | 'selecting'
  | 'auto-placing'
  | 'manual-placing'
  | 'scoring'
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
  carryOvers: CarryOver[]     // locked pieces for next round
  heldPiece: HeldPiece | null // piece currently held for placement
  phaseStartTime: number      // Date.now() when current phase started
  phaseDuration: number       // ms; 0 = no timer for this phase
  roundScore: RoundScore | null
  difficulty: DifficultyConfig
}
```

- [ ] **Step 5: Verify scaffold runs**

```bash
npm run dev
```

Expected: Vite dev server starts, browser shows React boilerplate.

```bash
npm test
```

Expected: Vitest runs, 0 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite+React+TS+Zustand, define all shared types"
```

---

## Task 2: Piece Definitions & Rotation

**Files:**
- Create: `src/engine/pieces.ts`
- Create: `tests/engine/pieces.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/engine/pieces.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  PIECE_DEFINITIONS,
  rotateCells,
  getRotatedCells,
  getAllRotations,
} from '../../src/engine/pieces'

describe('PIECE_DEFINITIONS', () => {
  it('defines all 8 piece types', () => {
    const types = PIECE_DEFINITIONS.map(p => p.type)
    expect(types).toContain('I')
    expect(types).toContain('O')
    expect(types).toContain('T')
    expect(types).toContain('S')
    expect(types).toContain('Z')
    expect(types).toContain('J')
    expect(types).toContain('L')
    expect(types).toContain('SINGLE')
  })

  it('I piece has 4 cells in a row', () => {
    const I = PIECE_DEFINITIONS.find(p => p.type === 'I')!
    expect(I.cells).toHaveLength(4)
    // all cells in same row
    const rows = I.cells.map(([r]) => r)
    expect(new Set(rows).size).toBe(1)
  })

  it('O piece has 4 cells in 2×2 square', () => {
    const O = PIECE_DEFINITIONS.find(p => p.type === 'O')!
    expect(O.cells).toHaveLength(4)
  })

  it('SINGLE piece has exactly 1 cell', () => {
    const single = PIECE_DEFINITIONS.find(p => p.type === 'SINGLE')!
    expect(single.cells).toHaveLength(1)
    expect(single.cells[0]).toEqual([0, 0])
  })
})

describe('rotateCells', () => {
  it('rotates I piece 90° to vertical', () => {
    const I = PIECE_DEFINITIONS.find(p => p.type === 'I')!
    const rotated = rotateCells(I.cells)
    // after one 90° CW rotation, all cells should be in same column
    const cols = rotated.map(([, c]) => c)
    expect(new Set(cols).size).toBe(1)
  })

  it('rotating 4 times returns to original (normalized)', () => {
    const T = PIECE_DEFINITIONS.find(p => p.type === 'T')!
    let cells = T.cells
    for (let i = 0; i < 4; i++) cells = rotateCells(cells)
    expect(cells).toEqual(T.cells)
  })
})

describe('getRotatedCells', () => {
  it('rotation 0 returns canonical cells', () => {
    const I = PIECE_DEFINITIONS.find(p => p.type === 'I')!
    expect(getRotatedCells('I', 0)).toEqual(I.cells)
  })

  it('rotation 1 returns 90° rotated cells', () => {
    const cells0 = getRotatedCells('I', 0)
    const cells1 = getRotatedCells('I', 1)
    expect(cells1).not.toEqual(cells0)
    const cols = cells1.map(([, c]) => c)
    expect(new Set(cols).size).toBe(1) // vertical
  })
})

describe('getAllRotations', () => {
  it('I piece has 2 unique rotations', () => {
    const rotations = getAllRotations('I')
    expect(rotations).toHaveLength(2)
  })

  it('O piece has 1 unique rotation', () => {
    const rotations = getAllRotations('O')
    expect(rotations).toHaveLength(1)
  })

  it('T piece has 4 unique rotations', () => {
    const rotations = getAllRotations('T')
    expect(rotations).toHaveLength(4)
  })

  it('SINGLE piece has 1 unique rotation', () => {
    const rotations = getAllRotations('SINGLE')
    expect(rotations).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test tests/engine/pieces.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement pieces.ts**

Create `src/engine/pieces.ts`:
```ts
import type { PieceCells, PieceDefinition, PieceType, Rotation } from '../types'

export const PIECE_DEFINITIONS: PieceDefinition[] = [
  { type: 'I', color: 'bg-cyan-400',   cells: [[0,0],[0,1],[0,2],[0,3]] },
  { type: 'O', color: 'bg-yellow-400', cells: [[0,0],[0,1],[1,0],[1,1]] },
  { type: 'T', color: 'bg-purple-500', cells: [[0,0],[0,1],[0,2],[1,1]] },
  { type: 'S', color: 'bg-green-400',  cells: [[0,1],[0,2],[1,0],[1,1]] },
  { type: 'Z', color: 'bg-red-500',    cells: [[0,0],[0,1],[1,1],[1,2]] },
  { type: 'J', color: 'bg-blue-500',   cells: [[0,0],[1,0],[1,1],[1,2]] },
  { type: 'L', color: 'bg-orange-400', cells: [[0,2],[1,0],[1,1],[1,2]] },
  { type: 'SINGLE', color: 'bg-gray-400', cells: [[0,0]] },
]

/** Normalize cells so top-left is [0,0] */
function normalizeCells(cells: PieceCells): PieceCells {
  const minR = Math.min(...cells.map(([r]) => r))
  const minC = Math.min(...cells.map(([, c]) => c))
  const shifted = cells.map(([r, c]) => [r - minR, c - minC] as [number, number])
  // canonical sort: row-major
  return shifted.sort(([r1, c1], [r2, c2]) => r1 - r2 || c1 - c2)
}

/** Rotate cells 90° clockwise once */
export function rotateCells(cells: PieceCells): PieceCells {
  // 90° CW: [r, c] → [c, maxR - r]
  const maxR = Math.max(...cells.map(([r]) => r))
  const rotated = cells.map(([r, c]) => [c, maxR - r] as [number, number])
  return normalizeCells(rotated)
}

/** Get cells for a piece at a given rotation (0–3) */
export function getRotatedCells(type: PieceType, rotation: Rotation): PieceCells {
  const def = PIECE_DEFINITIONS.find(p => p.type === type)!
  let cells = normalizeCells(def.cells)
  for (let i = 0; i < rotation; i++) cells = rotateCells(cells)
  return cells
}

/** Serialize cells for deduplication */
function serializeCells(cells: PieceCells): string {
  return normalizeCells(cells).map(([r, c]) => `${r},${c}`).join('|')
}

/** Get all unique rotations for a piece type, as [rotation index, cells] pairs */
export function getAllRotations(type: PieceType): { rotation: Rotation; cells: PieceCells }[] {
  const seen = new Set<string>()
  const results: { rotation: Rotation; cells: PieceCells }[] = []
  for (let r = 0; r < 4; r++) {
    const cells = getRotatedCells(type, r as Rotation)
    const key = serializeCells(cells)
    if (!seen.has(key)) {
      seen.add(key)
      results.push({ rotation: r as Rotation, cells })
    }
  }
  return results
}

export function getPieceColor(type: PieceType): string {
  return PIECE_DEFINITIONS.find(p => p.type === type)!.color
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test tests/engine/pieces.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/pieces.ts tests/engine/pieces.test.ts
git commit -m "feat: piece definitions and rotation logic"
```

---

## Task 3: Puzzle Generator

**Files:**
- Create: `src/engine/puzzleGenerator.ts`
- Create: `tests/engine/puzzleGenerator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/engine/puzzleGenerator.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generatePuzzle } from '../../src/engine/puzzleGenerator'
import { ROWS, COLS } from '../../src/types'

describe('generatePuzzle', () => {
  it('returns a grid with correct dimensions', () => {
    const { grid } = generatePuzzle({ gapCount: 2, complexity: 'simple' })
    expect(grid).toHaveLength(ROWS)
    grid.forEach(row => expect(row).toHaveLength(COLS))
  })

  it('returns the correct number of gaps', () => {
    const { gaps } = generatePuzzle({ gapCount: 3, complexity: 'simple' })
    expect(gaps).toHaveLength(3)
  })

  it('each gap has cells matching the grid empty cells', () => {
    const { grid, gaps } = generatePuzzle({ gapCount: 2, complexity: 'simple' })
    const emptyCells = new Set<string>()
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c].status === 'empty') emptyCells.add(`${r},${c}`)

    for (const gap of gaps) {
      for (const [r, c] of gap.cells) {
        expect(emptyCells.has(`${r},${c}`)).toBe(true)
      }
    }
  })

  it('empty cell count equals sum of all gap cells', () => {
    const { grid, gaps } = generatePuzzle({ gapCount: 3, complexity: 'simple' })
    const emptyCount = grid.flat().filter(c => c.status === 'empty').length
    const gapCellCount = gaps.reduce((sum, g) => sum + g.cells.length, 0)
    expect(emptyCount).toBe(gapCellCount)
  })

  it('gaps do not overlap', () => {
    const { gaps } = generatePuzzle({ gapCount: 4, complexity: 'medium' })
    const seen = new Set<string>()
    for (const gap of gaps) {
      for (const [r, c] of gap.cells) {
        const key = `${r},${c}`
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
  })

  it('simple complexity only uses I and O pieces', () => {
    for (let i = 0; i < 10; i++) {
      const { gaps } = generatePuzzle({ gapCount: 2, complexity: 'simple' })
      gaps.forEach(g => expect(['I', 'O']).toContain(g.pieceType))
    }
  })

  it('never creates 1×1 gaps', () => {
    for (let i = 0; i < 10; i++) {
      const { gaps } = generatePuzzle({ gapCount: 3, complexity: 'simple' })
      gaps.forEach(g => expect(g.cells.length).toBeGreaterThan(1))
    }
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test tests/engine/puzzleGenerator.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement puzzleGenerator.ts**

Create `src/engine/puzzleGenerator.ts`:
```ts
import type { Grid, Gap, Cell, DifficultyConfig, PieceType, Rotation } from '../types'
import { ROWS, COLS } from '../types'
import { getAllRotations } from './pieces'

type PuzzleInput = Pick<DifficultyConfig, 'gapCount' | 'complexity'>

const COMPLEXITY_PIECES: Record<DifficultyConfig['complexity'], PieceType[]> = {
  simple:  ['I', 'O'],
  medium:  ['I', 'O', 'T', 'J', 'L'],
  complex: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'],
}

function makeFullGrid(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => ({ status: 'filled' }))
  )
}

function cellsInBounds(cells: [number, number][], anchorRow: number, anchorCol: number): boolean {
  return cells.every(([r, c]) => {
    const ar = r + anchorRow
    const ac = c + anchorCol
    return ar >= 0 && ar < ROWS && ac >= 0 && ac < COLS
  })
}

function cellsAreFree(
  grid: Grid,
  cells: [number, number][],
  anchorRow: number,
  anchorCol: number
): boolean {
  return cells.every(([r, c]) => grid[r + anchorRow][c + anchorCol].status === 'filled')
}

function placeGap(
  grid: Grid,
  cells: [number, number][],
  anchorRow: number,
  anchorCol: number
): void {
  cells.forEach(([r, c]) => {
    grid[r + anchorRow][c + anchorCol] = { status: 'empty' }
  })
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generatePuzzle(input: PuzzleInput): { grid: Grid; gaps: Gap[] } {
  const { gapCount, complexity } = input
  const allowedTypes = COMPLEXITY_PIECES[complexity]
  const grid = makeFullGrid()
  const gaps: Gap[] = []

  let attempts = 0
  while (gaps.length < gapCount && attempts < 1000) {
    attempts++
    const pieceType = allowedTypes[Math.floor(Math.random() * allowedTypes.length)]
    const rotations = getAllRotations(pieceType)
    const { rotation, cells } = rotations[Math.floor(Math.random() * rotations.length)]

    const maxRow = ROWS - Math.max(...cells.map(([r]) => r)) - 1
    const maxCol = COLS - Math.max(...cells.map(([, c]) => c)) - 1
    if (maxRow < 0 || maxCol < 0) continue

    const anchorRow = Math.floor(Math.random() * (maxRow + 1))
    const anchorCol = Math.floor(Math.random() * (maxCol + 1))

    if (!cellsInBounds(cells, anchorRow, anchorCol)) continue
    if (!cellsAreFree(grid, cells, anchorRow, anchorCol)) continue

    const absoluteCells = cells.map(([r, c]) => [r + anchorRow, c + anchorCol] as [number, number])
    placeGap(grid, cells, anchorRow, anchorCol)
    gaps.push({ pieceType, rotation, anchorRow, anchorCol, cells: absoluteCells })
  }

  return { grid, gaps }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test tests/engine/puzzleGenerator.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/puzzleGenerator.ts tests/engine/puzzleGenerator.test.ts
git commit -m "feat: puzzle generator places non-overlapping tetromino gaps"
```

---

## Task 4: Auto-Place Solver

**Files:**
- Create: `src/engine/solver.ts`
- Create: `tests/engine/solver.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/engine/solver.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { solve } from '../../src/engine/solver'
import type { Grid, Gap } from '../../src/types'
import { ROWS, COLS } from '../../src/types'

function makeGrid(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ status: 'filled' as const }))
  )
}

describe('solve', () => {
  it('returns solution for a single I-piece gap with exact I selection', () => {
    const grid = makeGrid()
    // carve horizontal I gap at row 0, cols 0-3
    for (let c = 0; c < 4; c++) grid[0][c] = { status: 'empty' }
    const gaps: Gap[] = [{
      pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 0,
      cells: [[0,0],[0,1],[0,2],[0,3]],
    }]
    const result = solve({ I: 1 }, grid, gaps)
    expect(result.solvable).toBe(true)
  })

  it('returns not solvable when wrong piece selected', () => {
    const grid = makeGrid()
    for (let c = 0; c < 4; c++) grid[0][c] = { status: 'empty' }
    const gaps: Gap[] = [{
      pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 0,
      cells: [[0,0],[0,1],[0,2],[0,3]],
    }]
    // wrong piece
    const result = solve({ O: 1 }, grid, gaps)
    expect(result.solvable).toBe(false)
  })

  it('returns not solvable when too many pieces selected', () => {
    const grid = makeGrid()
    for (let c = 0; c < 4; c++) grid[0][c] = { status: 'empty' }
    const gaps: Gap[] = [{
      pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 0,
      cells: [[0,0],[0,1],[0,2],[0,3]],
    }]
    const result = solve({ I: 2 }, grid, gaps)
    expect(result.solvable).toBe(false)
  })

  it('solves two non-overlapping gaps', () => {
    const grid = makeGrid()
    // I gap at row 0, cols 0-3
    for (let c = 0; c < 4; c++) grid[0][c] = { status: 'empty' }
    // O gap at row 2-3, cols 0-1
    grid[2][0] = { status: 'empty' }
    grid[2][1] = { status: 'empty' }
    grid[3][0] = { status: 'empty' }
    grid[3][1] = { status: 'empty' }

    const gaps: Gap[] = [
      { pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0,0],[0,1],[0,2],[0,3]] },
      { pieceType: 'O', rotation: 0, anchorRow: 2, anchorCol: 0, cells: [[2,0],[2,1],[3,0],[3,1]] },
    ]

    const result = solve({ I: 1, O: 1 }, grid, gaps)
    expect(result.solvable).toBe(true)
  })

  it('returns placement positions in solution', () => {
    const grid = makeGrid()
    for (let c = 0; c < 4; c++) grid[0][c] = { status: 'empty' }
    const gaps: Gap[] = [{
      pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 0,
      cells: [[0,0],[0,1],[0,2],[0,3]],
    }]
    const result = solve({ I: 1 }, grid, gaps)
    expect(result.solvable).toBe(true)
    expect(result.placements).toHaveLength(1)
    expect(result.placements![0].pieceType).toBe('I')
    expect(result.placements![0].anchorRow).toBe(0)
    expect(result.placements![0].anchorCol).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test tests/engine/solver.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement solver.ts**

Create `src/engine/solver.ts`:
```ts
import type { Grid, Gap, PieceType, Rotation } from '../types'
import { ROWS, COLS } from '../types'
import { getAllRotations } from './pieces'

export interface Placement {
  pieceType: PieceType
  rotation: Rotation
  anchorRow: number
  anchorCol: number
  cells: [number, number][]
}

export interface SolveResult {
  solvable: boolean
  placements: Placement[] | null
}

type PieceCount = Partial<Record<PieceType, number>>

function cloneGrid(grid: Grid): Grid {
  return grid.map(row => row.map(cell => ({ ...cell })))
}

function findFirstEmpty(grid: Grid): [number, number] | null {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c].status === 'empty') return [r, c]
  return null
}

function canPlace(grid: Grid, cells: [number, number][], anchorRow: number, anchorCol: number): boolean {
  return cells.every(([r, c]) => {
    const ar = r + anchorRow
    const ac = c + anchorCol
    return ar >= 0 && ar < ROWS && ac >= 0 && ac < COLS && grid[ar][ac].status === 'empty'
  })
}

function applyPlacement(grid: Grid, cells: [number, number][], anchorRow: number, anchorCol: number, status: 'placed' | 'empty'): void {
  cells.forEach(([r, c]) => {
    grid[r + anchorRow][c + anchorCol] = { status }
  })
}

function backtrack(
  grid: Grid,
  remaining: PieceCount,
  placements: Placement[]
): boolean {
  const empty = findFirstEmpty(grid)
  if (!empty) {
    // All empty cells filled — check no pieces left
    const hasRemaining = Object.values(remaining).some(n => (n ?? 0) > 0)
    return !hasRemaining
  }

  const [targetRow, targetCol] = empty

  for (const [pieceTypeKey, count] of Object.entries(remaining)) {
    if ((count ?? 0) <= 0) continue
    const pieceType = pieceTypeKey as PieceType

    for (const { rotation, cells } of getAllRotations(pieceType)) {
      // Try all anchors such that one cell of the piece lands on targetRow, targetCol
      for (const [dr, dc] of cells) {
        const anchorRow = targetRow - dr
        const anchorCol = targetCol - dc
        if (!canPlace(grid, cells, anchorRow, anchorCol)) continue

        const absoluteCells = cells.map(([r, c]) => [r + anchorRow, c + anchorCol] as [number, number])
        applyPlacement(grid, cells, anchorRow, anchorCol, 'placed')
        remaining[pieceType] = (count ?? 0) - 1
        placements.push({ pieceType, rotation, anchorRow, anchorCol, cells: absoluteCells })

        if (backtrack(grid, remaining, placements)) return true

        // Undo
        placements.pop()
        remaining[pieceType] = count
        applyPlacement(grid, cells, anchorRow, anchorCol, 'empty')
      }
    }
    break // Only try pieces in order, targeting first empty cell
  }

  return false
}

/**
 * Determine if the given piece counts can exactly fill all empty cells in the grid.
 * pieceCount: { I: 2, T: 1 } etc.
 */
export function solve(pieceCount: PieceCount, grid: Grid, _gaps: Gap[]): SolveResult {
  const totalPieceCells = Object.entries(pieceCount).reduce((sum, [type, count]) => {
    if ((count ?? 0) === 0) return sum
    const cellsPerPiece = type === 'SINGLE' ? 1 : type === 'O' ? 4 : 4
    return sum + (count ?? 0) * cellsPerPiece
  }, 0)
  const totalEmpty = grid.flat().filter(c => c.status === 'empty').length

  // Quick rejection: piece cells must equal empty cells
  if (totalPieceCells !== totalEmpty) return { solvable: false, placements: null }

  const workGrid = cloneGrid(grid)
  const remaining: PieceCount = { ...pieceCount }
  const placements: Placement[] = []

  const solvable = backtrack(workGrid, remaining, placements)
  return { solvable, placements: solvable ? placements : null }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test tests/engine/solver.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/solver.ts tests/engine/solver.test.ts
git commit -m "feat: backtracking solver for auto-place verification"
```

---

## Task 5: Zustand Game Store

**Files:**
- Create: `src/store/gameStore.ts`
- Create: `tests/store/gameStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/store/gameStore.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useGameStore, DIFFICULTY_TABLE } from '../../src/store/gameStore'
import { act } from '@testing-library/react'

beforeEach(() => {
  useGameStore.getState().resetGame()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('initial state', () => {
  it('starts in idle phase', () => {
    expect(useGameStore.getState().phase).toBe('idle')
  })

  it('starts with 3 lives', () => {
    expect(useGameStore.getState().lives).toBe(3)
  })

  it('starts with score 0', () => {
    expect(useGameStore.getState().score).toBe(0)
  })
})

describe('startGame', () => {
  it('transitions to viewing phase', () => {
    act(() => useGameStore.getState().startGame())
    expect(useGameStore.getState().phase).toBe('viewing')
  })

  it('generates a grid', () => {
    act(() => useGameStore.getState().startGame())
    expect(useGameStore.getState().grid).toHaveLength(10)
  })

  it('generates gaps', () => {
    act(() => useGameStore.getState().startGame())
    expect(useGameStore.getState().gaps.length).toBeGreaterThan(0)
  })
})

describe('selection', () => {
  beforeEach(() => {
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().endViewing())
  })

  it('transitions to selecting phase after endViewing', () => {
    expect(useGameStore.getState().phase).toBe('selecting')
  })

  it('incrementSelection adds a free piece', () => {
    act(() => useGameStore.getState().incrementSelection('I'))
    const entry = useGameStore.getState().selection.find(e => e.pieceType === 'I')
    expect(entry?.freeCount).toBe(1)
    expect(entry?.lockedCount).toBe(0)
  })

  it('decrementSelection removes a free piece', () => {
    act(() => useGameStore.getState().incrementSelection('I'))
    act(() => useGameStore.getState().incrementSelection('I'))
    act(() => useGameStore.getState().decrementSelection('I'))
    const entry = useGameStore.getState().selection.find(e => e.pieceType === 'I')
    expect(entry?.freeCount).toBe(1)
  })

  it('decrementSelection cannot go below 0', () => {
    act(() => useGameStore.getState().decrementSelection('I'))
    const entry = useGameStore.getState().selection.find(e => e.pieceType === 'I')
    expect(entry?.freeCount ?? 0).toBe(0)
  })

  it('cannot decrement locked pieces', () => {
    // Manually inject a carry-over
    useGameStore.setState({ carryOvers: [{ pieceType: 'I', count: 1 }] })
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().endViewing())
    act(() => useGameStore.getState().decrementSelection('I'))
    const entry = useGameStore.getState().selection.find(e => e.pieceType === 'I')
    expect(entry?.lockedCount).toBe(1)
  })
})

describe('submitSelection — correct', () => {
  it('transitions to auto-placing when selection is correct', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    // Add exactly the right pieces
    act(() => {
      for (const gap of gaps) {
        useGameStore.getState().incrementSelection(gap.pieceType)
      }
    })
    act(() => useGameStore.getState().submitSelection())
    expect(useGameStore.getState().phase).toBe('auto-placing')
  })
})

describe('submitSelection — incorrect', () => {
  it('transitions to manual-placing and deducts a life', () => {
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().endViewing())
    // Select wrong pieces
    act(() => useGameStore.getState().incrementSelection('SINGLE'))
    act(() => useGameStore.getState().submitSelection())
    expect(useGameStore.getState().phase).toBe('manual-placing')
    expect(useGameStore.getState().lives).toBe(2)
  })
})

describe('lives and game over', () => {
  it('game over when lives reach 0', () => {
    useGameStore.setState({ lives: 1 })
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().endViewing())
    act(() => useGameStore.getState().incrementSelection('SINGLE'))
    act(() => useGameStore.getState().submitSelection())
    expect(useGameStore.getState().phase).toBe('game-over')
  })
})

describe('scoring', () => {
  it('correct selection awards correctness points', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())
    act(() => useGameStore.getState().finishAutoPlace())
    const { roundScore } = useGameStore.getState()
    expect(roundScore?.correctness).toBeGreaterThan(0)
  })
})

describe('DIFFICULTY_TABLE', () => {
  it('round 1 has 5000ms view duration', () => {
    expect(DIFFICULTY_TABLE[0].viewDuration).toBe(5000)
  })

  it('view duration decreases in later rounds', () => {
    expect(DIFFICULTY_TABLE[4].viewDuration).toBeLessThan(DIFFICULTY_TABLE[0].viewDuration)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test tests/store/gameStore.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement gameStore.ts**

Create `src/store/gameStore.ts`:
```ts
import { create } from 'zustand'
import type {
  GameState, GamePhase, PieceType, SelectionEntry,
  DifficultyConfig, RoundScore, HeldPiece, Rotation,
} from '../types'
import { generatePuzzle } from '../engine/puzzleGenerator'
import { solve } from '../engine/solver'
import type { Placement } from '../engine/solver'

// ── Difficulty table (index = round - 1, capped at last entry) ──────────────

export const DIFFICULTY_TABLE: DifficultyConfig[] = [
  { viewDuration: 5000, selectDuration: 15000, gapCount: 2, complexity: 'simple' },
  { viewDuration: 5000, selectDuration: 15000, gapCount: 3, complexity: 'simple' },
  { viewDuration: 4000, selectDuration: 13000, gapCount: 3, complexity: 'simple' },
  { viewDuration: 4000, selectDuration: 13000, gapCount: 4, complexity: 'medium' },
  { viewDuration: 3000, selectDuration: 11000, gapCount: 4, complexity: 'medium' },
  { viewDuration: 3000, selectDuration: 11000, gapCount: 5, complexity: 'medium' },
  { viewDuration: 2500, selectDuration:  9000, gapCount: 5, complexity: 'complex' },
  { viewDuration: 2500, selectDuration:  9000, gapCount: 6, complexity: 'complex' },
  { viewDuration: 2000, selectDuration:  7000, gapCount: 6, complexity: 'complex' },
  { viewDuration: 2000, selectDuration:  7000, gapCount: 7, complexity: 'complex' },
]

function getDifficulty(round: number): DifficultyConfig {
  return DIFFICULTY_TABLE[Math.min(round - 1, DIFFICULTY_TABLE.length - 1)]
}

// ── Scoring constants ────────────────────────────────────────────────────────

const CORRECTNESS_POINTS = 800
const MAX_SPEED_BONUS = 500
const MAX_EFFICIENCY_BONUS = 300

// ── Store interface ──────────────────────────────────────────────────────────

interface GameStore extends GameState {
  // Phase transitions
  startGame: () => void
  endViewing: () => void
  submitSelection: () => void
  finishAutoPlace: () => void
  placePiece: (row: number, col: number) => void
  finishManualPlace: () => void
  nextRound: () => void
  resetGame: () => void

  // Selection actions
  incrementSelection: (pieceType: PieceType) => void
  decrementSelection: (pieceType: PieceType) => void

  // Placement actions
  holdPiece: (pieceType: PieceType, rotation: Rotation) => void
  rotatePiece: () => void
  clearHeld: () => void

  // Internal (exposed for testing)
  _autoPlaceSolution: Placement[] | null
}

const INITIAL_STATE: GameState = {
  phase: 'idle',
  round: 1,
  score: 0,
  lives: 3,
  grid: [],
  gaps: [],
  selection: [],
  carryOvers: [],
  heldPiece: null,
  phaseStartTime: 0,
  phaseDuration: 0,
  roundScore: null,
  difficulty: DIFFICULTY_TABLE[0],
}

export const useGameStore = create<GameStore & { _autoPlaceSolution: Placement[] | null }>((set, get) => ({
  ...INITIAL_STATE,
  _autoPlaceSolution: null,

  resetGame: () => set({ ...INITIAL_STATE, _autoPlaceSolution: null }),

  startGame: () => {
    const { round, carryOvers } = get()
    const difficulty = getDifficulty(round)
    const { grid, gaps } = generatePuzzle(difficulty)

    // Build initial selection with locked carry-overs
    const selection: SelectionEntry[] = carryOvers.map(co => ({
      pieceType: co.pieceType,
      lockedCount: co.count,
      freeCount: 0,
    }))

    set({
      phase: 'viewing',
      grid,
      gaps,
      selection,
      difficulty,
      heldPiece: null,
      roundScore: null,
      phaseStartTime: Date.now(),
      phaseDuration: difficulty.viewDuration,
      _autoPlaceSolution: null,
    })
  },

  endViewing: () => {
    const { difficulty } = get()
    set({
      phase: 'selecting',
      phaseStartTime: Date.now(),
      phaseDuration: difficulty.selectDuration,
    })
  },

  incrementSelection: (pieceType: PieceType) => {
    set(state => {
      const existing = state.selection.find(e => e.pieceType === pieceType)
      if (existing) {
        return {
          selection: state.selection.map(e =>
            e.pieceType === pieceType ? { ...e, freeCount: e.freeCount + 1 } : e
          ),
        }
      }
      return {
        selection: [...state.selection, { pieceType, lockedCount: 0, freeCount: 1 }],
      }
    })
  },

  decrementSelection: (pieceType: PieceType) => {
    set(state => ({
      selection: state.selection
        .map(e =>
          e.pieceType === pieceType
            ? { ...e, freeCount: Math.max(0, e.freeCount - 1) }
            : e
        )
        .filter(e => e.lockedCount > 0 || e.freeCount > 0),
    }))
  },

  submitSelection: () => {
    const { selection, grid, gaps, lives, difficulty, phaseStartTime } = get()

    // Build piece count from selection
    const pieceCount: Partial<Record<PieceType, number>> = {}
    for (const entry of selection) {
      const total = entry.lockedCount + entry.freeCount
      if (total > 0) pieceCount[entry.pieceType] = (pieceCount[entry.pieceType] ?? 0) + total
    }

    const result = solve(pieceCount, grid, gaps)
    const timeElapsed = Date.now() - phaseStartTime
    const timeRemaining = Math.max(0, difficulty.selectDuration - timeElapsed)

    if (result.solvable) {
      // Calculate min pieces for efficiency
      const minPieces = gaps.length
      const selectedPieces = Object.values(pieceCount).reduce((s, n) => s + (n ?? 0), 0)
      const speedBonus = Math.round(MAX_SPEED_BONUS * (timeRemaining / difficulty.selectDuration))
      const efficiencyBonus = Math.round(MAX_EFFICIENCY_BONUS * (minPieces / Math.max(selectedPieces, minPieces)))

      set({
        phase: 'auto-placing',
        _autoPlaceSolution: result.placements,
        roundScore: {
          correctness: CORRECTNESS_POINTS,
          speedBonus,
          efficiencyBonus,
          total: CORRECTNESS_POINTS + speedBonus + efficiencyBonus,
        },
      })
    } else {
      // Incorrect — deduct a life
      const newLives = lives - 1
      const minPieces = gaps.length
      const selectedPieces = Object.values(pieceCount).reduce((s, n) => s + (n ?? 0), 0)
      const efficiencyBonus = Math.round(MAX_EFFICIENCY_BONUS * (minPieces / Math.max(selectedPieces, minPieces)))

      set({
        phase: newLives <= 0 ? 'game-over' : 'manual-placing',
        lives: Math.max(0, newLives),
        roundScore: {
          correctness: 0,
          speedBonus: 0,
          efficiencyBonus,
          total: efficiencyBonus,
        },
      })
    }
  },

  finishAutoPlace: () => {
    const { _autoPlaceSolution, grid, roundScore, score } = get()
    if (!_autoPlaceSolution) return

    // Apply solution to grid
    const newGrid = grid.map(row => row.map(cell => ({ ...cell })))
    for (const placement of _autoPlaceSolution) {
      for (const [r, c] of placement.cells) {
        newGrid[r][c] = { status: 'placed', pieceType: placement.pieceType }
      }
    }

    set({
      phase: 'scoring',
      grid: newGrid,
      score: score + (roundScore?.total ?? 0),
    })
  },

  holdPiece: (pieceType: PieceType, rotation: Rotation) => {
    set({ heldPiece: { pieceType, rotation } })
  },

  rotatePiece: () => {
    set(state => {
      if (!state.heldPiece) return {}
      return { heldPiece: { ...state.heldPiece, rotation: ((state.heldPiece.rotation + 1) % 4) as Rotation } }
    })
  },

  clearHeld: () => set({ heldPiece: null }),

  placePiece: (row: number, col: number) => {
    const { heldPiece, grid, selection } = get()
    if (!heldPiece) return
    const { getRotatedCells } = require('../engine/pieces')
    const cells: [number, number][] = getRotatedCells(heldPiece.pieceType, heldPiece.rotation)

    // Validate all cells fit and are empty
    const valid = cells.every(([dr, dc]) => {
      const r = row + dr
      const c = col + dc
      return r >= 0 && r < 10 && c >= 0 && c < 8 && grid[r][c].status === 'empty'
    })
    if (!valid) return

    const newGrid = grid.map(r => r.map(cell => ({ ...cell })))
    const absoluteCells: [number, number][] = []
    for (const [dr, dc] of cells) {
      newGrid[row + dr][col + dc] = { status: 'placed', pieceType: heldPiece.pieceType }
      absoluteCells.push([row + dr, col + dc])
    }

    // Remove one from selection
    const newSelection = selection.map(e => {
      if (e.pieceType !== heldPiece.pieceType) return e
      if (e.freeCount > 0) return { ...e, freeCount: e.freeCount - 1 }
      if (e.lockedCount > 0) return { ...e, lockedCount: e.lockedCount - 1 }
      return e
    }).filter(e => e.lockedCount > 0 || e.freeCount > 0)

    set({ grid: newGrid, selection: newSelection, heldPiece: null })
  },

  finishManualPlace: () => {
    const { selection, roundScore, score } = get()
    // Any remaining selection entries become carry-overs
    const carryOvers = selection
      .map(e => ({ pieceType: e.pieceType, count: e.lockedCount + e.freeCount }))
      .filter(co => co.count > 0)

    set({
      phase: 'scoring',
      carryOvers,
      score: score + (roundScore?.total ?? 0),
    })
  },

  nextRound: () => {
    set(state => ({ round: state.round + 1 }))
    get().startGame()
  },
}))
```

- [ ] **Step 4: Fix the dynamic require (use static import)**

In `src/store/gameStore.ts`, replace the `require` inside `placePiece` with a top-level import. Add to the top of the file:
```ts
import { getRotatedCells } from '../engine/pieces'
```

Then inside `placePiece`, replace:
```ts
const { getRotatedCells } = require('../engine/pieces')
const cells: [number, number][] = getRotatedCells(heldPiece.pieceType, heldPiece.rotation)
```

With:
```ts
const cells: [number, number][] = getRotatedCells(heldPiece.pieceType, heldPiece.rotation)
```

- [ ] **Step 5: Run tests — expect all pass**

```bash
npm test tests/store/gameStore.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.test.ts
git commit -m "feat: Zustand game store with full phase state machine"
```

---

## Task 6: Grid & PieceShape Components

**Files:**
- Create: `src/components/PieceShape.tsx`
- Create: `src/components/Grid.tsx`
- Create: `src/components/ProgressBar.tsx`

- [ ] **Step 1: PieceShape component**

Create `src/components/PieceShape.tsx`:
```tsx
import { getRotatedCells, getPieceColor } from '../engine/pieces'
import type { PieceType, Rotation } from '../types'

interface Props {
  pieceType: PieceType
  rotation?: Rotation
  cellSize?: number  // px
  dim?: boolean
}

export function PieceShape({ pieceType, rotation = 0, cellSize = 14, dim = false }: Props) {
  const cells = getRotatedCells(pieceType, rotation)
  const maxRow = Math.max(...cells.map(([r]) => r))
  const maxCol = Math.max(...cells.map(([, c]) => c))
  const color = getPieceColor(pieceType)
  const occupied = new Set(cells.map(([r, c]) => `${r},${c}`))

  return (
    <div
      className="inline-grid"
      style={{
        gridTemplateColumns: `repeat(${maxCol + 1}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${maxRow + 1}, ${cellSize}px)`,
        gap: '2px',
        opacity: dim ? 0.4 : 1,
      }}
    >
      {Array.from({ length: (maxRow + 1) * (maxCol + 1) }, (_, i) => {
        const r = Math.floor(i / (maxCol + 1))
        const c = i % (maxCol + 1)
        return (
          <div
            key={i}
            className={occupied.has(`${r},${c}`) ? `${color} rounded-sm` : ''}
            style={{ width: cellSize, height: cellSize }}
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Grid component**

Create `src/components/Grid.tsx`:
```tsx
import { useGameStore } from '../store/gameStore'
import { getPieceColor } from '../engine/pieces'
import { ROWS, COLS } from '../types'

interface Props {
  onCellClick?: (row: number, col: number) => void
  highlightCells?: [number, number][]  // cells to highlight (placement preview)
}

export function Grid({ onCellClick, highlightCells = [] }: Props) {
  const grid = useGameStore(s => s.grid)
  const heldPiece = useGameStore(s => s.heldPiece)
  const highlighted = new Set(highlightCells.map(([r, c]) => `${r},${c}`))

  return (
    <div
      className="inline-grid gap-[2px] p-3 bg-gray-900 rounded-xl"
      style={{ gridTemplateColumns: `repeat(${COLS}, 28px)` }}
    >
      {Array.from({ length: ROWS * COLS }, (_, i) => {
        const row = Math.floor(i / COLS)
        const col = i % COLS
        const cell = grid[row]?.[col]
        const isHighlight = highlighted.has(`${row},${col}`)

        let className = 'w-7 h-7 rounded-sm '
        if (cell?.status === 'filled') {
          className += 'bg-slate-600'
        } else if (cell?.status === 'placed' && cell.pieceType) {
          className += getPieceColor(cell.pieceType)
        } else if (isHighlight) {
          className += 'bg-blue-400/50 border-2 border-blue-400'
        } else {
          className += 'bg-gray-800 border border-gray-600'
        }

        if (onCellClick && heldPiece && cell?.status === 'empty') {
          className += ' cursor-pointer hover:bg-blue-400/30'
        }

        return (
          <div
            key={i}
            className={className}
            onClick={() => onCellClick?.(row, col)}
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: ProgressBar component**

Create `src/components/ProgressBar.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'

interface Props {
  startTime: number   // Date.now() when phase started
  duration: number    // ms total
  color?: string      // Tailwind bg class
}

export function ProgressBar({ startTime, duration, color = 'bg-cyan-400' }: Props) {
  const [progress, setProgress] = useState(1)  // 1 = full, 0 = empty
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startTime
      const p = Math.max(0, 1 - elapsed / duration)
      setProgress(p)
      if (p > 0) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [startTime, duration])

  return (
    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-none`}
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Smoke-test in browser**

In `src/App.tsx`:
```tsx
import { PieceShape } from './components/PieceShape'
import { PIECE_DEFINITIONS } from './engine/pieces'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Piece Shapes</h1>
      <div className="flex gap-4 flex-wrap">
        {PIECE_DEFINITIONS.map(p => (
          <div key={p.type} className="flex flex-col items-center gap-2">
            <PieceShape pieceType={p.type} cellSize={20} />
            <span className="text-xs text-gray-400">{p.type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Run `npm run dev` — all 8 piece shapes should render correctly.

- [ ] **Step 5: Commit**

```bash
git add src/components/PieceShape.tsx src/components/Grid.tsx src/components/ProgressBar.tsx src/App.tsx
git commit -m "feat: PieceShape, Grid, and ProgressBar components"
```

---

## Task 7: Viewing & Selecting Phase UIs

**Files:**
- Create: `src/components/ViewingPhase.tsx`
- Create: `src/components/SelectingPhase.tsx`

- [ ] **Step 1: ViewingPhase**

Create `src/components/ViewingPhase.tsx`:
```tsx
import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { Grid } from './Grid'
import { ProgressBar } from './ProgressBar'

export function ViewingPhase() {
  const { endViewing, phaseStartTime, phaseDuration } = useGameStore(s => ({
    endViewing: s.endViewing,
    phaseStartTime: s.phaseStartTime,
    phaseDuration: s.phaseDuration,
  }))

  useEffect(() => {
    const timer = setTimeout(endViewing, phaseDuration)
    return () => clearTimeout(timer)
  }, [phaseDuration, endViewing])

  return (
    <div className="flex flex-col items-center gap-4">
      <ProgressBar startTime={phaseStartTime} duration={phaseDuration} color="bg-cyan-400" />
      <Grid />
      <p className="text-sm text-slate-400 tracking-widest uppercase">Memorize the gaps</p>
    </div>
  )
}
```

- [ ] **Step 2: SelectingPhase**

Create `src/components/SelectingPhase.tsx`:
```tsx
import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { PIECE_DEFINITIONS } from '../engine/pieces'
import { PieceShape } from './PieceShape'
import { ProgressBar } from './ProgressBar'
import type { PieceType } from '../types'

export function SelectingPhase() {
  const {
    selection, incrementSelection, decrementSelection,
    submitSelection, phaseStartTime, phaseDuration,
  } = useGameStore(s => ({
    selection: s.selection,
    incrementSelection: s.incrementSelection,
    decrementSelection: s.decrementSelection,
    submitSelection: s.submitSelection,
    phaseStartTime: s.phaseStartTime,
    phaseDuration: s.phaseDuration,
  }))

  useEffect(() => {
    const timer = setTimeout(submitSelection, phaseDuration)
    return () => clearTimeout(timer)
  }, [phaseDuration, submitSelection])

  const getEntry = (type: PieceType) => selection.find(e => e.pieceType === type)

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      <ProgressBar startTime={phaseStartTime} duration={phaseDuration} color="bg-green-400" />

      {/* Selection box */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">Your Selection</span>
          <span className="text-xs text-gray-600">tap selected to decrement</span>
        </div>
        <div className="flex gap-2 flex-wrap min-h-[52px] items-center">
          {selection.filter(e => e.lockedCount + e.freeCount > 0).map(entry => {
            const label = entry.lockedCount > 0
              ? `🔒×${entry.lockedCount}${entry.freeCount > 0 ? ` +${entry.freeCount}` : ''}`
              : `×${entry.freeCount}`
            const isLocked = entry.lockedCount > 0 && entry.freeCount === 0

            return (
              <button
                key={entry.pieceType}
                onClick={() => !isLocked && decrementSelection(entry.pieceType)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs
                  ${entry.lockedCount > 0
                    ? 'border-red-500 bg-red-950 text-red-300 cursor-not-allowed'
                    : 'border-blue-500 bg-blue-950 text-blue-300 cursor-pointer hover:bg-blue-900'
                  }`}
              >
                <PieceShape pieceType={entry.pieceType} cellSize={11} />
                <span>{label}</span>
              </button>
            )
          })}
          {selection.length === 0 && (
            <span className="text-xs text-gray-600 italic">No pieces selected</span>
          )}
        </div>
      </div>

      {/* Piece menu */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">Pieces</span>
          <span className="text-xs text-gray-600">tap to increment</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {PIECE_DEFINITIONS.map(def => (
            <button
              key={def.type}
              onClick={() => incrementSelection(def.type)}
              className="flex flex-col items-center gap-1 p-2 bg-gray-800 border border-gray-700
                rounded-lg hover:border-gray-500 hover:bg-gray-750 cursor-pointer"
            >
              <PieceShape pieceType={def.type} cellSize={11} />
              <span className="text-[10px] text-gray-500">{def.type}</span>
            </button>
          ))}
          <button
            onClick={submitSelection}
            className="flex items-center justify-center p-2 bg-green-950 border-2 border-green-600
              rounded-lg text-green-400 font-bold text-xs hover:bg-green-900 cursor-pointer"
          >
            Done ✓
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire into App.tsx temporarily for smoke-test**

In `src/App.tsx`:
```tsx
import { useGameStore } from './store/gameStore'
import { ViewingPhase } from './components/ViewingPhase'
import { SelectingPhase } from './components/SelectingPhase'

export default function App() {
  const { phase, startGame } = useGameStore(s => ({ phase: s.phase, startGame: s.startGame }))

  if (phase === 'idle') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <button onClick={startGame} className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold">
        Start Game
      </button>
    </div>
  )
  if (phase === 'viewing') return <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4"><ViewingPhase /></div>
  if (phase === 'selecting') return <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4"><SelectingPhase /></div>
  return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Phase: {phase}</div>
}
```

Run `npm run dev`, play through viewing → selecting phases. Confirm grid shows, timer bar drains, piece menu works.

- [ ] **Step 4: Commit**

```bash
git add src/components/ViewingPhase.tsx src/components/SelectingPhase.tsx src/App.tsx
git commit -m "feat: ViewingPhase and SelectingPhase UI components"
```

---

## Task 8: Manual Placement & Scoring UIs

**Files:**
- Create: `src/components/PlacingPhase.tsx`
- Create: `src/components/ScoringPhase.tsx`

- [ ] **Step 1: PlacingPhase**

Create `src/components/PlacingPhase.tsx`:
```tsx
import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Grid } from './Grid'
import { PieceShape } from './PieceShape'
import { getRotatedCells } from '../engine/pieces'
import type { PieceType, Rotation } from '../types'

export function PlacingPhase() {
  const {
    selection, grid, heldPiece,
    holdPiece, rotatePiece, clearHeld, placePiece, finishManualPlace,
  } = useGameStore(s => ({
    selection: s.selection,
    grid: s.grid,
    heldPiece: s.heldPiece,
    holdPiece: s.holdPiece,
    rotatePiece: s.rotatePiece,
    clearHeld: s.clearHeld,
    placePiece: s.placePiece,
    finishManualPlace: s.finishManualPlace,
  }))

  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null)

  // Compute preview cells when hovering over grid
  const previewCells: [number, number][] = []
  if (heldPiece && hoverCell) {
    const cells = getRotatedCells(heldPiece.pieceType, heldPiece.rotation)
    for (const [dr, dc] of cells) {
      const r = hoverCell[0] + dr
      const c = hoverCell[1] + dc
      if (r >= 0 && r < 10 && c >= 0 && c < 8 && grid[r][c].status === 'empty') {
        previewCells.push([r, c])
      }
    }
  }

  const hasEmptyGaps = grid.some(row => row.some(c => c.status === 'empty'))
  const hasSelectionLeft = selection.some(e => e.lockedCount + e.freeCount > 0)

  const handleCellClick = (row: number, col: number) => {
    if (!heldPiece) return
    placePiece(row, col)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-xs text-gray-500 text-center">
        Place your pieces — click piece to hold · click grid to place · R to rotate
      </div>

      <div
        onKeyDown={e => e.key === 'r' || e.key === 'R' ? rotatePiece() : null}
        tabIndex={0}
        className="outline-none"
      >
        <Grid onCellClick={handleCellClick} highlightCells={previewCells} />
      </div>

      {/* Piece tray */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 w-full max-w-sm">
        <p className="text-xs text-gray-600 mb-2">Tray</p>
        <div className="flex gap-2 flex-wrap">
          {selection.filter(e => e.lockedCount + e.freeCount > 0).map(entry => {
            const isHeld = heldPiece?.pieceType === entry.pieceType
            const rotation: Rotation = isHeld ? (heldPiece?.rotation ?? 0) : 0
            return (
              <button
                key={entry.pieceType}
                onClick={() => isHeld ? clearHeld() : holdPiece(entry.pieceType, 0)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs
                  ${isHeld
                    ? 'border-blue-400 bg-blue-950 shadow-[0_0_8px] shadow-blue-400'
                    : 'border-gray-600 bg-gray-800 hover:border-gray-400'
                  }`}
              >
                <PieceShape pieceType={entry.pieceType} rotation={rotation} cellSize={13} />
                <span className="text-[10px] text-gray-400">
                  {entry.lockedCount > 0 ? `🔒×${entry.lockedCount}` : ''}
                  {entry.freeCount > 0 ? ` ×${entry.freeCount}` : ''}
                </span>
              </button>
            )
          })}
        </div>
        {heldPiece && (
          <p className="text-xs text-blue-400 mt-2">Press R to rotate · click a gap to place</p>
        )}
      </div>

      {(!hasEmptyGaps || !hasSelectionLeft) && (
        <button
          onClick={finishManualPlace}
          className="px-6 py-2 bg-green-800 border-2 border-green-500 text-green-300 rounded-xl font-bold"
        >
          Finish Round →
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: ScoringPhase**

Create `src/components/ScoringPhase.tsx`:
```tsx
import { useGameStore } from '../store/gameStore'

export function ScoringPhase() {
  const { roundScore, score, round, lives, nextRound, resetGame, phase } = useGameStore(s => ({
    roundScore: s.roundScore,
    score: s.score,
    round: s.round,
    lives: s.lives,
    nextRound: s.nextRound,
    resetGame: s.resetGame,
    phase: s.phase,
  }))

  const isGameOver = phase === 'game-over'

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      <h2 className="text-lg font-bold text-white text-center">
        {isGameOver ? 'Game Over' : `Round ${round} Complete`}
      </h2>

      {roundScore && (
        <div className="flex flex-col gap-2">
          <ScoreRow label="✓ Correct selection" value={roundScore.correctness} color="text-green-400 bg-green-950" />
          <ScoreRow label="⚡ Speed bonus" value={roundScore.speedBonus} color="text-yellow-400 bg-yellow-950" />
          <ScoreRow label="◆ Efficiency bonus" value={roundScore.efficiencyBonus} color="text-cyan-400 bg-cyan-950" />
          <div className="border-t border-gray-700 pt-2 flex justify-between px-3">
            <span className="font-bold text-white">Round total</span>
            <span className="font-bold text-white">+{roundScore.total.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl p-4 text-center">
        <p className="text-xs text-gray-500 mb-1">Total Score</p>
        <p className="text-3xl font-bold text-yellow-400">{score.toLocaleString()}</p>
      </div>

      {isGameOver ? (
        <button
          onClick={resetGame}
          className="w-full py-3 bg-red-900 border-2 border-red-500 text-red-300 rounded-xl font-bold"
        >
          Play Again
        </button>
      ) : (
        <button
          onClick={nextRound}
          className="w-full py-3 bg-green-900 border-2 border-green-500 text-green-300 rounded-xl font-bold"
        >
          Next Round →
        </button>
      )}
    </div>
  )
}

function ScoreRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex justify-between items-center rounded-lg px-3 py-2 ${color}`}>
      <span className="text-sm">{label}</span>
      <span className="font-bold">+{value.toLocaleString()}</span>
    </div>
  )
}
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/PlacingPhase.tsx src/components/ScoringPhase.tsx
git commit -m "feat: PlacingPhase and ScoringPhase UI components"
```

---

## Task 9: GameShell Integration

**Files:**
- Create: `src/components/GameShell.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Handle auto-place transition in store**

The `auto-placing` phase needs to trigger `finishAutoPlace` after a short animation delay. Add this effect inside `GameShell`.

- [ ] **Step 2: Create GameShell**

Create `src/components/GameShell.tsx`:
```tsx
import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { ViewingPhase } from './ViewingPhase'
import { SelectingPhase } from './SelectingPhase'
import { PlacingPhase } from './PlacingPhase'
import { ScoringPhase } from './ScoringPhase'

function Hearts({ count }: { count: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map(i => (
        <span key={i} className={i <= count ? 'text-red-500' : 'text-gray-700'}>♥</span>
      ))}
    </div>
  )
}

export function GameShell() {
  const { phase, round, score, lives, startGame, finishAutoPlace } = useGameStore(s => ({
    phase: s.phase,
    round: s.round,
    score: s.score,
    lives: s.lives,
    startGame: s.startGame,
    finishAutoPlace: s.finishAutoPlace,
  }))

  // Auto-place: brief delay then transition to scoring
  useEffect(() => {
    if (phase !== 'auto-placing') return
    const timer = setTimeout(finishAutoPlace, 800)
    return () => clearTimeout(timer)
  }, [phase, finishAutoPlace])

  if (phase === 'idle') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Gap Memory</h1>
          <p className="text-gray-400 mb-8">Memorize the gaps. Fill them fast.</p>
          <button
            onClick={startGame}
            className="px-8 py-4 bg-green-700 hover:bg-green-600 text-white rounded-2xl font-bold text-lg"
          >
            Start Game
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
        <span className="text-sm text-gray-400">Round <strong className="text-white">{round}</strong></span>
        <span className="text-sm text-yellow-400 font-bold">{score.toLocaleString()}</span>
        <Hearts count={lives} />
      </div>

      {/* Phase content */}
      <div className="flex-1 flex items-center justify-center p-4">
        {phase === 'viewing'       && <ViewingPhase />}
        {phase === 'selecting'     && <SelectingPhase />}
        {phase === 'auto-placing'  && (
          <div className="text-green-400 text-xl font-bold animate-pulse">✓ Auto-placing...</div>
        )}
        {phase === 'manual-placing' && <PlacingPhase />}
        {(phase === 'scoring' || phase === 'game-over') && <ScoringPhase />}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update App.tsx**

Replace `src/App.tsx` contents:
```tsx
import { GameShell } from './components/GameShell'

export default function App() {
  return <GameShell />
}
```

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Manual end-to-end playthrough**

```bash
npm run dev
```

Play through a complete game:
1. Click "Start Game" → grid appears, bar drains, grid hides ✓
2. Select pieces → click Done ✓
3. If correct → brief "Auto-placing" message → scoring screen ✓
4. If incorrect → grid reappears, tray visible, can click piece then grid cell ✓
5. Press R to rotate piece → piece shape changes ✓
6. Scoring screen shows breakdown → Next Round works ✓
7. After 3 incorrect selections → Game Over appears ✓

- [ ] **Step 6: Commit**

```bash
git add src/components/GameShell.tsx src/App.tsx
git commit -m "feat: GameShell integration — full POC playable end-to-end"
```

---

## Self-Review Notes

- All 8 piece types including SINGLE (temptation) ✓
- Carry-over pieces locked in selection box (lockedCount) ✓
- Strikes are binary (any incorrect selection = 1 strike, regardless of magnitude) ✓
- 3 lives = game over ✓
- Speed bonus only on correct selection ✓
- Efficiency bonus on both correct and incorrect (using total selected including carry-overs) ✓
- Progress bars — no numeric countdown shown to player ✓
- Rotation during placement only (R key + solver tries all rotations) ✓
- Drag-and-drop deferred to post-POC ✓
- Row-clears not implemented (correctly omitted per spec) ✓
