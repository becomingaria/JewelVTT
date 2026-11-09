import type { Point } from "../types/humbug.types"
import type { GridShape } from "../utils/board-styles"
import { HEX_R, HEX_ROW, HEX_W, nearestHexCenter } from "../utils/humbug.utils"

/*
 * One cell addressing scheme for square and hex grids, shared by fog,
 * dungeon floors, hex terrain, templates and measuring.
 *
 * Square: cell (col,row) covers [col*32, col*32+32) × [row*32, row*32+32).
 * Hex: pointy-top, "odd-r" offset rows (odd rows shifted right by half a
 *      hex), matching the board's hex drawing and nearestHexCenter().
 */

export const SQUARE = 32

export interface Cell {
    col: number
    row: number
}

export type CellKey = string

export const cellKey = (c: Cell): CellKey => `${c.col},${c.row}`

export function parseCellKey(k: CellKey): Cell {
    const [col, row] = k.split(",").map(Number)
    return { col, row }
}

const isOdd = (n: number) => ((n % 2) + 2) % 2 === 1

/** The cell containing a world point */
export function cellAt(p: Point, shape: GridShape): Cell {
    if (shape === "hex") {
        const c = nearestHexCenter(p.x, p.y)
        const shift = isOdd(c.row) ? HEX_W / 2 : 0
        return { col: Math.round((c.x - shift) / HEX_W), row: c.row }
    }
    return { col: Math.floor(p.x / SQUARE), row: Math.floor(p.y / SQUARE) }
}

/** World centre of a cell */
export function cellCenter(c: Cell, shape: GridShape): Point {
    if (shape === "hex") {
        return { x: c.col * HEX_W + (isOdd(c.row) ? HEX_W / 2 : 0), y: c.row * HEX_ROW }
    }
    return { x: c.col * SQUARE + SQUARE / 2, y: c.row * SQUARE + SQUARE / 2 }
}

/** World-space corners of a cell (4 for squares, 6 for hexes, clockwise) */
export function cellPolygon(c: Cell, shape: GridShape): Point[] {
    if (shape === "hex") {
        const { x, y } = cellCenter(c, shape)
        return [-90, -30, 30, 90, 150, 210].map((deg) => {
            const a = (deg * Math.PI) / 180
            return { x: x + HEX_R * Math.cos(a), y: y + HEX_R * Math.sin(a) }
        })
    }
    const x = c.col * SQUARE
    const y = c.row * SQUARE
    return [
        { x, y },
        { x: x + SQUARE, y },
        { x: x + SQUARE, y: y + SQUARE },
        { x, y: y + SQUARE },
    ]
}

// odd-r offset -> cube coordinates
function toCube(c: Cell) {
    const x = c.col - (c.row - (isOdd(c.row) ? 1 : 0)) / 2
    const z = c.row
    return { x, y: -x - z, z }
}

/**
 * Distance in cells. Hex: true hex steps. Square: "every other diagonal
 * costs double" is a rules choice, so this returns Chebyshev (diagonal = 1);
 * measure tools may apply their own rule on top.
 */
export function cellDistance(a: Cell, b: Cell, shape: GridShape): number {
    if (shape === "hex") {
        const p = toCube(a)
        const q = toCube(b)
        return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.z - q.z))
    }
    return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row))
}

/** Edge-sharing neighbours (4 for squares, 6 for hexes) */
export function cellNeighbors(c: Cell, shape: GridShape): Cell[] {
    if (shape === "hex") {
        const odd = isOdd(c.row)
        const d = odd
            ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]
            : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]]
        return d.map(([dc, dr]) => ({ col: c.col + dc, row: c.row + dr }))
    }
    return [
        { col: c.col + 1, row: c.row },
        { col: c.col - 1, row: c.row },
        { col: c.col, row: c.row + 1 },
        { col: c.col, row: c.row - 1 },
    ]
}

/** Every cell within `radius` cells of a centre cell (inclusive) */
export function cellsWithin(center: Cell, radius: number, shape: GridShape): Cell[] {
    const out: Cell[] = []
    const r = Math.ceil(radius)
    for (let row = center.row - r; row <= center.row + r; row++) {
        for (let col = center.col - r - 1; col <= center.col + r + 1; col++) {
            const c = { col, row }
            if (cellDistance(center, c, shape) <= radius) out.push(c)
        }
    }
    return out
}

/** Cells whose centres fall inside a world-space rectangle */
export function cellsInRect(a: Point, b: Point, shape: GridShape): Cell[] {
    const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x)
    const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y)
    const lo = cellAt({ x: x1, y: y1 }, shape)
    const hi = cellAt({ x: x2, y: y2 }, shape)
    const out: Cell[] = []
    for (let row = lo.row - 1; row <= hi.row + 1; row++) {
        for (let col = lo.col - 1; col <= hi.col + 1; col++) {
            const p = cellCenter({ col, row }, shape)
            if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) out.push({ col, row })
        }
    }
    return out
}
