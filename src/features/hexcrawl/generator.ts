/*
 * Overland generator: seeded noise → elevation + moisture → biome, rivers
 * that run downhill to water, settlements and adventure sites on sensible
 * terrain, and roads linking the settlements. Pure and deterministic: the
 * same settings always give the same map.
 */

import { cellDistance, cellKey, cellNeighbors, type Cell, type CellKey } from "../grid"
import { edgeKey, type EdgeKey } from "./map-data"
import type { MarkerKind } from "./markers"
import { hash2, hashString, mulberry32 } from "./pixels"
import { isWater, terrainDef, type TerrainId } from "./terrain"
import type { Climate } from "./weather"

export interface GeneratorSettings {
    seed: string
    width: number
    height: number
    climate: Climate
    /** 0..1: share of hexes under water */
    water: number
    /** 0..1: share of hexes that are mountains */
    mountains: number
    settlements: number
    dungeons: number
    roads: boolean
    /** Top-left hex of the generated area */
    origin: Cell
}

export const DEFAULT_SETTINGS: GeneratorSettings = {
    seed: "",
    width: 24,
    height: 18,
    climate: "temperate",
    water: 0.25,
    mountains: 0.1,
    settlements: 6,
    dungeons: 6,
    roads: true,
    origin: { col: 1, row: 1 },
}

export const LIMITS = {
    width: [6, 80],
    height: [6, 80],
    settlements: [0, 30],
    dungeons: [0, 30],
} as const

export interface GeneratedMarker {
    cell: Cell
    kind: MarkerKind
    label: string
}

export interface GeneratedMap {
    cells: Record<CellKey, TerrainId>
    rivers: EdgeKey[]
    roads: EdgeKey[]
    markers: GeneratedMarker[]
}

