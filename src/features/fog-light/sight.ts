import type { Humbug, Point } from "../../types/humbug.types"
import type { GridShape } from "../../utils/board-styles"
import { humbugFootprint } from "../../utils/humbug.utils"
import { humbugsStore, pushUndo, selectionStore, updateHumbugs } from "../board-bridge"
import { cellAt, cellCenter, cellKey, cellPolygon, cellsInRect, parseCellKey, type CellKey } from "../grid"
import { sightSourceList, sightVersionStore, type SightSegment } from "../services"
import { createStore, useStore } from "../store"
import { FEATURE_ID } from "./ids"

/*
 * Line of sight. Tokens see (and lights shine) only where nothing blocks
 * the way:
 * - walls from other features (the dungeon floor's walls)
 * - walls the GM draws over a map picture (saved as "fog-light:walls")
 * - any object with "Blocks sight" on: pillars, statues, closed doors...
 *   (each object has the switch; sensible defaults per kind of object)
 *
 * A cell counts as seen when a straight line reaches any of a few points
 * inside it without crossing a wall. A blocking object's own cells are
 * always seen (you see the pillar, not what's behind it).
 */

// ------------------------------------------------------- blocks sight
export interface SightExt {
    vision?: number
    /** Set by the GM; undefined = the default for this kind of object */
    blocksSight?: boolean
}

const sightExt = (h: Humbug) => h.ext?.[FEATURE_ID] as SightExt | undefined

/** Dungeon stamps that stand in the way */
const SOLID_STAMPS = new Set(["pillar", "statue", "crate"])

/** Whether this kind of object blocks sight unless the GM says otherwise */
export function defaultBlocksSight(h: Pick<Humbug, "type" | "ext">): boolean {
    const d = h.ext?.dungeon as { stamp?: string; state?: string } | undefined
    if (d?.stamp) {
        if (d.stamp === "door") return d.state !== "open" && d.state !== "portcullis"
        if (d.stamp === "secret") return d.state !== "found"
        return SOLID_STAMPS.has(d.stamp)
    }
    // Tokens, maps, notes, pins, pictures and colour blocks don't, by default
    return false
}

export function blocksSight(h: Humbug): boolean {
    const v = sightExt(h)?.blocksSight
    return typeof v === "boolean" ? v : defaultBlocksSight(h)
}

/** ext with blocksSight set (undefined clears it back to the default) */
export function withBlocksSight(ext: Humbug["ext"], value: boolean | undefined): Humbug["ext"] {
    const own: SightExt = { ...(ext?.[FEATURE_ID] as SightExt | undefined) }
    if (value === undefined) delete own.blocksSight
    else own.blocksSight = value
    return { ...ext, [FEATURE_ID]: own }
}

/** Turn "Blocks sight" on or off for a humbug (and the rest of the selection) */
export function setBlocksSight(h: Humbug, on: boolean) {
    const sel = selectionStore.get()
    const ids = new Set(sel.includes(h.id) ? sel : [h.id])
    const targets = humbugsStore.get().filter((x) => ids.has(x.id))
    updateHumbugs(
        (targets.length ? targets : [h]).map((x) => ({
            id: x.id,
            changes: { ext: withBlocksSight(x.ext, on === defaultBlocksSight(x) ? undefined : on) },
        }))
    )
}

// -------------------------------------------------------------- GM walls
export interface Wall extends SightSegment {
    id: string
}

/** Walls drawn by the GM (saved with the board, never sent to players) */
export const wallsStore = createStore<readonly Wall[]>([])
export const useWalls = () => useStore(wallsStore)

let wallSeq = 0
export const newWallId = () => `wall_${Date.now().toString(36)}_${(wallSeq++).toString(36)}`

export function commitWalls(label: string, before: readonly Wall[], after: readonly Wall[]) {
    if (before === after) return
    wallsStore.set(after)
    pushUndo({ label, undo: () => wallsStore.set(before), redo: () => wallsStore.set(after) })
}

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n)

export function deserializeWalls(v: unknown): Wall[] {
    if (!Array.isArray(v)) return []
    return v
        .filter((w) => w && isNum(w.x1) && isNum(w.y1) && isNum(w.x2) && isNum(w.y2))
        .map((w) => ({ id: typeof w.id === "string" ? w.id : newWallId(), x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }))
}

// ------------------------------------------------------------- the world
interface Seg extends SightSegment {
    /** The blocking object these edges belong to */
    owner?: string
}

export interface SightWorld {
    segs: Seg[]
    /** Cells covered by each blocking object */
    owners: Map<CellKey, string[]>
    besides: ((visible: ReadonlySet<string>) => Iterable<string>)[]
    /** Changes whenever anything that blocks sight changes */
    key: string
}

/** Edges of a blocking object, pulled in a little so grazing a corner doesn't block */
function objectSegs(h: Humbug): Seg[] {
    const size = humbugFootprint(h)
    const inset = Math.min(1, size.width / 4, size.height / 4)
    const cx = h.position.x + size.width / 2
    const cy = h.position.y + size.height / 2
    const hw = size.width / 2 - inset
    const hh = size.height / 2 - inset
    const a = ((h.rotation || 0) * Math.PI) / 180
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const pt = (x: number, y: number) => ({ x: cx + x * cos - y * sin, y: cy + x * sin + y * cos })
    const c = [pt(-hw, -hh), pt(hw, -hh), pt(hw, hh), pt(-hw, hh)]
    return c.map((p, i) => {
        const q = c[(i + 1) % 4]
        return { x1: p.x, y1: p.y, x2: q.x, y2: q.y, owner: h.id }
    })
}

