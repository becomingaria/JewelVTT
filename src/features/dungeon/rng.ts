/*
 * Seeded randomness for the dungeon feature. Everything procedural here
 * (generator, hatching) must give the same result for the same seed, so
 * nothing in this folder calls Math.random() except "reroll seed".
 */

export type Rng = () => number

/** Small, fast 32-bit PRNG (same algorithm as utils/board-styles.ts) */
export function mulberry32(seed: number): Rng {
    let s = seed | 0
    return () => {
        s = (s + 0x6d2b79f5) | 0
        let t = Math.imul(s ^ (s >>> 15), 1 | s)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/** FNV-1a: turns any seed text ("crypt", "1234") into a 32-bit number */
export function hashString(text: string): number {
    let h = 0x811c9dc5
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
}

/** Stable hash of a cell (plus a salt), for per-cell randomness */
export function hashCell(col: number, row: number, salt = 0): number {
    let h = Math.imul(col | 0, 0x27d4eb2d) ^ Math.imul(row | 0, 0x165667b1) ^ Math.imul(salt, 0x9e3779b1)
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
    return (h ^ (h >>> 16)) >>> 0
}

/** Integer in [lo, hi] inclusive */
export const randInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))

export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]

/** Pick by weight: [[value, weight], ...] */
export function pickWeighted<T>(rng: Rng, items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((s, [, w]) => s + w, 0)
    let r = rng() * total
    for (const [v, w] of items) {
        r -= w
        if (r < 0) return v
    }
    return items[items.length - 1][0]
}

/** A fresh random seed for the reroll button (the only Math.random here) */
export const randomSeed = () => String(100000 + Math.floor(Math.random() * 900000))
