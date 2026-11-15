import type { Humbug, Point } from "../../types/humbug.types"
import type { GridShape } from "../../utils/board-styles"
import { humbugFootprint } from "../../utils/humbug.utils"
import { humbugsStore, selectionStore, updateHumbugs } from "../board-bridge"
import { cellAt, cellKey, cellsWithin, type CellKey } from "../grid"
import { MAP_SCALE, mapKindStore, type MapKind } from "../map-kind"
import { sightVersionStore } from "../services"
import { createStore, useStore } from "../store"
import { netRoleStore } from "../view-state"
import { FEATURE_ID } from "./ids"
import { lineOfSight, sightWorld, standingIn, wallsStore, type SightWorld } from "./sight"

/*
 * Token vision. A token with a vision distance (or a light) sees the cells
 * around it through the fog, as far as walls and blocking objects allow
 * (see sight.ts). All seeing tokens share what they see: the party's
 * combined view is revealed for everyone, players included.
 *
 * Vision is live (it follows the tokens) and isn't saved as revealed fog.
 * In a player's app it isn't worked out at all: the GM's app sends the fog
 * with vision already in it (the player's app doesn't have every wall).
 */

export interface VisionExt {
    /** How far the token sees, in feet (0 = blind / no vision) */
    vision?: number
}

export const visionFeet = (h: Humbug): number => {
    const v = (h.ext?.[FEATURE_ID] as VisionExt | undefined)?.vision
    return typeof v === "number" && v > 0 ? v : 0
}

/** Feet the token can see: its vision, or its own light if that reaches further */
export function sightFeet(h: Humbug): number {
    const light = h.light ? h.light.bright + h.light.dim : 0
    return Math.max(visionFeet(h), light)
}

/** Vision presets offered to GM and players (feet) */
export const VISION_PRESETS: { feet: number; label: string }[] = [
    { feet: 0, label: "None" },
    { feet: 30, label: "30 ft" },
    { feet: 60, label: "60 ft" },
    { feet: 90, label: "90 ft (infravision)" },
    { feet: 120, label: "120 ft" },
]

/** Cells within reach of a token, ignoring walls */
function cellsInReach(h: Humbug, shape: GridShape, kind: MapKind): { centre: Point; cells: CellKey[]; reach: number } | null {
    const feet = sightFeet(h)
    if (!feet) return null
    const scale = MAP_SCALE[kind]
    // Hex crawls are in miles: seeing tokens see their hex and its neighbours
    const radius = scale.unit === "mi" ? 1 : Math.max(0, feet / scale.perCell)
    const size = humbugFootprint(h)
    const centre = { x: h.position.x + size.width / 2, y: h.position.y + size.height / 2 }
    const cell = cellAt(centre, shape)
    // Bigger tokens see from their edge, not just their middle cell
    const extra = Math.max(0, Math.round(size.width / 32 / 2 - 0.5))
    const r = radius + extra
    const cells: CellKey[] = []
    if (shape === "hex") {
        for (const c of cellsWithin(cell, r, shape)) cells.push(cellKey(c))
    } else {
        // Squares: a round area of sight, not a box
        const reach = Math.ceil(r)
        const limit = (r + 0.5) ** 2
        for (let dr = -reach; dr <= reach; dr++) {
            for (let dc = -reach; dc <= reach; dc++) {
                if (dc * dc + dr * dr <= limit) cells.push(cellKey({ col: cell.col + dc, row: cell.row + dr }))
            }
        }
    }
    return { centre, cells, reach: (r + 1) * 40 }
}

/** Cells every seeing token can see right now */
export function computeVision(
    humbugs: readonly Humbug[],
    shape: GridShape,
    kind: MapKind,
    world: SightWorld = sightWorld(shape)
): Set<CellKey> {
    const out = new Set<CellKey>()
    for (const h of humbugs) {
        if (h.type !== "token") continue
        const area = cellsInReach(h, shape, kind)
        if (!area) continue
        const seen = lineOfSight(area.centre, area.cells, shape, world, area.reach, standingIn(h, shape, world))
        seen.forEach((k) => out.add(k))
    }
    return out
}

/** Live party vision for the current board grid */
export const visionStore = createStore<ReadonlySet<CellKey>>(new Set())
export const useVision = () => useStore(visionStore)

let shapeRef: () => GridShape = () => "square"
/** The fog feature tells vision which grid its cells are on */
export function setVisionShapeSource(fn: () => GridShape) {
    shapeRef = fn
    recomputeVision()
}

let lastKey = ""
export function recomputeVision() {
    // Players get vision from the GM, inside the fog
    if (netRoleStore.get() === "player") {
        lastKey = ""
        if (visionStore.get().size) visionStore.set(new Set())
        return
    }
    const humbugs = humbugsStore.get()
    const shape = shapeRef()
    const kind = mapKindStore.get()
    const world = sightWorld(shape, humbugs)
    // Only tokens that see matter; skip work when none of them (or the walls) changed
    const seeing = humbugs.filter((h) => h.type === "token" && sightFeet(h) > 0)
    const key = `${shape}|${kind}|${world.key}|${seeing
        .map((h) => `${h.position.x},${h.position.y},${sightFeet(h)},${humbugFootprint(h).width}`)
        .join(";")}`
    if (key === lastKey) return
    lastKey = key
    visionStore.set(computeVision(seeing, shape, kind, world))
}

humbugsStore.subscribe(recomputeVision)
mapKindStore.subscribe(recomputeVision)
wallsStore.subscribe(recomputeVision)
sightVersionStore.subscribe(recomputeVision)
netRoleStore.subscribe(recomputeVision)

/** Set vision on a token (and the rest of the selection), one undo step */
export function applyVision(h: Humbug, feet: number) {
    const sel = selectionStore.get()
    const ids = new Set(sel.includes(h.id) ? sel : [h.id])
    const targets = humbugsStore.get().filter((x) => ids.has(x.id) && x.type === "token")
    updateHumbugs(
        (targets.length ? targets : [h]).map((x) => ({
            id: x.id,
            changes: { ext: { ...x.ext, [FEATURE_ID]: { ...(x.ext?.[FEATURE_ID] as object), vision: feet } } },
        }))
    )
}
