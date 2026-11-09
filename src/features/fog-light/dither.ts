/*
 * Pure helpers for the chunky ordered-dither look shared by fog and light.
 * No imports, so they can be checked from a plain Node script.
 */

/** Classic 4×4 Bayer matrix (values 0..15) */
export const BAYER4: readonly number[] = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5,
]

/** Threshold in (0,1) for a global texel index; stable while panning */
export function bayerThreshold(gi: number, gj: number): number {
    const i = ((gi % 4) + 4) % 4
    const j = ((gj % 4) + 4) % 4
    return (BAYER4[j * 4 + i] + 0.5) / 16
}

/** Smallest world size a fog/light texel may have (a square is 32 → 8 texels) */
export const BASE_TEXEL = 4

/**
 * Texel size in world units: a power-of-two multiple of BASE_TEXEL so the
 * dither pattern stays put, at least `minPx` screen pixels wide, and never
 * more than `maxTexels` texels for the given world box.
 */
export function pickTexel(
    zoom: number,
    boxW: number,
    boxH: number,
    minPx = 3,
    maxTexels = 420_000
): number {
    let t = BASE_TEXEL
    while (t * zoom < minPx || (boxW / t) * (boxH / t) > maxTexels) {
        t *= 2
        if (t > 1 << 16) break
    }
    return t
}

/**
 * Light level at distance d from a source: 1 inside the bright radius,
 * 0.5 in the dim ring, 0 beyond, with linear ramps `w` wide at each edge
 * (the ramps are what the dither turns into chunky pixel bands).
 */
export function lightLevel(d: number, bright: number, outer: number, w: number): number {
    const half = w / 2
    const b = bright > 0 ? Math.min(1, Math.max(0, (bright + half - d) / w)) : 0
    const o = outer > 0 ? Math.min(1, Math.max(0, (outer + half - d) / w)) : 0
    return Math.max(b, 0.5 * o)
}

/** Snap a 0..1 light level to 0 / 0.5 / 1 with an ordered dither */
export function quantizeLight(level: number, threshold: number): number {
    if (level >= 1) return 1
    if (level <= 0) return 0
    if (level >= 0.5) return (level - 0.5) * 2 > threshold ? 1 : 0.5
    return level * 2 > threshold ? 0.5 : 0
}

/**
 * Flicker factor (1 ± 0.03), a soft wobble about twice a second (slow
 * enough that no edge pixel flashes more than ~2×/s). `phase` keeps
 * neighbouring torches out of step.
 */
export function flickerFactor(tSeconds: number, phase: number): number {
    const a = Math.sin(2 * Math.PI * 2 * tSeconds + phase)
    const b = Math.sin(2 * Math.PI * 1.3 * tSeconds + phase * 2.1)
    return 1 + 0.03 * (0.6 * a + 0.4 * b)
}

/** Cheap integer hash → 0..1, for procedural stone texture */
export function hash2(x: number, y: number): number {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
}

/** Pack RGBA (0..255) into a little-endian ImageData word */
export const packRGBA = (r: number, g: number, b: number, a: number) =>
    ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