// ------------------------------------------------------------------ noise
function valueNoise(seed: number) {
    const at = (i: number, j: number) => hash2(i, j, seed) / 4294967296
    const fade = (t: number) => t * t * (3 - 2 * t)
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

function fbm(seed: number, octaves: number) {
    const layers = Array.from({ length: octaves }, (_, k) => ({ f: 2 ** k, a: 0.5 ** k, n: valueNoise(seed + k * 1013) }))
    const total = layers.reduce((s, l) => s + l.a, 0)
    return (x: number, y: number) => layers.reduce((s, l) => s + l.a * l.n(x * l.f, y * l.f), 0) / total
}

/** Rank-normalise to 0..1 so "25% water" really means a quarter of the hexes */
function percentiles(values: number[]): number[] {
    const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
    const out = new Array<number>(values.length)
    order.forEach(([, i], rank) => (out[i] = rank / Math.max(1, values.length)))
    return out
}

// ------------------------------------------------------------------ names
const PRE = [
    "Ash", "Bram", "Cold", "Dun", "Elder", "Fen", "Gold", "Hart", "Iron", "Kest", "Lark", "Mire",
    "Nettle", "Oak", "Pike", "Raven", "Salt", "Thorn", "Wyn", "Yew", "Copper", "Mill", "Briar", "Grey",
]
const SUF = [
    "ford", "wick", "by", "holm", "stead", "mere", "ton", "bridge", "fell", "gate", "haven", "moor",
    "well", "hollow", "cross", "barrow",
]
const ADJ = [
    "Sunken", "Hollow", "Broken", "Silent", "Black", "Weeping", "Forgotten", "Crooked", "Ashen",
    "Drowned", "Howling", "Gilded", "Bleak", "Red", "Shattered", "Pale",
]
const SITE_NOUN: Record<MarkerKind, string[]> = {
    dungeon: ["Vault", "Halls", "Crypt", "Undercroft"],
    ruin: ["Keep", "Abbey", "Watchpost", "Manse"],
    lair: ["Den", "Nest", "Warren", "Roost"],
    cave: ["Caves", "Grotto", "Delve"],
    tower: ["Spire", "Tower", "Beacon"],
    shrine: ["Shrine", "Chapel", "Altar"],
    landmark: ["Stone", "Monolith", "Cairn", "Arch"],
    village: [],
    town: [],
    city: [],
    castle: [],
}

// --------------------------------------------------------------- generate
export function generateOverland(input: GeneratorSettings): GeneratedMap {
    const s = { ...input }
    s.width = Math.max(LIMITS.width[0], Math.min(LIMITS.width[1], Math.round(s.width)))
    s.height = Math.max(LIMITS.height[0], Math.min(LIMITS.height[1], Math.round(s.height)))
    const seed = hashString(s.seed || "jewel")
    const rand = mulberry32(seed)
    const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]

    // Hexes of the area, in reading order
    const hexes: Cell[] = []
    for (let r = 0; r < s.height; r++)
        for (let c = 0; c < s.width; c++) hexes.push({ col: s.origin.col + c, row: s.origin.row + r })
    const index = new Map<CellKey, number>(hexes.map((h, i) => [cellKey(h), i]))
    const inside = (c: Cell) => index.has(cellKey(c))
    const nbrs = (c: Cell) => cellNeighbors(c, "hex").filter(inside)

    // Elevation and moisture
    const elevN = fbm(seed ^ 0x51ed, 4)
    const moistN = fbm(seed ^ 0xa11e, 3)
    const span = Math.max(s.width, s.height)
    const elevScale = 1 / Math.max(5, span / 4)
    const moistScale = 1 / Math.max(4, span / 4)
    const pos = (h: Cell) => ({
        x: h.col + ((((h.row % 2) + 2) % 2) ? 0.5 : 0),
        y: h.row * 0.866,
    })
    const rawElev = hexes.map((h) => {
        const p = pos(h)
        let e = elevN(p.x * elevScale + 17.3, p.y * elevScale + 3.1)
        // Edges lean low, so the sea tends to wrap the land
        const c = h.col - s.origin.col
        const r = h.row - s.origin.row
        const edge = Math.min(c, s.width - 1 - c, r, s.height - 1 - r) / Math.min(s.width, s.height)
        e -= 0.22 * s.water * (1 - Math.min(1, edge / 0.3))
        return e
    })
    const elev = percentiles(rawElev)
    const moist = percentiles(
        hexes.map((h) => {
            const p = pos(h)
            return moistN(p.x * moistScale + 101.7, p.y * moistScale + 47.9)
        })
    )

    const water = Math.max(0, Math.min(0.8, s.water))
    const mount = Math.max(0, Math.min(0.6, s.mountains))
    const hillBand = mount > 0 ? Math.min(0.2, mount * 0.6 + 0.05) : 0.04
    const terrain: TerrainId[] = hexes.map((_, i) => {
        const e = elev[i]
        const m = moist[i]
        if (e < water) return "water"
        if (mount > 0 && e >= 1 - mount) return "mountains"
        const low = e < water + 0.12
        const high = e >= 1 - mount - hillBand
        switch (s.climate) {
            case "cold":
                if (high) return m < 0.5 ? "tundra" : "hills"
                if (m < 0.45) return "tundra"
                if (m < 0.75) return "forest"
                if (m < 0.88) return "plains"
                return low ? "swamp" : "tundra"
            case "arid":
                if (high) return m < 0.45 ? "badlands" : "hills"
                if (m < 0.55) return "desert"
                if (m < 0.7) return "badlands"
                if (m < 0.88) return "plains"
                return "grassland"
            case "tropical":
                if (high) return "hills"
                if (m < 0.25) return "grassland"
                if (m < 0.35) return "plains"
                if (m < 0.85) return "jungle"
                return low ? "swamp" : "jungle"
            default:
                if (high) return "hills"
                if (m < 0.2) return "plains"
                if (m < 0.5) return "grassland"
                if (m < 0.86) return "forest"
                return low ? "swamp" : "forest"
        }
    })

    // Water touching the edge of the area is ocean; enclosed water is a lake
    const markOcean = () => {
        const seen = new Set<number>()
        hexes.forEach((_, i) => {
            if (terrain[i] !== "water" || seen.has(i)) return
            const comp: number[] = []
            const stack = [i]
            seen.add(i)
            let edge = false
            while (stack.length) {
                const j = stack.pop()!
                comp.push(j)
                const all = cellNeighbors(hexes[j], "hex")
                if (all.some((n) => !inside(n))) edge = true
                for (const n of all) {
                    const k = index.get(cellKey(n))
                    if (k !== undefined && !seen.has(k) && isWater(terrain[k])) {
                        seen.add(k)
                        stack.push(k)
                    }
                }
            }
            if (edge && comp.length >= 3) comp.forEach((j) => (terrain[j] = "ocean"))
        })
    }
    markOcean()

    // Rivers: from high ground, always to the lowest neighbour, until they
    // reach water, join another river or leave the map. A river trapped in
    // a hollow pools into a lake.
    const rivers = new Set<EdgeKey>()
    const riverHex = new Set<number>()
    const factor = { temperate: 1, cold: 0.8, arid: 0.35, tropical: 1.25 }[s.climate]
    const wantRivers = Math.min(14, Math.round(((s.width * s.height) / 110) * factor))
    const sources = shuffle(
        hexes.map((_, i) => i).filter((i) => !isWater(terrain[i]) && elev[i] > 0.72),
        rand
    )
    const sourceCells: Cell[] = []
    for (const src of sources) {
        if (sourceCells.length >= wantRivers) break
        if (riverHex.has(src)) continue
        if (sourceCells.some((c) => cellDistance(c, hexes[src], "hex") < 4)) continue
        const path: number[] = [src]
        const visited = new Set([src])
        let end: "water" | "join" | "edge" | "pool" = "pool"
        let cur = src
        for (let step = 0; step < hexes.length; step++) {
            const all = cellNeighbors(hexes[cur], "hex")
            const inMap = all.map((n) => index.get(cellKey(n))).filter((k): k is number => k !== undefined)
            const wet = inMap.find((k) => isWater(terrain[k]))
            if (wet !== undefined) {
                path.push(wet)
                end = "water"
                break
            }
            const join = inMap.find((k) => riverHex.has(k) && !visited.has(k))
            if (join !== undefined) {
                path.push(join)
                end = "join"
                break
            }
            if (all.length > inMap.length && rawElev[cur] < 0.45) {
                end = "edge"
                break
            }
            const next = inMap
                .filter((k) => !visited.has(k) && terrain[k] !== "mountains")
                .sort((a, b) => rawElev[a] - rawElev[b])[0]
            if (next === undefined || rawElev[next] > rawElev[cur] + 0.015) {
                end = all.length > inMap.length ? "edge" : "pool"
                break
            }
            path.push(next)
            visited.add(next)
            cur = next
        }
        if (path.length < 3) continue
        if (end === "pool") terrain[path[path.length - 1]] = "water"
        sourceCells.push(hexes[src])
        for (let i = 1; i < path.length; i++) rivers.add(edgeKey(hexes[path[i - 1]], hexes[path[i]]))
        path.forEach((k) => {
            if (!isWater(terrain[k])) riverHex.add(k)
        })
    }
    // Rivers green the land around them in dry country
    if (s.climate === "arid") riverHex.forEach((k) => terrain[k] === "desert" && (terrain[k] = "plains"))

    // Settlements on good, well-watered land
    const taken = new Set<number>()
    const markers: GeneratedMarker[] = []
    const near = (i: number, min: number) => markers.some((m) => cellDistance(m.cell, hexes[i], "hex") < min)
    const coastal = (i: number) => nbrs(hexes[i]).some((n) => isWater(terrain[index.get(cellKey(n))!]))
    const SETTLE: Partial<Record<TerrainId, number>> = {
        plains: 3, grassland: 3, forest: 1.5, hills: 1.6, desert: 0.5, tundra: 0.8,
        swamp: 0.4, jungle: 0.8, badlands: 0.4,
    }
    const settleScore = hexes.map((_, i) => {
        const base = SETTLE[terrain[i]]
        if (!base) return -1
        return base + (riverHex.has(i) ? 2 : 0) + (coastal(i) ? 1.5 : 0) + rand() * 1.5
    })
    const settleOrder = hexes.map((_, i) => i).filter((i) => settleScore[i] > 0).sort((a, b) => settleScore[b] - settleScore[a])
    const wantSettle = Math.max(0, Math.round(s.settlements))
    const settlements: number[] = []
    for (const spacing of [4, 3, 2]) {
        for (const i of settleOrder) {
            if (settlements.length >= wantSettle) break
            if (taken.has(i) || near(i, spacing)) continue
            const n = settlements.length
            const kind: MarkerKind =
                n === 0 ? (wantSettle >= 4 ? "city" : "town")
                    : n === 2 && wantSettle >= 3 ? "castle"
                        : n % 3 === 1 ? "town" : "village"
            const label = kind === "castle" ? `Castle ${pick(PRE)}${pick(SUF)}` : `${pick(PRE)}${pick(SUF)}`
            markers.push({ cell: hexes[i], kind, label })
            settlements.push(i)
            taken.add(i)
        }
    }

    // Adventure sites prefer wild, rough country
    const WILD: Partial<Record<TerrainId, number>> = {
        mountains: 3, hills: 3, forest: 2.5, jungle: 2.5, swamp: 2.5, badlands: 2.5, desert: 2,
        tundra: 1.5, plains: 1, grassland: 1,
    }
    const SITE_KINDS: Partial<Record<TerrainId, MarkerKind[]>> = {
        mountains: ["dungeon", "cave", "lair", "tower"],
        hills: ["dungeon", "cave", "ruin", "lair"],
        forest: ["ruin", "lair", "shrine", "dungeon"],
        jungle: ["ruin", "lair", "shrine", "dungeon"],
        swamp: ["lair", "ruin", "shrine"],
        desert: ["ruin", "dungeon", "landmark", "tower"],
        badlands: ["ruin", "dungeon", "landmark", "cave"],
        tundra: ["cave", "lair", "ruin", "landmark"],
        plains: ["tower", "ruin", "landmark", "shrine", "dungeon"],
        grassland: ["tower", "ruin", "landmark", "shrine", "dungeon"],
    }
    const siteScore = hexes.map((_, i) => (WILD[terrain[i]] ? WILD[terrain[i]]! + rand() * 2.5 : -1))
    const siteOrder = hexes.map((_, i) => i).filter((i) => siteScore[i] > 0).sort((a, b) => siteScore[b] - siteScore[a])
    const wantSites = Math.max(0, Math.round(s.dungeons))
    let sites = 0
    for (const spacing of [3, 2, 1]) {
        for (const i of siteOrder) {
            if (sites >= wantSites) break
            if (taken.has(i) || near(i, spacing)) continue
            const kind: MarkerKind = pick(SITE_KINDS[terrain[i]] ?? ["ruin" as const])
            markers.push({ cell: hexes[i], kind, label: `The ${pick(ADJ)} ${pick(SITE_NOUN[kind])}` })
            taken.add(i)
            sites++
        }
    }

    // Roads: link every settlement into one network along the cheapest
    // overland route (A*), reusing road already built
    const roads = new Set<EdgeKey>()
    if (s.roads && settlements.length >= 2) {
        const onRoad = new Set<number>([settlements[0]])
        const stepCost = (from: number, to: number) => {
            const t = terrain[to]
            if (isWater(t)) return Infinity
            if (roads.has(edgeKey(hexes[from], hexes[to]))) return 0.35
            return (t === "mountains" ? 3.5 : terrainDef(t).cost) + (riverHex.has(to) ? 0.4 : 0)
        }
        const minDist = (i: number) => {
            let best = Infinity
            for (const k of onRoad) best = Math.min(best, cellDistance(hexes[i], hexes[k], "hex"))
            return best
        }
        const aStar = (start: number): number[] | null => {
            const g = new Map<number, number>([[start, 0]])
            const came = new Map<number, number>()
            const open: [number, number][] = [[minDist(start), start]]
            const closed = new Set<number>()
            while (open.length) {
                let bi = 0
                for (let j = 1; j < open.length; j++) if (open[j][0] < open[bi][0]) bi = j
                const [, cur] = open.splice(bi, 1)[0]
                if (closed.has(cur)) continue
                if (onRoad.has(cur) && cur !== start) {
                    const out = [cur]
                    let k = cur
                    while (came.has(k)) {
                        k = came.get(k)!
                        out.push(k)
                    }
                    return out.reverse()
                }
                closed.add(cur)
                for (const n of nbrs(hexes[cur])) {
                    const k = index.get(cellKey(n))!
                    const c = stepCost(cur, k)
                    if (!isFinite(c) || closed.has(k)) continue
                    const ng = g.get(cur)! + c
                    if (ng < (g.get(k) ?? Infinity)) {
                        g.set(k, ng)
                        came.set(k, cur)
                        open.push([ng + minDist(k) * 0.9, k])
                    }
                }
            }
            return null
        }
        const remaining = settlements.slice(1)
        while (remaining.length) {
            // Nearest unconnected settlement first
            remaining.sort((a, b) => minDist(a) - minDist(b))
            const path = aStar(remaining.shift()!)
            if (path) {
                for (let i = 1; i < path.length; i++) roads.add(edgeKey(hexes[path[i - 1]], hexes[path[i]]))
                path.forEach((k) => onRoad.add(k))
            }
        }
    }

    const cells: Record<CellKey, TerrainId> = {}
    hexes.forEach((h, i) => (cells[cellKey(h)] = terrain[i]))
    return { cells, rivers: [...rivers], roads: [...roads], markers }
}

/** Every hex the settings cover (for fog and replacing) */
export function generatedArea(s: Pick<GeneratorSettings, "width" | "height" | "origin">): Cell[] {
    const out: Cell[] = []
    for (let r = 0; r < s.height; r++)
        for (let c = 0; c < s.width; c++) out.push({ col: s.origin.col + c, row: s.origin.row + r })
    return out
}

export const randomSeed = () => {
    const words = ["amber", "barrow", "cinder", "dusk", "ember", "fallow", "gloam", "heath", "ivy", "jade", "kiln", "loam", "marsh", "north", "oxbow", "peat", "quarry", "rune", "sable", "tarn", "umber", "vale", "wold", "yarrow"]
    const w = () => words[Math.floor(Math.random() * words.length)]
    return `${w()}-${w()}-${Math.floor(Math.random() * 900 + 100)}`
}

function shuffle<T>(list: T[], rand: () => number): T[] {
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[list[i], list[j]] = [list[j], list[i]]
    }
    return list
}
