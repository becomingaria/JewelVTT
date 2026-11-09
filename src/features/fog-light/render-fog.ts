import type { BoardCamera } from "../board-bridge"
import { cellCenter, cellKey, cellNeighbors, SQUARE, type Cell } from "../grid"
import type { GridShape } from "../../utils/board-styles"
import { HEX_ROW, HEX_W } from "../../utils/humbug.utils"
import { bayerThreshold, hash2, packRGBA, pickTexel } from "./dither"
import { fogDeltas, fogShape, isRevealedKey, type FogState } from "./fog-store"
import {
    cameraAffine,
    drawRegion,
    padBox,
    regionContains,
    regionFor,
    visibleBox,
    type Region,
    type RGBA,
} from "./world-texture"

/*
 * Fog texture. Hidden cells are fully covered. The dither band (one cell
 * wide) lies on the REVEALED side of the boundary, so nothing hidden ever
 * shows through, not even at the edge: the band fades from solid at the
 * fog line to clear one cell into the revealed area.
 */

export interface FogLook {
    table: boolean
    /** GM view: semi-transparent fog + diagonal hatch */
    gmFog: RGBA
    gmHatch: RGBA
    /** Table Mode: opaque stone */
    stone: RGBA
}

/** Width of the dither band (one cell; hex neighbours are 32 apart too) */
const CELL = 32

interface CellInfo {
    hidden: boolean
    /** Edges shared with hidden neighbours: nx, ny, offset, centre spacing */
    planes: number[]
    /** Corners shared with hidden diagonal neighbours (squares): x, y */
    corners: number[]
}

const OPEN: CellInfo = { hidden: false, planes: [], corners: [] }
const SHUT: CellInfo = { hidden: true, planes: [], corners: [] }
const DIAGONALS = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
]

const numKey = (col: number, row: number) => col * 2097152 + row

/**
 * Allocation-free twin of grid.cellAt (same maths and tie-breaks), for the
 * hot per-texel loop.
 */
function cellInto(x: number, y: number, shape: GridShape, out: Cell) {
    if (shape !== "hex") {
        out.col = Math.floor(x / SQUARE)
        out.row = Math.floor(y / SQUARE)
        return
    }
    const r0 = Math.round(y / HEX_ROW)
    let bestD = Infinity
    for (let row = r0 - 1; row <= r0 + 1; row++) {
        const shift = ((row % 2) + 2) % 2 ? HEX_W / 2 : 0
        const col = Math.round((x - shift) / HEX_W)
        const dx = col * HEX_W + shift - x
        const dy = row * HEX_ROW - y
        const d = dx * dx + dy * dy
        if (d < bestD) {
            bestD = d
            out.col = col
            out.row = row
        }
    }
}

export class FogRenderer {
    private tex: HTMLCanvasElement | null = null
    private texCtx: CanvasRenderingContext2D | null = null
    private img: ImageData | null = null
    private region: Region | null = null
    private state: FogState | null = null
    private shape: GridShape = "square"
    private lookKey = ""

    /** Forget everything (next draw rebuilds) */
    reset() {
        this.region = null
        this.state = null
    }

    draw(
        ctx: CanvasRenderingContext2D,
        cam: BoardCamera,
        state: FogState,
        look: FogLook,
        w: number,
        h: number,
        dpr: number
    ) {
        const vis = visibleBox(cam, w, h)
        const t = pickTexel(cam.scale, (vis.maxX - vis.minX) * 1.5, (vis.maxY - vis.minY) * 1.5)
        const shape = fogShape(state)
        const lookKey = `${look.table}|${look.gmFog}|${look.gmHatch}|${look.stone}`

        const full =
            !this.region ||
            !this.img ||
            this.region.t !== t ||
            !regionContains(this.region, vis) ||
            lookKey !== this.lookKey ||
            shape !== this.shape

        if (full) {
            this.region = regionFor(padBox(vis, 0.25), t)
            this.shape = shape
            this.lookKey = lookKey
            this.allocate(this.region)
            this.fill(state, look, 0, 0, this.region.cols, this.region.rows)
            this.texCtx!.putImageData(this.img!, 0, 0)
        } else if (state !== this.state) {
            const changed = this.changedSince(state)
            const r = this.region!
            if (!changed) {
                this.fill(state, look, 0, 0, r.cols, r.rows)
                this.texCtx!.putImageData(this.img!, 0, 0)
            } else if (changed.length) {
                // Redraw only around the changed cells (their bands reach one cell)
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
                for (const c of changed) {
                    const p = cellCenter(c, shape)
                    minX = Math.min(minX, p.x)
                    minY = Math.min(minY, p.y)
                    maxX = Math.max(maxX, p.x)
                    maxY = Math.max(maxY, p.y)
                }
                const reach = CELL * 2
                const i0 = Math.max(0, Math.floor((minX - reach - r.x0) / r.t))
                const j0 = Math.max(0, Math.floor((minY - reach - r.y0) / r.t))
                const i1 = Math.min(r.cols, Math.ceil((maxX + reach - r.x0) / r.t))
                const j1 = Math.min(r.rows, Math.ceil((maxY + reach - r.y0) / r.t))
                if (i1 > i0 && j1 > j0) {
                    this.fill(state, look, i0, j0, i1, j1)
                    this.texCtx!.putImageData(this.img!, 0, 0, i0, j0, i1 - i0, j1 - j0)
                }
            }
        }
        this.state = state
        if (this.tex && this.region) drawRegion(ctx, this.tex, this.region, cameraAffine(cam), dpr)
    }