function objectCells(h: Humbug, shape: GridShape): CellKey[] {
    const size = humbugFootprint(h)
    const a = { x: h.position.x + 1, y: h.position.y + 1 }
    const b = { x: h.position.x + size.width - 1, y: h.position.y + size.height - 1 }
    const keys = new Set(cellsInRect(a, b, shape).map(cellKey))
    keys.add(cellKey(cellAt({ x: h.position.x + size.width / 2, y: h.position.y + size.height / 2 }, shape)))
    return [...keys]
}

let worldMemo: { humbugs: readonly Humbug[]; walls: readonly Wall[]; version: number; shape: GridShape; world: SightWorld } | null =
    null

/** Everything that blocks sight on this board right now */
export function sightWorld(shape: GridShape, humbugs: readonly Humbug[] = humbugsStore.get()): SightWorld {
    const walls = wallsStore.get()
    const version = sightVersionStore.get()
    const m = worldMemo
    if (m && m.humbugs === humbugs && m.walls === walls && m.version === version && m.shape === shape) return m.world

    const blockers = humbugs.filter(blocksSight)
    const blockerKey = blockers
        .map((h) => `${h.id}@${Math.round(h.position.x)},${Math.round(h.position.y)},${humbugFootprint(h).width},${humbugFootprint(h).height},${h.rotation || 0}`)
        .join(";")
    const key = `${shape}|${version}|${walls.length}:${walls.map((w) => w.id).join(",")}|${blockerKey}`
    // Same blockers as before (e.g. only a token moved): keep the old world
    if (m && m.world.key === key) {
        worldMemo = { humbugs, walls, version, shape, world: m.world }
        return m.world
    }

    const segs: Seg[] = []
    const besides: SightWorld["besides"] = []
    for (const s of sightSourceList()) {
        segs.push(...s.segments())
        if (s.besides) besides.push(s.besides)
    }
    segs.push(...walls)
    const owners = new Map<CellKey, string[]>()
    for (const h of blockers) {
        segs.push(...objectSegs(h))
        for (const k of objectCells(h, shape)) {
            const list = owners.get(k)
            if (list) list.push(h.id)
            else owners.set(k, [h.id])
        }
    }
    const world: SightWorld = { segs, owners, besides, key }
    worldMemo = { humbugs, walls, version, shape, world }
    return world
}

export const worldBlocks = (w: SightWorld) => w.segs.length > 0

// ------------------------------------------------------------- the test
/** Does the open segment p→q cross the wall s? (touching a wall counts) */
function crosses(px: number, py: number, qx: number, qy: number, s: Seg): boolean {
    const rx = qx - px
    const ry = qy - py
    const sx = s.x2 - s.x1
    const sy = s.y2 - s.y1
    const den = rx * sy - ry * sx
    if (Math.abs(den) < 1e-9) return false
    const ox = s.x1 - px
    const oy = s.y1 - py
    const t = (ox * sy - oy * sx) / den
    const u = (ox * ry - oy * rx) / den
    return t > 1e-6 && t < 1 - 1e-6 && u >= -1e-6 && u <= 1 + 1e-6
}

/** Points inside a cell to aim at: its middle, then towards each corner */
function samples(k: CellKey, shape: GridShape): Point[] {
    const c = parseCellKey(k)
    const mid = cellCenter(c, shape)
    return [mid, ...cellPolygon(c, shape).map((v) => ({ x: mid.x + (v.x - mid.x) * 0.7, y: mid.y + (v.y - mid.y) * 0.7 }))]
}

/**
 * Which of `cells` can be seen from `origin`. `ignore` are blocking objects
 * the viewer stands in (a token on a crate still sees out).
 */
export function lineOfSight(
    origin: Point,
    cells: Iterable<CellKey>,
    shape: GridShape,
    world: SightWorld,
    reach: number,
    ignore: ReadonlySet<string> = new Set()
): Set<CellKey> {
    const out = new Set<CellKey>()
    // Only walls near enough to matter
    const pad = reach + 64
    const near = world.segs.filter(
        (s) =>
            (!s.owner || !ignore.has(s.owner)) &&
            Math.max(s.x1, s.x2) >= origin.x - pad &&
            Math.min(s.x1, s.x2) <= origin.x + pad &&
            Math.max(s.y1, s.y2) >= origin.y - pad &&
            Math.min(s.y1, s.y2) <= origin.y + pad
    )
    if (!near.length) {
        for (const k of cells) out.add(k)
    } else {
        for (const k of cells) {
            const own = world.owners.get(k)
            const segs = own ? near.filter((s) => !s.owner || !own.includes(s.owner)) : near
            for (const p of samples(k, shape)) {
                let blocked = false
                for (const s of segs) {
                    if (crosses(origin.x, origin.y, p.x, p.y, s)) {
                        blocked = true
                        break
                    }
                }
                if (!blocked) {
                    out.add(k)
                    break
                }
            }
        }
    }
    // Show the walls themselves at the edge of what's seen
    for (const b of world.besides) for (const k of b(out)) out.add(k)
    return out
}

/** Blocking objects a token is standing in */
export function standingIn(h: Humbug, shape: GridShape, world: SightWorld): Set<string> {
    const size = humbugFootprint(h)
    const k = cellKey(cellAt({ x: h.position.x + size.width / 2, y: h.position.y + size.height / 2 }, shape))
    // ...and a blocking token doesn't blind itself
    return new Set([...(world.owners.get(k) ?? []), h.id])
}
