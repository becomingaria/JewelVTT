import type { BoardCamera } from "../board-bridge"
import { cellKey, parseCellKey, SQUARE } from "../grid"
import { hatchStrokes, isHatched, wallSegments, type FloorSet } from "./walls"

/*
 * Draws the dungeon floor under the humbugs: clean paper rooms with their
 * grid lines, thick ink walls, and a hand-hatched band outside.
 *
 * The board is split into chunks of CHUNK×CHUNK cells. Each chunk's
 * geometry is built once as Path2D objects (world units) and reused every
 * frame; only chunks near changed cells are rebuilt. Each frame draws only
 * the chunks that are on screen and have something in them, through one
 * canvas transform taken from camera.worldToScreen (so 2.5D just works).
 */

const CHUNK = 16
const CHUNK_WORLD = CHUNK * SQUARE
/** Hatching reaches 2 cells out; walls belong to the cell below/right: 3 covers both */
const REACH = 3

interface ChunkGeom {
    floor: Path2D
    grid: Path2D
    hatch: Path2D
    tone: Path2D
    walls: Path2D
}

export interface MapColours {
    ink: string
    paper: string
    grid: string
}

/** Map colours from theme tokens, with graph-paper fallbacks */
export function mapColours(): MapColours {
    const css = getComputedStyle(document.documentElement)
    const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
    return {
        ink: v("--jv-map-ink", "#1d1c26"),
        paper: v("--jv-map-floor", "#fdfcf7"),
        grid: v("--jv-map-grid", "rgba(64, 126, 200, 0.5)"),
    }
}

const chunkOf = (n: number) => Math.floor(n / CHUNK)
const chunkKey = (cx: number, cy: number) => `${cx},${cy}`

export class FloorRenderer {
    private floor: FloorSet = new Set()
    private cache = new Map<string, ChunkGeom>()
    /** Chunks that may contain floor or hatching */
    private live = new Set<string>()

    setFloor(next: FloorSet) {
        if (next === this.floor) return
        const prev = this.floor
        const dirty = (k: string) => {
            const { col, row } = parseCellKey(k)
            for (let cy = chunkOf(row - REACH); cy <= chunkOf(row + REACH); cy++)
                for (let cx = chunkOf(col - REACH); cx <= chunkOf(col + REACH); cx++) this.cache.delete(chunkKey(cx, cy))
        }
        // A wholesale change (new board, scene switch) just starts over
        if (Math.abs(next.size - prev.size) > 4000) this.cache.clear()
        else {
            for (const k of prev) if (!next.has(k)) dirty(k)
            for (const k of next) if (!prev.has(k)) dirty(k)
        }
        this.floor = next
        this.live = new Set()
        for (const k of next) {
            const { col, row } = parseCellKey(k)
            for (let cy = chunkOf(row - 2); cy <= chunkOf(row + 2); cy++)
                for (let cx = chunkOf(col - 2); cx <= chunkOf(col + 2); cx++) this.live.add(chunkKey(cx, cy))
        }
    }

    private chunk(cx: number, cy: number): ChunkGeom {
        const key = chunkKey(cx, cy)
        const hit = this.cache.get(key)
        if (hit) return hit
        const floor = this.floor
        const has = (col: number, row: number) => floor.has(cellKey({ col, row }))
        const c0 = cx * CHUNK
        const r0 = cy * CHUNK
        const g: ChunkGeom = {
            floor: new Path2D(),
            grid: new Path2D(),
            hatch: new Path2D(),
            tone: new Path2D(),
            walls: new Path2D(),
        }
        for (let row = r0; row < r0 + CHUNK; row++) {
            let run: number | null = null
            for (let col = c0; col <= c0 + CHUNK; col++) {
                const inside = col < c0 + CHUNK && has(col, row)
                if (inside && run === null) run = col
                if (!inside && run !== null) {
                    // A hair of overlap hides anti-aliasing seams between rows
                    g.floor.rect(run * SQUARE, row * SQUARE, (col - run) * SQUARE + 0.4, SQUARE + 0.4)
                    run = null
                }
                if (col >= c0 + CHUNK) continue
                if (inside) {
                    // Interior grid lines only: boundary edges are walls
                    if (has(col, row - 1)) {
                        g.grid.moveTo(col * SQUARE, row * SQUARE)
                        g.grid.lineTo((col + 1) * SQUARE, row * SQUARE)
                    }
                    if (has(col - 1, row)) {
                        g.grid.moveTo(col * SQUARE, row * SQUARE)
                        g.grid.lineTo(col * SQUARE, (row + 1) * SQUARE)
                    }
                } else if (isHatched(floor, col, row)) {
                    g.tone.rect(col * SQUARE, row * SQUARE, SQUARE, SQUARE)
                    for (const [x1, y1, x2, y2] of hatchStrokes(col, row)) {
                        g.hatch.moveTo(x1, y1)
                        g.hatch.lineTo(x2, y2)
                    }
                }
            }
        }
        for (const s of wallSegments(floor, c0, r0, c0 + CHUNK, r0 + CHUNK)) {
            g.walls.moveTo(s.x1 * SQUARE, s.y1 * SQUARE)
            g.walls.lineTo(s.x2 * SQUARE, s.y2 * SQUARE)
        }
        this.cache.set(key, g)
        return g
    }