    /** Cells changed since the last drawn state, or null if unknown */
    private changedSince(state: FogState): Cell[] | null {
        const out: Cell[] = []
        let s: FogState | undefined = state
        for (let hops = 0; hops < 256 && s; hops++) {
            if (s === this.state) return out
            const d = fogDeltas.get(s)
            if (!d) return null
            out.push(...d.cells)
            s = d.from
        }
        return null
    }

    private allocate(r: Region) {
        if (!this.tex) {
            this.tex = document.createElement("canvas")
            this.texCtx = this.tex.getContext("2d")
        }
        if (this.tex.width !== r.cols || this.tex.height !== r.rows) {
            this.tex.width = r.cols
            this.tex.height = r.rows
        }
        if (!this.img || this.img.width !== r.cols || this.img.height !== r.rows) {
            this.img = new ImageData(r.cols, r.rows)
        }
    }

    /** Recompute texels [i0,i1) × [j0,j1) */
    private fill(state: FogState, look: FogLook, i0: number, j0: number, i1: number, j1: number) {
        const r = this.region!
        const buf = new Uint32Array(this.img!.data.buffer)
        const shape = this.shape

        if (!state.enabled) {
            for (let j = j0; j < j1; j++) buf.fill(0, j * r.cols + i0, j * r.cols + i1)
            return
        }

        const infos = new Map<number, CellInfo>()
        const info = (c: Cell): CellInfo => {
            const nk = numKey(c.col, c.row)
            let inf = infos.get(nk)
            if (inf) return inf
            c = { col: c.col, row: c.row }
            if (!isRevealedKey(state, cellKey(c))) inf = SHUT
            else {
                const planes: number[] = []
                const corners: number[] = []
                const cc = cellCenter(c, shape)
                for (const n of cellNeighbors(c, shape)) {
                    if (isRevealedKey(state, cellKey(n))) continue
                    const cn = cellCenter(n, shape)
                    const dx = cn.x - cc.x
                    const dy = cn.y - cc.y
                    const len = Math.hypot(dx, dy)
                    const nx = dx / len
                    const ny = dy / len
                    planes.push(nx, ny, nx * (cc.x + dx / 2) + ny * (cc.y + dy / 2), len)
                }
                if (shape === "square") {
                    for (const [dc, dr] of DIAGONALS) {
                        if (isRevealedKey(state, cellKey({ col: c.col + dc, row: c.row + dr }))) continue
                        corners.push(cc.x + (dc * CELL) / 2, cc.y + (dr * CELL) / 2)
                    }
                }
                inf = planes.length || corners.length ? { hidden: false, planes, corners } : OPEN
            }
            infos.set(nk, inf)
            return inf
        }

        const [fr, fg, fb] = look.gmFog
        const [hr, hg, hb] = look.gmHatch
        const fogPx = packRGBA(fr, fg, fb, 140) // ~55%
        const hatchPx = packRGBA(hr, hg, hb, 175)
        const [sr, sg, sb] = look.stone
        const stoneAt = (gi: number, gj: number) => {
            // Chunky stone blocks: 8×4 texels, staggered rows, dark mortar, speckle
            const row = Math.floor(gj / 4)
            const off = row & 1 ? 4 : 0
            const mortar = ((gj % 4) + 4) % 4 === 0 || (((gi + off) % 8) + 8) % 8 === 0
            const block = hash2(Math.floor((gi + off) / 8), row)
            const speck = hash2(gi, gj)
            let k = mortar ? 0.55 : 0.85 + block * 0.3
            if (!mortar && speck > 0.93) k *= 0.8
            const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)))
            return packRGBA(ch(sr), ch(sg), ch(sb), 255)
        }

        const t = r.t
        const edge = t / CELL
        const gi0 = Math.round(r.x0 / t)
        const gj0 = Math.round(r.y0 / t)
        const p = { x: 0, y: 0 }
        const cell: Cell = { col: 0, row: 0 }
        let lastCol = NaN
        let lastRow = NaN
        let inf: CellInfo = SHUT
        for (let j = j0; j < j1; j++) {
            p.y = r.y0 + (j + 0.5) * t
            const gj = gj0 + j
            let rowIdx = j * r.cols + i0
            for (let i = i0; i < i1; i++, rowIdx++) {
                p.x = r.x0 + (i + 0.5) * t
                cellInto(p.x, p.y, shape, cell)
                if (cell.col !== lastCol || cell.row !== lastRow) {
                    inf = info(cell)
                    lastCol = cell.col
                    lastRow = cell.row
                }
                let covered = inf.hidden
                if (!covered && inf !== OPEN) {
                    // Nearest distance to a hidden edge/corner, in cells
                    let dmin = 1
                    const pl = inf.planes
                    for (let q = 0; q < pl.length; q += 4) {
                        const d = (pl[q + 2] - (pl[q] * p.x + pl[q + 1] * p.y)) / pl[q + 3]
                        if (d < dmin) dmin = d
                    }
                    const co = inf.corners
                    for (let q = 0; q < co.length; q += 2) {
                        const d = Math.hypot(p.x - co[q], p.y - co[q + 1]) / CELL
                        if (d < dmin) dmin = d
                    }
                    // Texels touching the fog line are always solid (no slivers)
                    const density = dmin <= edge ? 1 : (1 - dmin) * (1 - dmin)
                    covered = density > bayerThreshold(gi0 + i, gj)
                }
                if (!covered) {
                    buf[rowIdx] = 0
                    continue
                }
                const gi = gi0 + i
                if (look.table) buf[rowIdx] = stoneAt(gi, gj)
                else buf[rowIdx] = ((gi + gj) % 8 + 8) % 8 === 0 ? hatchPx : fogPx
            }
        }
    }
}
