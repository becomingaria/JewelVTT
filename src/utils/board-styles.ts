/*
 * Board styles: procedurally generated, seamlessly tiling pixel-art
 * textures (no image assets). Each tile is TILE_PX texels, drawn over
 * TILE_WORLD world units with smoothing off for a crisp retro look.
 */

export type BoardStyleId =
    | "parchment"
    | "cave"
    | "space"
    | "grass"
    | "stone"
    | "blank"

export interface BoardStyle {
    id: BoardStyleId
    label: string
    /** Grid line colour when zoomed in / out */
    grid: string
    gridFar: string
    /** Colour behind the texture (and the whole board for "blank") */
    base: string
    generate?: (size: number) => ImageData
    /** Texels per tile (default TILE_PX) */
    tilePx?: number
    /** World units one tile covers (default STYLE_TILE_WORLD) */
    tileWorld?: number
}

export const DEFAULT_BOARD_STYLE: BoardStyleId = "parchment"

/** Grid drawn over the board: classic squares or pointy-top hexagons */
export type GridShape = "square" | "hex"
const TILE_PX = 256
/** World units one tile covers (2 world px per texel at 100% zoom) */
export const STYLE_TILE_WORLD = 512

// ------------------------------------------------------------------ noise
function mulberry32(seed: number) {
    return () => {
        seed |= 0
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

const fade = (t: number) => t * t * (3 - 2 * t)
const mod = (a: number, n: number) => ((a % n) + n) % n

/** Value noise that repeats every `period` lattice cells (so it tiles) */
function periodicNoise(period: number, seed: number) {
    const rand = mulberry32(seed)
    const lattice = Array.from({ length: period * period }, rand)
    const at = (i: number, j: number) =>
        lattice[mod(j, period) * period + mod(i, period)]
    return (x: number, y: number) => {
        const x0 = Math.floor(x)
        const y0 = Math.floor(y)
        const tx = fade(x - x0)
        const ty = fade(y - y0)
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx
        return a + (b - a) * ty
    }
}

/** Tileable fractal noise in 0..1; u,v in 0..1 across the tile */
function fbm(basePeriod: number, octaves: number, seed: number) {
    const layers = Array.from({ length: octaves }, (_, k) => ({
        period: basePeriod * 2 ** k,
        amp: 0.5 ** k,
        noise: periodicNoise(basePeriod * 2 ** k, seed + k * 101),
    }))
    const total = layers.reduce((s, l) => s + l.amp, 0)
    return (u: number, v: number) =>
        layers.reduce((s, l) => s + l.amp * l.noise(u * l.period, v * l.period), 0) /
        total
}

type RGB = [number, number, number]
const hex = (h: string): RGB => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
]
const mix = (a: RGB, b: RGB, t: number): RGB => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
]
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
const smooth = (e0: number, e1: number, x: number) => {
    const t = clamp01((x - e0) / (e1 - e0))
    return t * t * (3 - 2 * t)
}
/** Quantise a 0..1 value into n bands (gives the pixel-art banding) */
const band = (t: number, n: number) => Math.round(clamp01(t) * (n - 1)) / (n - 1)

function paint(size: number, fn: (u: number, v: number, x: number, y: number) => RGB) {
    const img = new ImageData(size, size)
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const [r, g, b] = fn(x / size, y / size, x, y)
            const i = (y * size + x) * 4
            img.data[i] = r
            img.data[i + 1] = g
            img.data[i + 2] = b
            img.data[i + 3] = 255
        }
    return img
}

/** Set a pixel with wrap-around so sprites drawn near edges still tile */
function plot(img: ImageData, x: number, y: number, c: RGB) {
    const s = img.width
    const i = (mod(Math.round(y), s) * s + mod(Math.round(x), s)) * 4
    img.data[i] = c[0]
    img.data[i + 1] = c[1]
    img.data[i + 2] = c[2]
}

// --------------------------------------------------------------- textures
function parchment(size: number) {
    const body = fbm(5, 5, 11)
    const stains = fbm(3, 4, 29)
    const rand = mulberry32(7)
    const light = hex("#f2e3bf")
    const dark = hex("#d4b682")
    const stain = hex("#b8925a")
    return paint(size, (u, v) => {
        let c = mix(light, dark, 0.85 * band(body(u, v) * 1.2 - 0.1, 6))
        c = mix(c, stain, 0.4 * smooth(0.66, 0.84, stains(u, v)))
        const grain = (rand() - 0.5) * 10
        return [c[0] + grain, c[1] + grain, c[2] + grain * 0.6]
    })
}

