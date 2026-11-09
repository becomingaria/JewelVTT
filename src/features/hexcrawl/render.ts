import type { BoardCamera } from "../board-bridge"
import { cellCenter, cellKey, cellPolygon, type Cell } from "../grid"
import type { Point } from "../../types/humbug.types"
import { HEX_R, HEX_ROW, HEX_W } from "../../utils/humbug.utils"
import { hash2 } from "./pixels"
import { parseEdgeKey, type HexMap } from "./map-data"
import { TERRAINS, terrainDef, type TerrainId } from "./terrain"
import { renderTerrainTile, TILE_CX, TILE_CY, variantFor } from "./tiles"
import { hexNumber } from "./travel"

/*
 * Canvas drawing for the terrain underlay. Everything goes through
 * camera.worldToScreen: the world → screen affine map is read from it, so
 * the flat and the tilted 2.5D views both line up with the board.
 */

// ----------------------------------------------------------- sprite cache
const sprites = new Map<string, HTMLCanvasElement>()

export function terrainSprite(id: TerrainId, variant: number): HTMLCanvasElement {
    const key = `${id}:${variant}`
    let c = sprites.get(key)
    if (!c) {
        const b = renderTerrainTile(id, variant)
        c = document.createElement("canvas")
        c.width = b.w
        c.height = b.h
        c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(b.data), b.w, b.h), 0, 0)
        sprites.set(key, c)
    }
    return c
}

const previewUrls = new Map<TerrainId, string>()
/** PNG data URL of a terrain tile (palette buttons) */
export function terrainPreviewUrl(id: TerrainId): string {
    let url = previewUrls.get(id)
    if (!url) {
        url = terrainSprite(id, 1).toDataURL("image/png")
        previewUrls.set(id, url)
    }
    return url
}

// -------------------------------------------------------------- geometry
/** world → container affine map, read from the camera */
export function worldMatrix(camera: BoardCamera) {
    const o = camera.worldToScreen(0, 0)
    const ex = camera.worldToScreen(1, 0)
    const ey = camera.worldToScreen(0, 1)
    return { a: ex.x - o.x, b: ex.y - o.y, c: ey.x - o.x, d: ey.y - o.y, e: o.x, f: o.y }
}

export function visibleWorldRect(camera: BoardCamera, w: number, h: number) {
    const pts = [
        camera.containerToWorld(0, 0),
        camera.containerToWorld(w, 0),
        camera.containerToWorld(0, h),
        camera.containerToWorld(w, h),
    ]
    return {
        minX: Math.min(...pts.map((p) => p.x)) - HEX_W,
        maxX: Math.max(...pts.map((p) => p.x)) + HEX_W,
        minY: Math.min(...pts.map((p) => p.y)) - HEX_R * 2,
        maxY: Math.max(...pts.map((p) => p.y)) + HEX_R * 2,
    }
}

type Rect = ReturnType<typeof visibleWorldRect>

/** Cells whose centres are in the rect (row/column ranges) */
export function rectCellRange(r: Rect) {
    return {
        r0: Math.floor(r.minY / HEX_ROW),
        r1: Math.ceil(r.maxY / HEX_ROW),
        c0: Math.floor(r.minX / HEX_W) - 1,
        c1: Math.ceil(r.maxX / HEX_W),
    }
}

const inRect = (p: Point, r: Rect) => p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY

export function hexPath(ctx: CanvasRenderingContext2D | Path2D, c: Cell) {
    const pts = cellPolygon(c, "hex")
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath()
}

// ---------------------------------------------------------------- drawing
export interface LabelSpec {
    /** World point just under the marker */
    at: Point
    text: string
}

export interface DrawOptions {
    camera: BoardCamera
    width: number
    height: number
    dpr: number
    map: HexMap
    labels: LabelSpec[]
    showCoords: boolean
    highContrast: boolean
    bodyFont: string
    monoFont: string
}

