import type { BoardCamera } from "../board-bridge"

/*
 * Fog and light are painted into a low-resolution texture laid out in WORLD
 * space (one texel = a few world units), then drawn onto the overlay canvas
 * through the camera's affine map with smoothing off. That gives chunky,
 * board-anchored pixels that stay put while panning and are exact in 2D and
 * in the tilted 2.5D view (worldToScreen is affine).
 */

export interface Affine {
    a: number
    b: number
    c: number
    d: number
    e: number
    f: number
}

/** screen = [a c e; b d f] · world, sampled from camera.worldToScreen */
export function cameraAffine(cam: BoardCamera): Affine {
    const o = cam.worldToScreen(0, 0)
    const px = cam.worldToScreen(1, 0)
    const py = cam.worldToScreen(0, 1)
    return { a: px.x - o.x, b: px.y - o.y, c: py.x - o.x, d: py.y - o.y, e: o.x, f: o.y }
}

export interface WorldBox {
    minX: number
    minY: number
    maxX: number
    maxY: number
}

/** World bounding box of the visible container area */
export function visibleBox(cam: BoardCamera, w: number, h: number): WorldBox {
    const pts = [
        cam.containerToWorld(0, 0),
        cam.containerToWorld(w, 0),
        cam.containerToWorld(0, h),
        cam.containerToWorld(w, h),
    ]
    return {
        minX: Math.min(...pts.map((p) => p.x)),
        minY: Math.min(...pts.map((p) => p.y)),
        maxX: Math.max(...pts.map((p) => p.x)),
        maxY: Math.max(...pts.map((p) => p.y)),
    }
}

export function padBox(b: WorldBox, frac: number): WorldBox {
    const px = (b.maxX - b.minX) * frac
    const py = (b.maxY - b.minY) * frac
    return { minX: b.minX - px, minY: b.minY - py, maxX: b.maxX + px, maxY: b.maxY + py }
}

export interface Region {
    /** World position of texel (0,0)'s corner; multiples of t */
    x0: number
    y0: number
    cols: number
    rows: number
    /** Texel size in world units */
    t: number
}

export function regionFor(b: WorldBox, t: number): Region {
    const x0 = Math.floor(b.minX / t) * t
    const y0 = Math.floor(b.minY / t) * t
    return {
        x0,
        y0,
        cols: Math.max(1, Math.ceil((b.maxX - x0) / t)),
        rows: Math.max(1, Math.ceil((b.maxY - y0) / t)),
        t,
    }
}

export const regionContains = (r: Region, b: WorldBox) =>
    b.minX >= r.x0 && b.minY >= r.y0 && b.maxX <= r.x0 + r.cols * r.t && b.maxY <= r.y0 + r.rows * r.t

/** Match the canvas backing store to its element; returns CSS size and dpr */
export function sizeCanvas(canvas: HTMLCanvasElement) {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const bw = Math.max(1, Math.round(w * dpr))
    const bh = Math.max(1, Math.round(h * dpr))
    if (canvas.width !== bw) canvas.width = bw
    if (canvas.height !== bh) canvas.height = bh
    return { w, h, dpr }
}

/** Draw a world-space texture through the camera, pixels kept chunky */
export function drawRegion(
    ctx: CanvasRenderingContext2D,
    tex: CanvasImageSource,
    r: Region,
    aff: Affine,
    dpr: number
) {
    ctx.save()
    ctx.setTransform(dpr * aff.a, dpr * aff.b, dpr * aff.c, dpr * aff.d, dpr * aff.e, dpr * aff.f)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(tex, r.x0, r.y0, r.cols * r.t, r.rows * r.t)
    ctx.restore()
}

// ---------------------------------------------------------------- colours
export type RGBA = [number, number, number, number]

const colourCache = new Map<string, RGBA>()
let probe: CanvasRenderingContext2D | null = null

/** Any CSS colour string → RGBA bytes (via a 1×1 canvas) */
export function parseColour(css: string, fallback: RGBA): RGBA {
    const hit = colourCache.get(css)
    if (hit) return hit
    try {
        if (!probe) {
            const c = document.createElement("canvas")
            c.width = c.height = 1
            probe = c.getContext("2d", { willReadFrequently: true })
        }
        if (!probe) return fallback
        probe.clearRect(0, 0, 1, 1)
        probe.fillStyle = "#000"
        probe.fillStyle = css
        probe.fillRect(0, 0, 1, 1)
        const d = probe.getImageData(0, 0, 1, 1).data
        const out: RGBA = [d[0], d[1], d[2], d[3]]
        colourCache.set(css, out)
        return out
    } catch {
        return fallback
    }
}

/** A `--jv-*` token as RGB, falling back to a literal colour */
export function tokenColour(el: Element, name: string, fallback: string): RGBA {
    let css = ""
    try {
        css = getComputedStyle(el).getPropertyValue(name).trim()
    } catch {
        /* ignore */
    }
    const fb = parseColour(fallback, [0, 0, 0, 255])
    return css ? parseColour(css, fb) : fb
}
