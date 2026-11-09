import { cellKey } from "../grid"
import { hashString, mulberry32, pickWeighted, randInt, type Rng } from "./rng"
import type { DoorState, StampId, StampState, StaticStampId } from "./model"

/*
 * Classic dungeon generator: rectangular rooms on a grid, joined by a
 * spanning tree of corridors plus a few loops, with doors at the room
 * mouths, secret doors, traps, stairs, dressing and numbered rooms.
 *
 * Deterministic: the same settings give the same dungeon. The layout uses
 * its own random stream, and doors / traps / dressing each use another, so
 * switching a toggle never reshuffles the rooms.
 */

export type DungeonSize = "small" | "medium" | "large"
export type CorridorStyle = "straight" | "winding"

export interface GenSettings {
    seed: string
    size: DungeonSize
    rooms: number
    corridors: CorridorStyle
    doors: boolean
    secretDoors: boolean
    traps: boolean
    stairs: boolean
    dressing: boolean
    numbers: boolean
}

export const SIZES: Record<DungeonSize, { label: string; w: number; h: number; rooms: number }> = {
    small: { label: "Small", w: 32, h: 24, rooms: 6 },
    medium: { label: "Medium", w: 46, h: 34, rooms: 10 },
    large: { label: "Large", w: 64, h: 46, rooms: 16 },
}

export const ROOM_COUNT = { min: 2, max: 30 }

export const DEFAULT_SETTINGS: GenSettings = {
    seed: "1979",
    size: "medium",
    rooms: 10,
    corridors: "straight",
    doors: true,
    secretDoors: true,
    traps: true,
    stairs: true,
    dressing: true,
    numbers: true,
}

export interface GenRoom {
    col: number
    row: number
    w: number
    h: number
    number: number
}

/** Something to put on the map: a stamp, or a room-number label */
export interface GenPlacement {
    col: number
    row: number
    stamp: StampId | "label"
    state?: StampState
    /** 90 = turned for an east-west passage */
    rotation: 0 | 90
    room?: number
}

export interface Dungeon {
    width: number
    height: number
    floor: Set<string>
    rooms: GenRoom[]
    placements: GenPlacement[]
    counts: { rooms: number; doors: number; secretDoors: number; traps: number; stamps: number }
}

interface Pt {
    c: number
    r: number
}

const PAD = 2 // min cells between rooms, so each keeps its own walls

function placeRooms(rng: Rng, want: number, W: number, H: number): Omit<GenRoom, "number">[] {
    const rooms: Omit<GenRoom, "number">[] = []
    const maxW = Math.max(4, Math.round(W / 5))
    const maxH = Math.max(4, Math.round(H / 5))
    for (let tries = 0; rooms.length < want && tries < want * 80; tries++) {
        // Mostly modest rooms, now and then a hall
        const big = rng() < 0.2
        const w = Math.min(maxW + 2, randInt(rng, 3, maxW - 2) + (big ? randInt(rng, 1, 4) : 0))
        const h = Math.min(maxH + 2, randInt(rng, 3, maxH - 2) + (big ? randInt(rng, 1, 3) : 0))
        const col = randInt(rng, 1, W - w - 1)
        const row = randInt(rng, 1, H - h - 1)
        const clash = rooms.some(
            (o) =>
                col - PAD < o.col + o.w &&
                o.col - PAD < col + w &&
                row - PAD < o.row + o.h &&
                o.row - PAD < row + h
        )
        if (!clash) rooms.push({ col, row, w, h })
    }
    return rooms
}

const centre = (r: Omit<GenRoom, "number">): Pt => ({
    c: r.col + Math.floor(r.w / 2),
    r: r.row + Math.floor(r.h / 2),
})