function cave(size: number) {
    const rock = fbm(4, 5, 41)
    const pits = fbm(6, 3, 45)
    const crack = periodicNoise(5, 43)
    const crack2 = periodicNoise(9, 47)
    const rand = mulberry32(9)
    const hi = hex("#5b5047")
    const lo = hex("#2a231e")
    const vein = hex("#15110e")
    return paint(size, (u, v) => {
        let c = mix(lo, hi, band(rock(u, v) * 1.5 - 0.25, 6))
        c = mix(c, vein, 0.45 * smooth(0.7, 0.85, pits(u, v)))
        const r1 = 1 - Math.abs(2 * crack(u * 5, v * 5) - 1)
        const r2 = 1 - Math.abs(2 * crack2(u * 9, v * 9) - 1)
        if (r1 > 0.978 || r2 > 0.986) c = mix(c, vein, 0.7)
        if (rand() < 0.01) c = mix(c, hex("#8a7b6b"), 0.8)
        return c
    })
}

function space(size: number) {
    const nebula = fbm(2, 5, 61)
    const tint = fbm(2, 3, 67)
    const deep = hex("#06071a")
    const purple = hex("#3d1d6b")
    const blue = hex("#11336e")
    const img = paint(size, (u, v) => {
        const n = smooth(0.42, 0.85, nebula(u, v))
        const hue = mix(purple, blue, tint(u, v))
        return mix(deep, hue, band(n, 5) * 0.85)
    })
    const rand = mulberry32(71)
    const starCols = [hex("#ffffff"), hex("#cfe0ff"), hex("#ffe9b0")]
    for (let i = 0; i < (size * size) / 220; i++) {
        const x = rand() * size
        const y = rand() * size
        const c = starCols[Math.floor(rand() * starCols.length)]
        plot(img, x, y, rand() < 0.6 ? mix(deep, c, 0.55) : c)
    }
    // A few bright twinkling crosses
    for (let i = 0; i < 6; i++) {
        const x = rand() * size
        const y = rand() * size
        const c = starCols[i % starCols.length]
        plot(img, x, y, [255, 255, 255])
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
            plot(img, x + dx, y + dy, mix(deep, c, 0.7))
    }
    return img
}

function grass(size: number) {
    const field = fbm(3, 5, 81)
    const patch = fbm(2, 3, 83)
    const rand = mulberry32(89)
    const lo = hex("#3c6b27")
    const hi = hex("#6ea044")
    const dry = hex("#8c9a45")
    const img = paint(size, (u, v) => {
        let c = mix(lo, hi, band(field(u, v) * 1.4 - 0.2, 5))
        c = mix(c, dry, 0.45 * smooth(0.6, 0.78, patch(u, v)))
        return c
    })
    // Blades: short vertical strokes, light on top
    const bladeHi = hex("#94c45a")
    const bladeLo = hex("#2c5320")
    for (let i = 0; i < (size * size) / 30; i++) {
        const x = rand() * size
        const y = rand() * size
        const tall = 1 + Math.floor(rand() * 3)
        for (let k = 0; k < tall; k++) plot(img, x, y - k, k === tall - 1 ? bladeHi : bladeLo)
    }
    // Tiny flowers
    const petals = [hex("#f7f1d4"), hex("#f5d34b"), hex("#d8a7e8")]
    for (let i = 0; i < 9; i++) {
        const x = rand() * size
        const y = rand() * size
        const p = petals[i % petals.length]
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) plot(img, x + dx, y + dy, p)
        plot(img, x, y, hex("#e0952c"))
    }
    return img
}

