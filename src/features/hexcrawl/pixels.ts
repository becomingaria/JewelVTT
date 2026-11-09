/*
 * Tiny pixel-art toolkit: seeded randomness, RGBA bitmaps and glyphs drawn
 * from strings. Pure (no DOM) so sprites can be checked outside the browser.
 */

/** Deterministic PRNG in 0..1 */
export function mulberry32(seed: number) {
    let s = seed | 0
    return () => {
        s = (s + 0x6d2b79f5) | 0
        let t = Math.imul(s ^ (s >>> 15), 1 | s)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/** 32-bit hash of a string (seeds typed by people) */
export function hashString(s: string): number {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return h >>> 0
}

/** Stable hash of two integers (per-hex variation) */
export function hash2(a: number, b: number, salt = 0): number {
    let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(salt, 2246822519)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return (h ^ (h >>> 16)) >>> 0
}

export type RGB = [number, number, number]

export const rgb = (hex: string): RGB => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
]

export const mixRgb = (a: RGB, b: RGB, t: number): RGB => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
]

export interface Bitmap {
    w: number
    h: number
    /** RGBA, row-major */
    data: Uint8ClampedArray
}

export const bitmap = (w: number, h: number): Bitmap => ({
    w,
    h,
    data: new Uint8ClampedArray(w * h * 4),
})

export function setPx(b: Bitmap, x: number, y: number, c: RGB, a = 255) {
    if (x < 0 || y < 0 || x >= b.w || y >= b.h) return
    const i = (y * b.w + x) * 4
    b.data[i] = c[0]
    b.data[i + 1] = c[1]
    b.data[i + 2] = c[2]
    b.data[i + 3] = a
}

export const alphaAt = (b: Bitmap, x: number, y: number) =>
    x < 0 || y < 0 || x >= b.w || y >= b.h ? 0 : b.data[(y * b.w + x) * 4 + 3]

/**
 * A glyph is rows of characters; each character maps to a colour in the
 * palette, and "." (or any unmapped character) is transparent.
 */
export type Glyph = readonly string[]

export const glyphSize = (g: Glyph) => ({ w: Math.max(...g.map((r) => r.length)), h: g.length })

/**
 * Stamp a glyph with its top-left at (x, y). `mask` (optional) limits it to
 * pixels that are already opaque (keeps glyphs inside a hex).
 */
export function stamp(
    b: Bitmap,
    g: Glyph,
    palette: Record<string, RGB>,
    x: number,
    y: number,
    opts: { flip?: boolean; mask?: boolean } = {}
) {
    const { w } = glyphSize(g)
    g.forEach((row, gy) => {
        for (let gx = 0; gx < row.length; gx++) {
            const c = palette[row[gx]]
            if (!c) continue
            const px = x + (opts.flip ? w - 1 - gx : gx)
            const py = y + gy
            if (opts.mask && alphaAt(b, px, py) === 0) continue
            setPx(b, px, py, c)
        }
    })
}

/** Glyph to a crisp SVG (one rect per run of same-colour pixels) */
export function glyphToSvg(
    g: Glyph,
    palette: Record<string, string>,
    opts: { halo?: string; title?: string } = {}
): string {
    const { w, h } = glyphSize(g)
    const at = (x: number, y: number) => (y >= 0 && y < h && x >= 0 ? (g[y][x] ?? ".") : ".")
    const filled = (x: number, y: number) => !!palette[at(x, y)]
    const rects: string[] = []
    if (opts.halo) {
        // 1px light ring around the sprite so it reads on any terrain
        for (let y = -1; y <= h; y++)
            for (let x = -1; x <= w; x++) {
                if (filled(x, y)) continue
                let near = false
                for (let dy = -1; dy <= 1 && !near; dy++)
                    for (let dx = -1; dx <= 1 && !near; dx++) near = filled(x + dx, y + dy)
                if (near)
                    rects.push(`<rect x="${x + 1}" y="${y + 1}" width="1" height="1" fill="${opts.halo}"/>`)
            }
    }
    for (let y = 0; y < h; y++) {
        let x = 0
        while (x < w) {
            const ch = at(x, y)
            const fill = palette[ch]
            let run = 1
            while (x + run < w && at(x + run, y) === ch) run++
            if (fill)
                rects.push(`<rect x="${x + 1}" y="${y + 1}" width="${run}" height="1" fill="${fill}"/>`)
            x += run
        }
    }
    const title = opts.title ? `<title>${opts.title}</title>` : ""
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w + 2} ${h + 2}" ` +
        `width="${(w + 2) * 4}" height="${(h + 2) * 4}" shape-rendering="crispEdges">` +
        `${title}${rects.join("")}</svg>`
    )
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
