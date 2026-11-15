import { registerSightSource, type SightSegment } from "../services"
import { cellKey, parseCellKey, SQUARE } from "../grid"
import { floorStore } from "./state"
import { traceWalls, type FloorSet } from "./walls"

/*
 * The floor's walls block line of sight (fog-light feature). Cells of rock
 * right beside a seen floor cell are shown too, so a room's walls are drawn
 * as far as the party can see.
 */

let memo: { floor: FloorSet; segs: SightSegment[] } | null = null

function segments(): SightSegment[] {
    const floor = floorStore.get()
    if (memo?.floor === floor) return memo.segs
    const segs = traceWalls(floor).map((w) => ({
        x1: w.x1 * SQUARE,
        y1: w.y1 * SQUARE,
        x2: w.x2 * SQUARE,
        y2: w.y2 * SQUARE,
    }))
    memo = { floor, segs }
    return segs
}

function* besides(visible: ReadonlySet<string>): Iterable<string> {
    const floor = floorStore.get()
    if (!floor.size) return
    for (const k of visible) {
        if (!floor.has(k)) continue
        const c = parseCellKey(k)
        for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
                const n = cellKey({ col: c.col + dc, row: c.row + dr })
                if (!floor.has(n)) yield n
            }
    }
}

registerSightSource("dungeon", {
    segments,
    besides,
    subscribe: (fn) => floorStore.subscribe(fn),
})
