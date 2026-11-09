import type { Point } from "../../types/humbug.types"
import type { GridShape } from "../../utils/board-styles"
import { SQUARE, cellAt, cellCenter, cellDistance, cellsInRect, type Cell } from "../grid"

/*
 * Pure geometry for the measure feature: path distances, area templates
 * and token size categories. No React, no stores, so it can be checked
 * with a plain node script.
 *
 * One cell is SQUARE (32) world units on both grids (hexes are 32 wide).
 */

// ------------------------------------------------------------ measuring
/** "alternate": every second diagonal counts double. "simple": Chebyshev. */
export type DiagonalRule = "alternate" | "simple"

/** World point -> centre of the cell it falls in */
export function snapToCellCenter(p: Point, shape: GridShape): Point {
    return cellCenter(cellAt(p, shape), shape)
}

/**
 * Cells travelled along a path of waypoints, leg by leg. On square grids
 * the diagonal count carries across legs, so the alternating rule stays
 * fair however the path is split up.
 */
export function pathDistance(
    points: Point[],
    shape: GridShape,
    rule: DiagonalRule
): { total: number; legs: number[] } {
    const legs: number[] = []
    let diagonals = 0
    for (let i = 1; i < points.length; i++) {
        const a = cellAt(points[i - 1], shape)
        const b = cellAt(points[i], shape)
        if (shape === "hex" || rule === "simple") {
            legs.push(cellDistance(a, b, shape))
            continue
        }
        const dx = Math.abs(a.col - b.col)
        const dy = Math.abs(a.row - b.row)
        const diag = Math.min(dx, dy)
        const straight = Math.max(dx, dy) - diag
        // Diagonals 2, 4, 6... (counted over the whole path) cost double
        const extra = Math.floor((diagonals + diag) / 2) - Math.floor(diagonals / 2)
        diagonals += diag
        legs.push(straight + diag + extra)
    }
    return { total: legs.reduce((s, n) => s + n, 0), legs }
}

/** Drop consecutive points that land in the same cell */
export function dedupeCells(points: Point[], shape: GridShape): Point[] {
    const out: Point[] = []
    for (const p of points) {
        const prev = out[out.length - 1]
        if (prev) {
            const a = cellAt(prev, shape)
            const b = cellAt(p, shape)
            if (a.col === b.col && a.row === b.row) continue
        }
        out.push(p)
    }
    return out
}

/** "35 ft", "1.5 mi": whole numbers stay whole */
export function formatUnits(value: number, unit: string): string {
    const v = Math.round(value * 10) / 10
    return `${v.toLocaleString()} ${unit}`
}

export const formatCells = (cells: number, shape: GridShape) =>
    `${cells} ${shape === "hex" ? (cells === 1 ? "hex" : "hexes") : cells === 1 ? "square" : "squares"}`

// ------------------------------------------------------------ templates
export type TemplateShape = "cone" | "line" | "burst" | "square"

export interface Template {
    id: string
    shape: TemplateShape
    /** Length (cone, line), radius (burst) or side (square), in map units */
    size: number
    /** Cone/line: the point it starts from. Burst/square: the centre. */
    origin: Point
    /** Degrees, 0 = pointing right (east), clockwise */
    angle: number
}

export const TEMPLATE_SHAPES: { id: TemplateShape; label: string; sizeLabel: string }[] = [
    { id: "cone", label: "Cone", sizeLabel: "length" },
    { id: "line", label: "Line", sizeLabel: "length" },
    { id: "burst", label: "Burst", sizeLabel: "radius" },
    { id: "square", label: "Square", sizeLabel: "side" },
]

/** Cone and line aim; a square turns around its centre; a burst can't turn */
export const canRotate = (shape: TemplateShape) => shape !== "burst"

/** Template size in world units for a map scale */
export const templateWorldSize = (t: Pick<Template, "size">, perCell: number) =>
    (t.size / perCell) * SQUARE

const EPS = 0.01
const rad = (deg: number) => (deg * Math.PI) / 180

/** A point in the template's own frame: u along the aim, v across it */
function local(t: Template, p: Point) {
    const a = rad(t.angle)
    const dx = p.x - t.origin.x
    const dy = p.y - t.origin.y
    return { u: dx * Math.cos(a) + dy * Math.sin(a), v: -dx * Math.sin(a) + dy * Math.cos(a) }
}

function toWorld(t: Template, u: number, v: number): Point {
    const a = rad(t.angle)
    return {
        x: t.origin.x + u * Math.cos(a) - v * Math.sin(a),
        y: t.origin.y + u * Math.sin(a) + v * Math.cos(a),
    }
}

/**
 * Is a world point inside the template? `tol` grows the shape (world
 * units) for hit-testing. Cones are as wide at the end as they are long;
 * lines are one cell wide. The cone/line origin cell itself is left out.
 */
export function templateContains(t: Template, p: Point, perCell: number, tol = 0): boolean {
    const L = templateWorldSize(t, perCell)
    const { u, v } = local(t, p)
    switch (t.shape) {
        case "burst":
            return u * u + v * v <= (L + tol + EPS) ** 2
        case "square":
            return Math.abs(u) <= L / 2 + tol + EPS && Math.abs(v) <= L / 2 + tol + EPS
        case "line":
            return u > EPS - tol && u <= L + tol + EPS && Math.abs(v) <= SQUARE / 2 + tol + EPS
        case "cone":
            return u > EPS - tol && u <= L + tol + EPS && Math.abs(v) <= u / 2 + tol + EPS
    }
}