function stone(size: number) {
    // Periodic Voronoi flagstones with mortar joints
    const rand = mulberry32(97)
    const seeds = Array.from({ length: 26 }, () => ({
        x: rand(),
        y: rand(),
        shade: rand(),
    }))
    const grain = fbm(4, 4, 101)
    const mortar = hex("#3b3833")
    const light = hex("#9c978e")
    const dark = hex("#6a665f")
    return paint(size, (u, v) => {
        // Nearest seed (including wrapped copies so the tile repeats)
        const pts: { x: number; y: number; shade: number }[] = []
        for (const s of seeds)
            for (let ox = -1; ox <= 1; ox++)
                for (let oy = -1; oy <= 1; oy++)
                    pts.push({ x: s.x + ox, y: s.y + oy, shade: s.shade })
        let near = pts[0]
        let best = Infinity
        for (const p of pts) {
            const d = (u - p.x) ** 2 + (v - p.y) ** 2
            if (d < best) {
                best = d
                near = p
            }
        }
        // Distance to the closest cell edge (perpendicular bisector), so
        // mortar joints stay an even width instead of pooling at corners
        let edge = Infinity
        const reach = (Math.sqrt(best) + 0.3) ** 2 // only nearby neighbours
        for (const p of pts) {
            if (p === near || (u - p.x) ** 2 + (v - p.y) ** 2 > reach) continue
            const mx = p.x - near.x
            const my = p.y - near.y
            const len = Math.hypot(mx, my)
            const d =
                ((u - (near.x + p.x) / 2) * -mx + (v - (near.y + p.y) / 2) * -my) /
                len
            if (d < edge) edge = d
        }
        // Joint widths in texels, so they stay crisp at any tile size
        if (edge < 1.1 / size) return mortar
        let c = mix(dark, light, band(0.35 + near.shade * 0.4 + (grain(u, v) - 0.5) * 0.5, 5))
        // Bevel: darken just inside the joint
        if (edge < 2.4 / size) c = mix(c, mortar, 0.3)
        return c
    })
}

export const BOARD_STYLES: BoardStyle[] = [
    {
        id: "parchment",
        label: "Parchment",
        grid: "rgba(110, 72, 25, 0.22)",
        gridFar: "rgba(110, 72, 25, 0.12)",
        base: "#ead7ad",
        generate: parchment,
    },
    {
        id: "cave",
        label: "Cave",
        grid: "rgba(255, 240, 220, 0.12)",
        gridFar: "rgba(255, 240, 220, 0.06)",
        base: "#2f2822",
        generate: cave,
        // Smaller, tighter-repeating rock
        tilePx: 128,
        tileWorld: 256,
    },
    {
        id: "space",
        label: "Space",
        grid: "rgba(150, 170, 255, 0.16)",
        gridFar: "rgba(150, 170, 255, 0.08)",
        base: "#06071a",
        generate: space,
    },
    {
        id: "grass",
        label: "Grass",
        grid: "rgba(20, 45, 10, 0.25)",
        gridFar: "rgba(20, 45, 10, 0.12)",
        base: "#4f7d34",
        generate: grass,
    },
    {
        id: "stone",
        label: "Stone",
        grid: "rgba(20, 18, 15, 0.22)",
        gridFar: "rgba(20, 18, 15, 0.1)",
        base: "#7d7870",
        generate: stone,
        // Smaller flagstones
        tilePx: 128,
        tileWorld: 256,
    },
    {
        id: "blank",
        label: "Blank",
        grid: "#e0e0e0",
        gridFar: "#f0f0f0",
        base: "#ffffff",
    },
]

export const getBoardStyle = (id: BoardStyleId) =>
    BOARD_STYLES.find((s) => s.id === id) ?? BOARD_STYLES[0]

/** World units one tile of this style covers */
export const getStyleTileWorld = (id: BoardStyleId) =>
    getBoardStyle(id).tileWorld ?? STYLE_TILE_WORLD

const textureCache = new Map<BoardStyleId, string | null>()

/** Data URL of the style's tile (cached), or null for "blank" */
export function getBoardStyleTexture(id: BoardStyleId): string | null {
    if (textureCache.has(id)) return textureCache.get(id) ?? null
    const style = getBoardStyle(id)
    let url: string | null = null
    if (style.generate) {
        const px = style.tilePx ?? TILE_PX
        const canvas = document.createElement("canvas")
        canvas.width = canvas.height = px
        canvas.getContext("2d")!.putImageData(style.generate(px), 0, 0)
        url = canvas.toDataURL("image/png")
    }
    textureCache.set(id, url)
    return url
}
