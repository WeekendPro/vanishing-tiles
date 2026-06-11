export type DistrictSlug = 'the_hollows' | 'the_stacks' | 'the_grid'

export interface StationCoord { x: number; y: number; interchange?: boolean }

// Transit-map coordinate space. L1 sits at the bottom, L15 at the top (ascending climb).
export const VIEWBOX = { w: 390, h: 1120 } as const

export const STATIONS: Record<number, StationCoord> = {
  1:  { x: 70,  y: 1050 },
  2:  { x: 70,  y: 960 },
  3:  { x: 140, y: 890 },
  4:  { x: 140, y: 800 },
  5:  { x: 80,  y: 730, interchange: true },
  6:  { x: 160, y: 660 },
  7:  { x: 160, y: 570 },
  8:  { x: 240, y: 510 },
  9:  { x: 240, y: 430 },
  10: { x: 170, y: 370, interchange: true },
  11: { x: 260, y: 300 },
  12: { x: 260, y: 220 },
  13: { x: 320, y: 170 },
  14: { x: 320, y: 100 },
  15: { x: 250, y: 60 },
}

export const LINE_COLOR: Record<DistrictSlug, string> = {
  the_hollows: '#22d3ee',
  the_stacks: '#ff2d95',
  the_grid: '#39d98a',
}

export const CONNECTOR_COLOR = '#33406b'

export interface LineDef {
  slug: DistrictSlug
  color: string
  path: string        // the line itself (through its 5 stations)
  connector?: string  // dashed transfer from the previous line's interchange
}

// Paths trace the station coords above, in display order.
export const LINES: LineDef[] = [
  {
    slug: 'the_hollows',
    color: LINE_COLOR.the_hollows,
    path: 'M70,1050 L70,960 L140,890 L140,800 L80,730',
  },
  {
    slug: 'the_stacks',
    color: LINE_COLOR.the_stacks,
    path: 'M160,660 L160,570 L240,510 L240,430 L170,370',
    connector: 'M80,730 L160,660',
  },
  {
    slug: 'the_grid',
    color: LINE_COLOR.the_grid,
    path: 'M260,300 L260,220 L320,170 L320,100 L250,60',
    connector: 'M170,370 L260,300',
  },
]
