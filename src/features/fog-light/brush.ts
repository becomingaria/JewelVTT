import type { Point } from "../../types/humbug.types"
import type { GridShape } from "../../utils/board-styles"
import { cellAt, cellCenter, cellKey, cellPolygon, cellsWithin, type Cell } from "../grid"

/**
 * Cells under the brush. Size 1 is a single cell; each step adds a ring.
 * Square brushes are rounded so big ones look like discs, not boxes.
 */
export function brushCells(center: Cell, size: number, shape: GridShape): Cell[] {
    const r = Math.max(0, Math.min(4, Math.round(size) - 1))
    if (shape === "hex") return cellsWithin(center, r, "hex")
    const out: Cell[] = []
    for (let dr = -r; dr <= r; dr++) {
        for (let dc = -r; dc <= r; dc++) {
            if (Math.hypot(dc, dr) <= r + 0.5) out.push({ col: center.col + dc, row: center.row + dr })
        }
    }
    return out
}

/** Cells swept by the brush moving from a to b (no gaps on fast drags) */
export function brushSweep(a: Point, b: Point, size: number, shape: GridShape): Cell[] {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 12))
    const seen = new Set<string>()
    const out: Cell[] = []
    for (let s = 0; s <= steps; s++) {
        const p = { x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps }
        for (const c of brushCells(cellAt(p, shape), size, shape)) {
            const k = cellKey(c)
            if (seen.has(k)) continue
            seen.add(k)
            out.push(c)
        }
    }
    return out
}

/** World-space outer edges of a set of cells (for the brush outline) */
export function outlineEdges(cells: Cell[], shape: GridShape): [Point, Point][] {
    const keys = new Set(cells.map(cellKey))
    const edges: [Point, Point][] = []
    for (const c of cells) {
        const poly = cellPolygon(c, shape)
        const cc = cellCenter(c, shape)
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i]
            const b = poly[(i + 1) % poly.length]
            // Step just across the edge's midpoint to find the neighbour
            const mx = (a.x + b.x) / 2
            const my = (a.y + b.y) / 2
            const across = cellAt({ x: mx + (mx - cc.x) * 0.25, y: my + (my - cc.y) * 0.25 }, shape)
            if (!keys.has(cellKey(across))) edges.push([a, b])
        }
    }
    return edges
}