export function drawTerrain(ctx: CanvasRenderingContext2D, o: DrawOptions) {
    const { camera, width, height, dpr, map } = o
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width * dpr, height * dpr)

    const m = worldMatrix(camera)
    const hexPx = HEX_W * camera.scale
    const rect = visibleWorldRect(camera, width, height)
    const range = rectCellRange(rect)
    const visibleCount = (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1)

    // Painted hexes on screen: walk whichever is smaller
    const painted: { cell: Cell; t: TerrainId }[] = []
    const keys = Object.keys(map.cells)
    if (keys.length < visibleCount) {
        for (const k of keys) {
            const [col, row] = k.split(",").map(Number)
            const cell = { col, row }
            if (inRect(cellCenter(cell, "hex"), rect)) painted.push({ cell, t: map.cells[k] })
        }
    } else {
        for (let row = range.r0; row <= range.r1; row++)
            for (let col = range.c0; col <= range.c1; col++) {
                const t = map.cells[`${col},${row}`]
                if (t) painted.push({ cell: { col, row }, t })
            }
    }

    ctx.setTransform(dpr * m.a, dpr * m.b, dpr * m.c, dpr * m.d, dpr * m.e, dpr * m.f)

    if (hexPx < 7) {
        // Far out: flat colour per terrain, one path each
        const paths = new Map<TerrainId, Path2D>()
        for (const { cell, t } of painted) {
            let p = paths.get(t)
            if (!p) paths.set(t, (p = new Path2D()))
            hexPath(p, cell)
        }
        for (const def of TERRAINS) {
            const p = paths.get(def.id)
            if (!p) continue
            ctx.fillStyle = def.palette.base
            ctx.fill(p)
        }
    } else {
        ctx.imageSmoothingEnabled = false
        // Top rows first so lower tiles overlap them evenly
        painted.sort((a, b) => a.cell.row - b.cell.row)
        for (const { cell, t } of painted) {
            const c = cellCenter(cell, "hex")
            ctx.drawImage(terrainSprite(t, variantFor(cell.col, cell.row)), c.x - TILE_CX, c.y - TILE_CY)
        }
        ctx.imageSmoothingEnabled = true
        // Hex edges (the board grid is underneath the terrain)
        if (hexPx >= 10 && painted.length) {
            ctx.beginPath()
            for (const { cell } of painted) hexPath(ctx, cell)
            ctx.strokeStyle = o.highContrast ? "rgba(30, 20, 10, 0.75)" : "rgba(50, 34, 16, 0.3)"
            ctx.lineWidth = (o.highContrast ? 1.6 : 1) / camera.scale
            ctx.stroke()
        }
    }

    drawPaths(ctx, map, rect, camera.scale, o.highContrast)

    // Screen-space text
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (o.showCoords && hexPx >= 36) drawCoords(ctx, o, range, map)
    if (hexPx >= 26) drawLabels(ctx, o, hexPx)
}

