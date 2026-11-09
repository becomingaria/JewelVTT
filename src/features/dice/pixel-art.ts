/*
 * Original pixel-art dice, generated on a 32×32 grid. Each die shape is a
 * polygon rasterised into pixels; edge pixels become the outline, and the
 * pixels just inside get a light (top-left) or dark (bottom-right) bevel.
 * Values are drawn with a 3×5 pixel digit font at 2× (d6 shows pips).
 *
 * Everything comes out as SVG path data made of 1×1 squares, merged into
 * horizontal runs.
 */

export const DIE_GRID = 32

type Pt = [number, number]

function regular(n: number, cx: number, cy: number, r: number, startDeg: number): Pt[] {
    return Array.from({ length: n }, (_, i) => {
        const a = ((startDeg + (360 / n) * i) * Math.PI) / 180
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt
    })
}

function shapeFor(sides: number): Pt[] {
    switch (sides) {
        case 4:
            return [
                [16, 1],
                [31, 30],
                [1, 30],
            ]
        case 6:
            return [
                [4, 2],
                [28, 2],
                [30, 4],
                [30, 28],
                [28, 30],
                [4, 30],
                [2, 28],
                [2, 4],
            ]
        case 8:
            return [
                [16, 0.5],
                [31.5, 16],
                [16, 31.5],
                [0.5, 16],
            ]
        case 10:
            return [
                [16, 0.5],
                [31.5, 12],
                [16, 31.5],
                [0.5, 12],
            ]
        case 12:
            return regular(5, 16, 17, 15.8, -90)
        case 20:
            return regular(6, 16, 16, 16, -90)
        case 100:
            return regular(8, 16, 16, 16.4, -67.5)
        default:
            return regular(10, 16, 16, 15.8, -90)
    }
}

function inside(poly: Pt[], x: number, y: number): boolean {
    let hit = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i]
        const [xj, yj] = poly[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
    }
    return hit
}

/** Merge a pixel set into one path of horizontal runs */
function toPath(on: (x: number, y: number) => boolean, w = DIE_GRID, h = DIE_GRID, ox = 0, oy = 0): string {
    let d = ""
    for (let y = 0; y < h; y++) {
        let x = 0
        while (x < w) {
            if (!on(x, y)) {
                x++
                continue
            }
            const start = x
            while (x < w && on(x, y)) x++
            d += `M${start + ox} ${y + oy}h${x - start}v1h${start - x}z`
        }
    }
    return d
}

export interface DieArt {
    outline: string
    body: string
    light: string
    shade: string
    /** Vertical centre for the value (lower on a d4) */
    textY: number
}

const artCache = new Map<number, DieArt>()

export function dieArt(sides: number): DieArt {
    const key = [4, 6, 8, 10, 12, 20, 100].includes(sides) ? sides : 0
    const cached = artCache.get(key)
    if (cached) return cached
    const poly = shapeFor(key)
    const N = DIE_GRID
    const mask: boolean[] = new Array(N * N).fill(false)
    for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) mask[y * N + x] = inside(poly, x + 0.5, y + 0.5)
    const m = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && mask[y * N + x]
    const edge = (x: number, y: number) =>
        m(x, y) && (!m(x - 1, y) || !m(x + 1, y) || !m(x, y - 1) || !m(x, y + 1))
    const inner = (x: number, y: number) => m(x, y) && !edge(x, y)
    const art: DieArt = {
        outline: toPath(edge),
        body: toPath(inner),
        light: toPath((x, y) => inner(x, y) && (edge(x - 1, y) || edge(x, y - 1)) && !(edge(x + 1, y) || edge(x, y + 1))),
        shade: toPath((x, y) => inner(x, y) && (edge(x + 1, y) || edge(x, y + 1)) && !(edge(x - 1, y) || edge(x, y - 1))),
        textY: key === 4 ? 20 : key === 10 ? 14 : 16,
    }
    artCache.set(key, art)
    return art
}

// 3×5 digits, one string per row
const DIGITS: Record<string, string[]> = {
    "0": ["111", "101", "101", "101", "111"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["111", "001", "111", "100", "111"],
    "3": ["111", "001", "011", "001", "111"],
    "4": ["101", "101", "111", "001", "001"],
    "5": ["111", "100", "111", "001", "111"],
    "6": ["111", "100", "111", "101", "111"],
    "7": ["111", "001", "010", "010", "010"],
    "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"],
    "-": ["000", "000", "111", "000", "000"],
}

/** Pixel digits centred on (cx, cy) at an integer scale */
export function digitsPath(text: string, cx: number, cy: number, scale = 2): string {
    const chars = text.split("").filter((ch) => DIGITS[ch])
    const w = chars.length * 3 * scale + (chars.length - 1) * scale
    const h = 5 * scale
    const ox = Math.round(cx - w / 2)
    const oy = Math.round(cy - h / 2)
    let d = ""
    chars.forEach((ch, i) => {
        const rows = DIGITS[ch]
        const x0 = ox + i * 4 * scale
        d += toPath(
            (x, y) => rows[Math.floor(y / scale)][Math.floor(x / scale)] === "1",
            3 * scale,
            h,
            x0,
            oy
        )
    })
    return d
}

// d6 pips (3×3 layout positions)
const PIP_SLOTS: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
}

export function pipsPath(value: number): string {
    const slots = PIP_SLOTS[value] ?? []
    const at = [8, 14, 20]
    return slots
        .map((s) => {
            const x = at[s % 3]
            const y = at[Math.floor(s / 3)]
            return `M${x} ${y}h4v4h-4z`
        })
        .join("")
}

/** The value artwork for a die: pips on a d6, digits elsewhere */
export function facePath(sides: number, value: number): string {
    if (sides === 6 && value >= 1 && value <= 6) return pipsPath(value)
    const art = dieArt(sides)
    const text = String(value)
    // Three digits only fit at 1× scale on the narrower shapes
    const scale = text.length >= 3 && sides !== 100 ? 1 : 2
    return digitsPath(text, 16, art.textY, scale)
}
