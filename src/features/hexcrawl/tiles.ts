/*
 * Pixel-art terrain tiles: one pointy-top hex, 1 texel per world unit.
 * A dithered base colour plus small original glyphs (tree clumps, hill
 * bumps, peaks, reeds, dune ripples, waves...). Each terrain has several
 * variants so a painted map doesn't look tiled. Pure: returns RGBA.
 */

import {
    bitmap,
    mulberry32,
    rgb,
    mixRgb,
    setPx,
    stamp,
    glyphSize,
    type Bitmap,
    type Glyph,
    type RGB,
} from "./pixels"
import { terrainDef, type TerrainId } from "./terrain"

/** Hex geometry in texels (matches HEX_W = 32 world units) */
export const TILE_W = 32
export const TILE_H = 38
export const TILE_CX = 16
export const TILE_CY = 19
const HEX_R = TILE_W / Math.sqrt(3)

export const TILE_VARIANTS = 6

/** Is a texel centre inside the hex (shrunk by `inset` texels)? */
function inHex(x: number, y: number, inset: number) {
    const dx = Math.abs(x + 0.5 - TILE_CX)
    const dy = Math.abs(y + 0.5 - TILE_CY)
    const half = TILE_W / 2 - inset
    const r = HEX_R - inset * 1.15
    return dx <= half && dy <= r - dx / Math.sqrt(3)
}

// ------------------------------------------------------------------ glyphs
// o ink · f fill · l light · d dark · t trunk · s snow · w water
const TREE: Glyph = [".ooo.", "olffo", "offdo", ".ooo.", "..t.."]
const PINE: Glyph = ["..o..", ".olo.", "olfdo", ".ofo.", "olfdo", "ooooo", "..t.."]
const JUNGLE_TREE: Glyph = [".o.o.o.", "oflflfo", "offffdo", ".offdo.", "..oto..", "...t..."]
const PALM: Glyph = [".oo.oo.", "olfofdo", "o..t..o", "...t...", "...t..."]
const HILL: Glyph = ["..ooo..", ".olffo.", "olfffdo"]
const MOUNTAIN: Glyph = [
    "....o....",
    "...oso...",
    "..ossdo..",
    "..olfdo..",
    ".olffddo.",
    "olfffdddo",
    "ooooooooo",
]
const PEAK: Glyph = ["...o...", "..oso..", ".olfdo.", "olffddo", "ooooooo"]
const REEDS: Glyph = ["o.o.o", "o.o.o", ".ooo.", "wwwww"]
const PUDDLE: Glyph = [".www.", "wwlww", ".www."]
const DUNE: Glyph = ["....oo..", "..oolddo", "oo......"]
const SPECK: Glyph = ["o"]
const DASH: Glyph = ["ooo"]
const TUFT: Glyph = ["l...l", ".o.o.", "..o.."]
const FLAKE: Glyph = [".o.", "olo", ".o."]
const DRIFT: Glyph = ["..ooo.", "oo...o"]
const SHRUB: Glyph = ["o.o", ".o."]
const WAVE: Glyph = [".oo..", "o..oo"]
const SWELL: Glyph = [".oo...oo.", "o..ooo..o"]
const MESA: Glyph = [".ooooo.", "olllldo", "olfffdo", "ooooooo"]
const CRACK: Glyph = ["o.", ".o", "o."]

interface GlyphSet {
    glyph: Glyph
    /** [min, max] count per tile */
    count: [number, number]
}