/** Spanning tree (Prim, Manhattan distance) plus a few extra loops */
function connect(rng: Rng, rooms: GenRoom[]): [number, number][] {
    const n = rooms.length
    if (n < 2) return []
    const cs = rooms.map(centre)
    const dist = (a: number, b: number) => Math.abs(cs[a].c - cs[b].c) + Math.abs(cs[a].r - cs[b].r)
    const inTree = new Set([0])
    const edges: [number, number][] = []
    while (inTree.size < n) {
        let best: [number, number] | null = null
        let bestD = Infinity
        for (const a of inTree)
            for (let b = 0; b < n; b++) {
                if (inTree.has(b)) continue
                const d = dist(a, b)
                if (d < bestD) {
                    bestD = d
                    best = [a, b]
                }
            }
        edges.push(best!)
        inTree.add(best![1])
    }
    const linked = (a: number, b: number) => edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
    for (let a = 0; a < n; a++) {
        if (rng() >= 0.2) continue
        let near = -1
        let nearD = Infinity
        for (let b = 0; b < n; b++) {
            if (b === a || linked(a, b)) continue
            const d = dist(a, b)
            if (d < nearD) {
                nearD = d
                near = b
            }
        }
        if (near >= 0) edges.push([a, near])
    }
    return edges
}

function walkL(a: Pt, b: Pt, horizontalFirst: boolean, out: Pt[]) {
    const corner = horizontalFirst ? { c: b.c, r: a.r } : { c: a.c, r: b.r }
    const line = (p: Pt, q: Pt) => {
        const dc = Math.sign(q.c - p.c)
        const dr = Math.sign(q.r - p.r)
        let c = p.c
        let r = p.r
        out.push({ c, r })
        while (c !== q.c || r !== q.r) {
            c += dc
            r += dr
            out.push({ c, r })
        }
    }
    line(a, corner)
    line(corner, b)
}

const inside = (room: Omit<GenRoom, "number">, rng: Rng): Pt => ({
    c: randInt(rng, room.col, room.col + room.w - 1),
    r: randInt(rng, room.row, room.row + room.h - 1),
})

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const DOOR_STATES: (readonly [DoorState, number])[] = [
    ["closed", 0.55],
    ["open", 0.15],
    ["locked", 0.18],
    ["barred", 0.07],
    ["portcullis", 0.05],
]

const DRESSING: (readonly [StaticStampId, number])[] = [
    ["rubble", 3],
    ["bones", 3],
    ["web", 3],
    ["barrel", 2],
    ["crate", 2],
    ["chest", 2],
    ["table", 2],
    ["statue", 2],
    ["bed", 1],
    ["altar", 1],
    ["well", 1],
    ["fountain", 1],
    ["trapdoor", 1],
]

/** Look best in the middle of a room */
const CENTREPIECES = new Set<StaticStampId>(["altar", "well", "fountain", "statue", "table"])

