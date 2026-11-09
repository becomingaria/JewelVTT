import { cellAt, cellCenter, cellDistance, cellKey, cellsWithin, type Cell } from "../grid"
import { viewCentreWorld } from "../board-bridge"
import { applyDiff, diffFor, edgeKey, edgesAt, emptyDiff, type MapDiff } from "./map-data"
import { mapStore, pushMapUndo, type Brush } from "./state"

/* Terrain brush strokes: paint, erase, and river/road links */

/** Hexes along a straight line between two hexes (fast drags skip none) */
export function hexLine(a: Cell, b: Cell): Cell[] {
    const n = cellDistance(a, b, "hex")
    if (n <= 1) return [b]
    const pa = cellCenter(a, "hex")
    const pb = cellCenter(b, "hex")
    const out: Cell[] = []
    let last = a
    for (let i = 1; i <= n * 2; i++) {
        const t = i / (n * 2)
        const c = cellAt({ x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t }, "hex")
        if (cellKey(c) !== cellKey(last)) {
            out.push(c)
            last = c
        }
    }
    return out
}

/** Apply one brush dab, returning the diff it made */
export function dab(brush: Brush, size: number, cell: Cell, prev: Cell | null): MapDiff {
    const m = mapStore.get()
    let diff: MapDiff
    if (brush === "river" || brush === "road") {
        if (!prev || cellDistance(prev, cell, "hex") !== 1) return emptyDiff()
        diff = diffFor(m, { [brush === "river" ? "rivers" : "roads"]: { [edgeKey(prev, cell)]: true } })
    } else if (brush === "erase-paths") {
        const off = (kind: "river" | "road") =>
            Object.fromEntries(edgesAt(m, kind, cell).map((e) => [e, false]))
        diff = diffFor(m, { rivers: off("river"), roads: off("road") })
    } else {
        const cells = cellsWithin(cell, size - 1, "hex")
        const t = brush === "erase" ? undefined : brush
        diff = diffFor(m, { cells: Object.fromEntries(cells.map((c) => [cellKey(c), t])) })
    }
    mapStore.set((mm) => applyDiff(mm, diff, "after"))
    return diff
}

export const brushUndoLabel = (b: Brush) =>
    b === "river" ? "Draw river" : b === "road" ? "Draw road" : b.startsWith("erase") ? "Erase hexes" : "Paint terrain"

/** Keyboard path: paint the hex at the centre of the view */
export function paintCentreHex(brush: Brush, size: number) {
    const cell = cellAt(viewCentreWorld(), "hex")
    pushMapUndo(dab(brush, size, cell, null), brushUndoLabel(brush))
    return cell
}