/** Outline in world units (clockwise); bursts are a 48-sided polygon */
export function templateOutline(t: Template, perCell: number): Point[] {
    const L = templateWorldSize(t, perCell)
    switch (t.shape) {
        case "burst":
            return Array.from({ length: 48 }, (_, i) => {
                const a = (i / 48) * Math.PI * 2
                return { x: t.origin.x + L * Math.cos(a), y: t.origin.y + L * Math.sin(a) }
            })
        case "square": {
            const h = L / 2
            return [toWorld(t, -h, -h), toWorld(t, h, -h), toWorld(t, h, h), toWorld(t, -h, h)]
        }
        case "line": {
            const w = SQUARE / 2
            return [toWorld(t, 0, -w), toWorld(t, L, -w), toWorld(t, L, w), toWorld(t, 0, w)]
        }
        case "cone":
            return [toWorld(t, 0, 0), toWorld(t, L, -L / 2), toWorld(t, L, L / 2)]
    }
}

/** Where the rotate handle sits (cone/line: the tip; square: an edge) */
export function templateHandle(t: Template, perCell: number): Point {
    const L = templateWorldSize(t, perCell)
    return toWorld(t, t.shape === "square" ? L / 2 : L, 0)
}

export function boundsOf(points: Point[]) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
    for (const p of points) {
        x1 = Math.min(x1, p.x)
        y1 = Math.min(y1, p.y)
        x2 = Math.max(x2, p.x)
        y2 = Math.max(y2, p.y)
    }
    return { x1, y1, x2, y2 }
}

/** Grid cells whose centres fall inside the template */
export function templateCells(t: Template, shape: GridShape, perCell: number): Cell[] {
    const b = boundsOf(templateOutline(t, perCell))
    const pad = SQUARE / 2
    return cellsInRect({ x: b.x1 - pad, y: b.y1 - pad }, { x: b.x2 + pad, y: b.y2 + pad }, shape).filter(
        (c) => templateContains(t, cellCenter(c, shape), perCell)
    )
}

/**
 * Snap a template's origin so its cells line up with the grid:
 * hex grids use hex centres; on squares, cones and lines start from a cell
 * centre, bursts from a grid corner, and squares fill whole cells.
 */
export function snapTemplateOrigin(
    p: Point,
    t: Pick<Template, "shape" | "size">,
    shape: GridShape,
    perCell: number
): Point {
    if (shape === "hex") return snapToCellCenter(p, shape)
    const corner = { x: Math.round(p.x / SQUARE) * SQUARE, y: Math.round(p.y / SQUARE) * SQUARE }
    switch (t.shape) {
        case "cone":
        case "line":
            return snapToCellCenter(p, shape)
        case "burst":
            return corner
        case "square": {
            const cells = Math.round(t.size / perCell)
            return cells % 2 === 1 ? snapToCellCenter(p, shape) : corner
        }
    }
}

/** Snap an aim angle to 15° steps */
export const snapAngle = (deg: number, step = 15) => {
    const a = Math.round(deg / step) * step
    return ((a % 360) + 360) % 360
}

/** Is a rectangle (token footprint) touched by the template? */
export function templateTouchesRect(
    t: Template,
    cells: Cell[],
    rect: { x: number; y: number; width: number; height: number },
    shape: GridShape,
    perCell: number
): boolean {
    const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    if (templateContains(t, centre, perCell)) return true
    return cells.some((c) => {
        const p = cellCenter(c, shape)
        return p.x > rect.x && p.x < rect.x + rect.width && p.y > rect.y && p.y < rect.y + rect.height
    })
}

// ---------------------------------------------------------- token sizes
export type SizeCategory = "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan"

export const SIZE_CATEGORIES: { id: SizeCategory; label: string; cells: number }[] = [
    { id: "tiny", label: "Tiny", cells: 0.5 },
    { id: "small", label: "Small", cells: 1 },
    { id: "medium", label: "Medium", cells: 1 },
    { id: "large", label: "Large", cells: 2 },
    { id: "huge", label: "Huge", cells: 3 },
    { id: "gargantuan", label: "Gargantuan", cells: 4 },
]

/** The token's size category: explicit, else guessed from its footprint */
export function currentSizeCategory(
    sizeCategory: SizeCategory | undefined,
    size: { width: number; height: number }
): SizeCategory | null {
    if (sizeCategory) return sizeCategory
    const cells = Math.max(size.width, size.height) / SQUARE
    if (cells === 0.5) return "tiny"
    if (cells === 1) return "medium"
    if (cells === 2) return "large"
    if (cells === 3) return "huge"
    if (cells === 4) return "gargantuan"
    return null
}

/**
 * New size and position for a token changing size category, keeping its
 * centre. `snap` re-snaps it (pass the board's snap function) when the
 * token was sitting on the grid before.
 */
export function resizeForCategory(
    position: Point,
    size: { width: number; height: number },
    category: SizeCategory,
    snap?: (p: Point, s: { width: number; height: number }) => Point
): { position: Point; size: { width: number; height: number } } {
    const cells = SIZE_CATEGORIES.find((c) => c.id === category)!.cells
    const next = { width: cells * SQUARE, height: cells * SQUARE }
    const cx = position.x + size.width / 2
    const cy = position.y + size.height / 2
    let pos = { x: cx - next.width / 2, y: cy - next.height / 2 }
    if (snap) {
        const was = snap(position, size)
        const aligned = Math.abs(was.x - position.x) < 0.5 && Math.abs(was.y - position.y) < 0.5
        if (aligned) pos = snap(pos, next)
    }
    return { position: pos, size: next }
}