export function generateDungeon(settings: GenSettings): Dungeon {
    const base = hashString(settings.seed.trim() || "0")
    const layoutRng = mulberry32(base)
    const doorRng = mulberry32(base ^ 0x5eed_d00d)
    const trapRng = mulberry32(base ^ 0x0007_7a95)
    const dressRng = mulberry32(base ^ 0x00de_c0de)

    const { w: W, h: H } = SIZES[settings.size] ?? SIZES.medium
    const want = clamp(Math.round(settings.rooms) || 0, ROOM_COUNT.min, ROOM_COUNT.max)

    // ---- rooms, numbered in reading order (bands of rows, then left to right)
    const rooms: GenRoom[] = placeRooms(layoutRng, want, W, H)
        .map((r) => ({ ...r, band: Math.floor(centre(r).r / 10), cx: centre(r).c }))
        .sort((a, b) => a.band - b.band || a.cx - b.cx)
        .map(({ col, row, w, h }, i) => ({ col, row, w, h, number: i + 1 }))

    const roomAt = new Map<string, number>()
    rooms.forEach((rm, i) => {
        for (let r = rm.row; r < rm.row + rm.h; r++)
            for (let c = rm.col; c < rm.col + rm.w; c++) roomAt.set(cellKey({ col: c, row: r }), i)
    })

    // ---- corridors
    const edges = connect(layoutRng, rooms)
    const path: Pt[] = []
    for (const [a, b] of edges) {
        const start = inside(rooms[a], layoutRng)
        const end = inside(rooms[b], layoutRng)
        if (settings.corridors === "winding") {
            const stops = [start]
            const legs = randInt(layoutRng, 1, 2)
            for (let i = 0; i < legs; i++) {
                const lo = { c: Math.min(start.c, end.c) - 4, r: Math.min(start.r, end.r) - 4 }
                const hi = { c: Math.max(start.c, end.c) + 4, r: Math.max(start.r, end.r) + 4 }
                stops.push({
                    c: clamp(randInt(layoutRng, lo.c, hi.c), 1, W - 2),
                    r: clamp(randInt(layoutRng, lo.r, hi.r), 1, H - 2),
                })
            }
            stops.push(end)
            for (let i = 1; i < stops.length; i++) walkL(stops[i - 1], stops[i], layoutRng() < 0.5, path)
        } else {
            walkL(start, end, layoutRng() < 0.5, path)
        }
    }

    const floor = new Set<string>(roomAt.keys())
    for (const p of path) floor.add(cellKey({ col: p.c, row: p.r }))
    const isFloor = (c: number, r: number) => floor.has(cellKey({ col: c, row: r }))
    const isRoom = (c: number, r: number) => roomAt.has(cellKey({ col: c, row: r }))

    // Corridor cells in a fixed order (row, col) so later picks are stable
    const corridor: Pt[] = [...floor]
        .filter((k) => !roomAt.has(k))
        .map((k) => {
            const [c, r] = k.split(",").map(Number)
            return { c, r }
        })
        .sort((a, b) => a.r - b.r || a.c - b.c)

    const placements: GenPlacement[] = []
    const taken = new Set<string>()
    const put = (p: GenPlacement) => {
        placements.push(p)
        taken.add(cellKey({ col: p.col, row: p.row }))
    }

    // ---- doors: one-cell-wide corridor mouths right outside a room
    const doorCells: Pt[] = []
    let doors = 0
    let secretDoors = 0
    for (const p of corridor) {
        const n = isRoom(p.c, p.r - 1)
        const s = isRoom(p.c, p.r + 1)
        const e = isRoom(p.c + 1, p.r)
        const w = isRoom(p.c - 1, p.r)
        if (+n + +s + +e + +w !== 1) continue
        let rotation: 0 | 90
        if (n || s) {
            if (isFloor(p.c - 1, p.r) || isFloor(p.c + 1, p.r)) continue
            if (!isFloor(p.c, n ? p.r + 1 : p.r - 1)) continue
            rotation = 0
        } else {
            if (isFloor(p.c, p.r - 1) || isFloor(p.c, p.r + 1)) continue
            if (!isFloor(e ? p.c - 1 : p.c + 1, p.r)) continue
            rotation = 90
        }
        // Always draw both numbers so toggles don't shift later choices
        const kind = doorRng()
        const state = pickWeighted(doorRng, DOOR_STATES)
        if (settings.secretDoors && kind < 0.12) {
            put({ col: p.c, row: p.r, stamp: "secret", state: "hidden", rotation })
            secretDoors++
        } else if (settings.doors && kind < 0.72) {
            put({ col: p.c, row: p.r, stamp: "door", state, rotation })
            doors++
        } else continue
        doorCells.push(p)
    }
    const nearDoor = (c: number, r: number) =>
        doorCells.some((d) => Math.abs(d.c - c) + Math.abs(d.r - r) <= 1)

    // ---- room numbers sit in each room's top-left cell
    if (settings.numbers)
        for (const rm of rooms) put({ col: rm.col, row: rm.row, stamp: "label", rotation: 0, room: rm.number })

    // ---- stairs: up in room 1, down in the room farthest from it
    if (settings.stairs && rooms.length) {
        const corner = (rm: GenRoom) => ({ col: rm.col + rm.w - 1, row: rm.row + rm.h - 1 })
        put({ ...corner(rooms[0]), stamp: "stairs-up", rotation: 0 })
        if (rooms.length > 1) {
            const depth = new Array(rooms.length).fill(-1)
            depth[0] = 0
            const queue = [0]
            while (queue.length) {
                const a = queue.shift()!
                for (const [x, y] of edges) {
                    const b = x === a ? y : y === a ? x : -1
                    if (b >= 0 && depth[b] < 0) {
                        depth[b] = depth[a] + 1
                        queue.push(b)
                    }
                }
            }
            let far = 1
            for (let i = 1; i < rooms.length; i++) if (depth[i] >= depth[far]) far = i
            put({ ...corner(rooms[far]), stamp: "stairs-down", rotation: 0 })
        }
    }

    // ---- traps: hidden, in corridors and rooms, never in a doorway
    let traps = 0
    if (settings.traps) {
        const roomCells: Pt[] = [...roomAt.keys()].sort().map((k) => {
            const [c, r] = k.split(",").map(Number)
            return { c, r }
        })
        const trapCount = Math.max(1, Math.round(rooms.length / 4))
        for (let tries = 0; traps < trapCount && tries < trapCount * 20; tries++) {
            const pool = trapRng() < 0.5 && corridor.length ? corridor : roomCells
            if (!pool.length) break
            const p = pool[Math.floor(trapRng() * pool.length)]
            const k = cellKey({ col: p.c, row: p.r })
            if (taken.has(k) || nearDoor(p.c, p.r)) continue
            put({ col: p.c, row: p.r, stamp: "trap", state: "hidden", rotation: 0 })
            traps++
        }
    }

    // ---- dressing
    let stamps = placements.filter((p) => p.stamp !== "label" && p.stamp !== "door" && p.stamp !== "secret" && p.stamp !== "trap").length
    if (settings.dressing) {
        for (const rm of rooms) {
            const free = (c: number, r: number) => !taken.has(cellKey({ col: c, row: r })) && !nearDoor(c, r)
            // Grand rooms sometimes get four pillars
            if (rm.w >= 5 && rm.h >= 5 && dressRng() < 0.3) {
                for (const [c, r] of [
                    [rm.col + 1, rm.row + 1],
                    [rm.col + rm.w - 2, rm.row + 1],
                    [rm.col + 1, rm.row + rm.h - 2],
                    [rm.col + rm.w - 2, rm.row + rm.h - 2],
                ])
                    if (free(c, r)) {
                        put({ col: c, row: r, stamp: "pillar", rotation: 0 })
                        stamps++
                    }
            }
            const count = randInt(dressRng, 0, rm.w * rm.h >= 20 ? 3 : 2)
            let centreUsed = false
            for (let i = 0; i < count; i++) {
                const stamp = pickWeighted(dressRng, DRESSING)
                let c = randInt(dressRng, rm.col, rm.col + rm.w - 1)
                let r = randInt(dressRng, rm.row, rm.row + rm.h - 1)
                if (CENTREPIECES.has(stamp)) {
                    if (centreUsed) continue
                    centreUsed = true
                    c = rm.col + Math.floor(rm.w / 2)
                    r = rm.row + Math.floor(rm.h / 2)
                }
                if (!free(c, r)) continue
                put({ col: c, row: r, stamp, rotation: 0 })
                stamps++
            }
        }
    }

    return {
        width: W,
        height: H,
        floor,
        rooms,
        placements,
        counts: { rooms: rooms.length, doors, secretDoors, traps, stamps },
    }
}

/** One-line summary for screen readers and the dialog */
export function describeDungeon(d: Dungeon): string {
    const c = d.counts
    const parts = [`${c.rooms} room${c.rooms === 1 ? "" : "s"}`]
    if (c.doors) parts.push(`${c.doors} door${c.doors === 1 ? "" : "s"}`)
    if (c.secretDoors) parts.push(`${c.secretDoors} secret door${c.secretDoors === 1 ? "" : "s"}`)
    if (c.traps) parts.push(`${c.traps} trap${c.traps === 1 ? "" : "s"}`)
    if (c.stamps) parts.push(`${c.stamps} other stamp${c.stamps === 1 ? "" : "s"}`)
    return parts.join(" · ")
}