const GLYPHS: Record<TerrainId, GlyphSet[]> = {
    plains: [
        { glyph: DASH, count: [3, 5] },
        { glyph: SPECK, count: [2, 4] },
    ],
    grassland: [{ glyph: TUFT, count: [4, 6] }],
    forest: [
        { glyph: TREE, count: [4, 6] },
        { glyph: PINE, count: [0, 2] },
    ],
    jungle: [
        { glyph: JUNGLE_TREE, count: [3, 5] },
        { glyph: PALM, count: [1, 2] },
    ],
    hills: [{ glyph: HILL, count: [2, 3] }],
    mountains: [
        { glyph: MOUNTAIN, count: [1, 1] },
        { glyph: PEAK, count: [1, 2] },
    ],
    swamp: [
        { glyph: PUDDLE, count: [1, 2] },
        { glyph: REEDS, count: [3, 4] },
    ],
    desert: [
        { glyph: DUNE, count: [2, 3] },
        { glyph: SPECK, count: [2, 4] },
    ],
    tundra: [
        { glyph: FLAKE, count: [3, 4] },
        { glyph: DRIFT, count: [1, 2] },
        { glyph: SHRUB, count: [1, 2] },
    ],
    water: [{ glyph: WAVE, count: [3, 4] }],
    ocean: [{ glyph: SWELL, count: [2, 3] }],
    badlands: [
        { glyph: MESA, count: [1, 2] },
        { glyph: CRACK, count: [2, 3] },
    ],
}

/** Render one terrain tile (TILE_W × TILE_H, transparent outside the hex) */
export function renderTerrainTile(id: TerrainId, variant: number): Bitmap {
    const def = terrainDef(id)
    const pal = def.palette
    const rand = mulberry32(0x9e3779b1 ^ (variant * 7919 + id.length * 104729 + id.charCodeAt(0) * 131))
    const base = rgb(pal.base)
    const alt = rgb(pal.alt)
    const light = rgb(pal.light)
    const b = bitmap(TILE_W, TILE_H)

    // Soft patches of the dither colour so tiles aren't flat
    const blobs = Array.from({ length: 3 }, () => ({
        x: 4 + rand() * (TILE_W - 8),
        y: 5 + rand() * (TILE_H - 10),
        r: 4 + rand() * 6,
    }))
    for (let y = 0; y < TILE_H; y++)
        for (let x = 0; x < TILE_W; x++) {
            // Slightly inflated so neighbouring tiles leave no gaps
            if (!inHex(x, y, -0.6)) continue
            const inBlob = blobs.some((bl) => (x - bl.x) ** 2 + (y - bl.y) ** 2 < bl.r * bl.r)
            let c: RGB = base
            if (inBlob && (x + y) % 2 === 0) c = alt
            const n = rand()
            if (n < 0.035) c = alt
            else if (n > 0.985) c = mixRgb(base, light, 0.6)
            setPx(b, x, y, c)
        }

    const palette: Record<string, RGB> = {
        o: rgb(pal.ink),
        f: rgb(pal.fill),
        l: light,
        d: rgb(pal.dark),
        t: rgb("#5a3a1e"),
        s: rgb("#f6f6f0"),
        w: rgb(pal.fill),
    }

    // Place glyphs without overlap, inside the hex, then draw back to front
    const placed: { g: Glyph; x: number; y: number; w: number; h: number; flip: boolean }[] = []
    const fits = (x: number, y: number, w: number, h: number) => {
        for (let gy = 0; gy < h; gy++)
            for (let gx = 0; gx < w; gx++) if (!inHex(x + gx, y + gy, 2)) return false
        return !placed.some(
            (p) => x < p.x + p.w + 1 && x + w + 1 > p.x && y < p.y + p.h + 1 && y + h + 1 > p.y
        )
    }
    for (const set of GLYPHS[id]) {
        const [lo, hi] = set.count
        const want = lo + Math.floor(rand() * (hi - lo + 1))
        const { w, h } = glyphSize(set.glyph)
        let got = 0
        for (let attempt = 0; attempt < 80 && got < want; attempt++) {
            const x = Math.floor(rand() * (TILE_W - w + 1))
            const y = Math.floor(rand() * (TILE_H - h + 1))
            if (!fits(x, y, w, h)) continue
            placed.push({ g: set.glyph, x, y, w, h, flip: rand() < 0.5 })
            got++
        }
    }
    placed
        .sort((a, b2) => a.y + a.h - (b2.y + b2.h))
        .forEach((p) => stamp(b, p.g, palette, p.x, p.y, { flip: p.flip, mask: true }))
    return b
}

/** Which variant a hex uses (deterministic, so the map is stable) */
export const variantFor = (col: number, row: number) => {
    let h = Math.imul(col | 0, 73856093) ^ Math.imul(row | 0, 19349663)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) % TILE_VARIANTS
}