    /** Draw the visible part of the floor. `w`/`h` are CSS pixels. */
    draw(
        ctx: CanvasRenderingContext2D,
        camera: BoardCamera,
        w: number,
        h: number,
        dpr: number,
        colours: MapColours,
        opts: { highContrast: boolean }
    ) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        if (!this.floor.size) return

        // World -> screen is affine: recover it from three projected points
        const o = camera.worldToScreen(0, 0)
        const ex = camera.worldToScreen(1000, 0)
        const ey = camera.worldToScreen(0, 1000)
        ctx.setTransform(
            (dpr * (ex.x - o.x)) / 1000,
            (dpr * (ex.y - o.y)) / 1000,
            (dpr * (ey.x - o.x)) / 1000,
            (dpr * (ey.y - o.y)) / 1000,
            dpr * o.x,
            dpr * o.y
        )

        // Visible chunks: bounding box of the four screen corners
        const corners = [
            camera.containerToWorld(0, 0),
            camera.containerToWorld(w, 0),
            camera.containerToWorld(0, h),
            camera.containerToWorld(w, h),
        ]
        const minCx = Math.floor(Math.min(...corners.map((p) => p.x)) / CHUNK_WORLD)
        const maxCx = Math.floor(Math.max(...corners.map((p) => p.x)) / CHUNK_WORLD)
        const minCy = Math.floor(Math.min(...corners.map((p) => p.y)) / CHUNK_WORLD)
        const maxCy = Math.floor(Math.max(...corners.map((p) => p.y)) / CHUNK_WORLD)
        const visible: ChunkGeom[] = []
        const area = (maxCx - minCx + 1) * (maxCy - minCy + 1)
        if (this.live.size < area) {
            for (const k of this.live) {
                const [cx, cy] = k.split(",").map(Number)
                if (cx >= minCx && cx <= maxCx && cy >= minCy && cy <= maxCy) visible.push(this.chunk(cx, cy))
            }
        } else {
            for (let cy = minCy; cy <= maxCy; cy++)
                for (let cx = minCx; cx <= maxCx; cx++)
                    if (this.live.has(chunkKey(cx, cy))) visible.push(this.chunk(cx, cy))
        }
        if (!visible.length) return

        const z = Math.max(camera.scale, 0.01)
        const cellPx = SQUARE * z

        // 1. Hatching (individual strokes when big enough to read, else a tone)
        if (cellPx >= 7) {
            ctx.strokeStyle = colours.ink
            ctx.lineWidth = Math.max(1.1, 0.9 / z)
            ctx.lineCap = "round"
            ctx.globalAlpha = 0.85
            for (const g of visible) ctx.stroke(g.hatch)
        } else {
            ctx.fillStyle = colours.ink
            ctx.globalAlpha = 0.28
            for (const g of visible) ctx.fill(g.tone)
        }
        ctx.globalAlpha = 1

        // 2. Paper floor
        ctx.fillStyle = colours.paper
        for (const g of visible) ctx.fill(g.floor)

        // 3. Grid lines inside rooms (one screen pixel)
        if (cellPx >= 6) {
            ctx.strokeStyle = colours.grid
            ctx.lineWidth = (opts.highContrast ? 1.5 : 1) / z
            ctx.lineCap = "butt"
            for (const g of visible) ctx.stroke(g.grid)
        }

        // 4. Walls: thick ink, square caps so runs meet cleanly at corners
        ctx.strokeStyle = colours.ink
        ctx.lineWidth = Math.max(3.4, 2.2 / z) * (opts.highContrast ? 1.35 : 1)
        ctx.lineCap = "square"
        for (const g of visible) ctx.stroke(g.walls)

        ctx.setTransform(1, 0, 0, 1, 0, 0)
    }
}