function drawPaths(ctx: CanvasRenderingContext2D, map: HexMap, rect: Rect, scale: number, hc: boolean) {
    const visible = (k: string) => {
        const [a, b] = parseEdgeKey(k)
        const pa = cellCenter(a, "hex")
        const pb = cellCenter(b, "hex")
        return inRect(pa, rect) || inRect(pb, rect) ? { pa, pb, a } : null
    }
    ctx.lineJoin = "round"
    // Rivers: a gently bending blue line with a dark bank
    const rivers = new Path2D()
    let anyRiver = false
    for (const k of Object.keys(map.rivers)) {
        const v = visible(k)
        if (!v) continue
        anyRiver = true
        const { pa, pb, a } = v
        const mx = (pa.x + pb.x) / 2
        const my = (pa.y + pb.y) / 2
        const dx = pb.x - pa.x
        const dy = pb.y - pa.y
        const len = Math.hypot(dx, dy) || 1
        const bend = ((hash2(a.col, a.row, Math.round(dx * 7 + dy * 3)) % 5) - 2) * 2.2
        rivers.moveTo(pa.x, pa.y)
        rivers.quadraticCurveTo(mx + (-dy / len) * bend, my + (dx / len) * bend, pb.x, pb.y)
    }
    if (anyRiver) {
        ctx.lineCap = "round"
        ctx.strokeStyle = "#1d4a86"
        ctx.lineWidth = Math.max(4.4, 2.5 / scale)
        ctx.stroke(rivers)
        ctx.strokeStyle = hc ? "#2f7be0" : "#4f94de"
        ctx.lineWidth = Math.max(2.6, 1.2 / scale)
        ctx.stroke(rivers)
    }
    // Roads: a dashed brown track with a pale verge
    const roads = new Path2D()
    let anyRoad = false
    for (const k of Object.keys(map.roads)) {
        const v = visible(k)
        if (!v) continue
        anyRoad = true
        roads.moveTo(v.pa.x, v.pa.y)
        roads.lineTo(v.pb.x, v.pb.y)
    }
    if (anyRoad) {
        ctx.lineCap = "butt"
        ctx.strokeStyle = "rgba(246, 236, 210, 0.85)"
        ctx.lineWidth = Math.max(3.6, 2 / scale)
        ctx.stroke(roads)
        ctx.setLineDash([3.2, 2.4])
        ctx.strokeStyle = hc ? "#3e2408" : "#6b4423"
        ctx.lineWidth = Math.max(1.8, 1 / scale)
        ctx.stroke(roads)
        ctx.setLineDash([])
    }
}

function drawCoords(ctx: CanvasRenderingContext2D, o: DrawOptions, range: ReturnType<typeof rectCellRange>, map: HexMap) {
    const { camera } = o
    const hexPx = HEX_W * camera.scale
    const size = Math.round(Math.max(9, Math.min(13, hexPx * 0.2)))
    ctx.font = `500 ${size}px ${o.monoFont}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.globalAlpha = o.highContrast ? 0.9 : 0.55
    let n = 0
    for (let row = range.r0; row <= range.r1; row++)
        for (let col = range.c0; col <= range.c1; col++) {
            if (++n > 6000) break
            const cell = { col, row }
            const c = cellCenter(cell, "hex")
            const p = camera.worldToScreen(c.x, c.y - HEX_R * 0.62)
            if (p.x < -40 || p.y < -20 || p.x > o.width + 40 || p.y > o.height + 20) continue
            const t = map.cells[cellKey(cell)]
            ctx.fillStyle = t ? terrainDef(t).textInk : "#4a3418"
            ctx.fillText(hexNumber(cell), p.x, p.y)
        }
    ctx.globalAlpha = 1
}

function drawLabels(ctx: CanvasRenderingContext2D, o: DrawOptions, hexPx: number) {
    const size = Math.round(Math.max(10, Math.min(14, hexPx * 0.26)))
    ctx.font = `600 ${size}px ${o.bodyFont}`
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    for (const l of o.labels) {
        const p = o.camera.worldToScreen(l.at.x, l.at.y)
        if (p.x < -200 || p.y < -40 || p.x > o.width + 200 || p.y > o.height + 40) continue
        const w = ctx.measureText(l.text).width + 8
        const h = size + 5
        ctx.fillStyle = "rgba(247, 239, 220, 0.94)"
        ctx.strokeStyle = "#2a1e14"
        ctx.lineWidth = 1
        ctx.fillRect(Math.round(p.x - w / 2) + 0.5, Math.round(p.y) + 0.5, Math.round(w), h)
        ctx.strokeRect(Math.round(p.x - w / 2) + 0.5, Math.round(p.y) + 0.5, Math.round(w), h)
        ctx.fillStyle = "#2a1e14"
        ctx.fillText(l.text, p.x, Math.round(p.y) + 3)
    }
}
