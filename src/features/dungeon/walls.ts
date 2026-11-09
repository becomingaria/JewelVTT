import { cellKey, SQUARE } from "../grid"
import { hashCell, mulberry32 } from "./rng"

/*
 * Floor geometry: walls traced along the floor boundary and the
 * cross-hatched band outside them. Pure functions (no DOM), shared by the
 * board underlay and the generator minimap.
 *
 * Floor = a set of square-grid cell keys (grid.ts cellKey: "col,row").
 */

export type FloorSet = ReadonlySet<string>

/** A straight wall run along grid lines, in cell units (x = col line, y = row line) */
export interface WallSeg {
    x1: number
    y1: number
    x2: number
    y2: number
}

const has = (floor: FloorSet, col: number, row: number) => floor.has(cellKey({ col, row }))

/**
 * Wall runs owned by the cell range [c0, c1) × [r0, r1).
 *
 * A range owns the horizontal grid lines y = r0..r1-1 and the vertical
 * lines x = c0..c1-1 (the top and left edges of its cells), so adjacent
 * ranges (render chunks) partition the walls exactly: no gaps, no
 * duplicates. Collinear edges are merged into long runs.
 */
export function wallSegments(floor: FloorSet, c0: number, r0: number, c1: number, r1: number): WallSeg[] {
    const out: WallSeg[] = []
    // Horizontal: the edge above cell (c, r) is a wall when exactly one side is floor
    for (let r = r0; r < r1; r++) {
        let start: number | null = null
        for (let c = c0; c <= c1; c++) {
            const wall = c < c1 && has(floor, c, r) !== has(floor, c, r - 1)
            if (wall && start === null) start = c
            if (!wall && start !== null) {
                out.push({ x1: start, y1: r, x2: c, y2: r })
                start = null
            }
        }
    }
    // Vertical: the edge left of cell (c, r)
    for (let c = c0; c < c1; c++) {
        let start: number | null = null
        for (let r = r0; r <= r1; r++) {
            const wall = r < r1 && has(floor, c, r) !== has(floor, c - 1, r)
            if (wall && start === null) start = r
            if (!wall && start !== null) {
                out.push({ x1: c, y1: start, x2: c, y2: r })
                start = null
            }
        }
    }
    return out
}

export interface CellBounds {
    minCol: number
    minRow: number
    maxCol: number
    maxRow: number
}

export function floorBounds(floor: FloorSet): CellBounds | null {
    if (!floor.size) return null
    let minCol = Infinity, minRow = Infinity, maxCol = -Infinity, maxRow = -Infinity
    for (const k of floor) {
        const i = k.indexOf(",")
        const col = Number(k.slice(0, i))
        const row = Number(k.slice(i + 1))
        if (col < minCol) minCol = col
        if (col > maxCol) maxCol = col
        if (row < minRow) minRow = row
        if (row > maxRow) maxRow = row
    }
    return { minCol, minRow, maxCol, maxRow }
}

/** Every wall run of a whole floor (minimaps, tests) */
export function traceWalls(floor: FloorSet): WallSeg[] {
    const b = floorBounds(floor)
    if (!b) return []
    // +2: the bottom/right edges of the last cells sit on lines max+1
    return wallSegments(floor, b.minCol, b.minRow, b.maxCol + 2, b.maxRow + 2)
}

// ------------------------------------------------------------- hatching
/** Cells this far (Chebyshev) outside the floor are always hatched */
export const HATCH_SOLID = 1
/** ...and cells this far are hatched by a per-cell coin flip (ragged edge) */
export const HATCH_RAGGED = 2
const RAGGED_KEEP = 0.6

/**
 * Distance (1 or 2) from a non-floor cell to the nearest floor cell, or 0
 * when the cell is floor or too far away to be hatched.
 */
export function hatchDistance(floor: FloorSet, col: number, row: number): number {
    if (has(floor, col, row)) return 0
    let best = 0
    for (let dr = -HATCH_RAGGED; dr <= HATCH_RAGGED; dr++)
        for (let dc = -HATCH_RAGGED; dc <= HATCH_RAGGED; dc++) {
            if (!dr && !dc) continue
            if (!has(floor, col + dc, row + dr)) continue
            const d = Math.max(Math.abs(dc), Math.abs(dr))
            if (!best || d < best) best = d
            if (best === 1) return 1
        }
    return best
}

/** Is this cell in the hatched band? Deterministic per cell. */
export function isHatched(floor: FloorSet, col: number, row: number): boolean {
    const d = hatchDistance(floor, col, row)
    if (d === HATCH_SOLID) return true
    if (d === HATCH_RAGGED) return hashCell(col, row, 7) / 4294967296 < RAGGED_KEEP
    return false
}

/** Clip the infinite line p + t·d to a box; returns the segment or null */
function clipLine(
    px: number, py: number, dx: number, dy: number,
    x0: number, y0: number, x1: number, y1: number
): [number, number, number, number] | null {
    let t0 = -Infinity
    let t1 = Infinity
    const edges: [number, number][] = [
        [-dx, px - x0],
        [dx, x1 - px],
        [-dy, py - y0],
        [dy, y1 - py],
    ]
    for (const [p, q] of edges) {
        if (Math.abs(p) < 1e-9) {
            if (q < 0) return null
            continue
        }
        const t = q / p
        if (p < 0) t0 = Math.max(t0, t)
        else t1 = Math.min(t1, t)
    }
    if (t0 >= t1) return null
    return [px + t0 * dx, py + t0 * dy, px + t1 * dx, py + t1 * dy]
}

/**
 * Hand-inked hatch strokes for one cell, in world units: a little clump of
 * 3-5 roughly parallel lines at a per-cell angle, kept inside the cell with
 * a small margin so neighbouring clumps read as separate pen work.
 */
export function hatchStrokes(col: number, row: number): [number, number, number, number][] {
    const rng = mulberry32(hashCell(col, row, 3))
    const x0 = col * SQUARE
    const y0 = row * SQUARE
    const inset = 1.5
    const angle = rng() * Math.PI
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    const n = 3 + Math.floor(rng() * 3)
    const spacing = (SQUARE - 2 * inset) / (n + 0.4)
    const cx = x0 + SQUARE / 2 + (rng() - 0.5) * 3
    const cy = y0 + SQUARE / 2 + (rng() - 0.5) * 3
    const out: [number, number, number, number][] = []
    for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * spacing + (rng() - 0.5) * 1.6
        // shift perpendicular to the stroke direction
        const px = cx - dy * off
        const py = cy + dx * off
        const seg = clipLine(px, py, dx, dy, x0 + inset, y0 + inset, x0 + SQUARE - inset, y0 + SQUARE - inset)
        if (!seg) continue
        // Lift the pen a little early/late, like a quick hand stroke
        const len = Math.hypot(seg[2] - seg[0], seg[3] - seg[1])
        if (len < 4) continue
        const a = rng() * Math.min(3, len * 0.15)
        const b = rng() * Math.min(3, len * 0.15)
        out.push([seg[0] + dx * a, seg[1] + dy * a, seg[2] - dx * b, seg[3] - dy * b])
    }
    return out
}
