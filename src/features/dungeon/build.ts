import type { Humbug } from "../../types/humbug.types"
import { showToast } from "../../utils/toast"
import { addHumbugs, viewCentreWorld } from "../board-bridge"
import { cellAt, cellKey, parseCellKey } from "../grid"
import { logEvent } from "../services"
import { playSfx } from "../sound"
import { describeDungeon, type Dungeon } from "./generator"
import { labelHumbug, stampHumbug } from "./humbugs"
import { editFloor } from "./state"
import { floorBounds } from "./walls"

/**
 * Put a generated dungeon on the board, centred on the view.
 *
 * Two undo steps: the floor cells (one pushUndo) and every door, stamp and
 * room number (one addHumbugs batch). The bridge has no way to group a
 * feature's own state with humbug changes into a single step.
 */
export function buildDungeon(d: Dungeon, name: string) {
    const b = floorBounds(d.floor)
    if (!b) return
    const centre = cellAt(viewCentreWorld(), "square")
    const dc = centre.col - Math.floor((b.minCol + b.maxCol) / 2)
    const dr = centre.row - Math.floor((b.minRow + b.maxRow) / 2)

    const cells = [...d.floor].map((k) => {
        const c = parseCellKey(k)
        return cellKey({ col: c.col + dc, row: c.row + dr })
    })
    editFloor(cells, [], `Build ${name}`)

    const humbugs: Humbug[] = d.placements.map((p) => {
        const cell = { col: p.col + dc, row: p.row + dr }
        return p.stamp === "label"
            ? labelHumbug(p.room ?? 0, cell)
            : stampHumbug(p.stamp, p.state, cell, p.rotation)
    })
    if (humbugs.length) addHumbugs(humbugs)

    playSfx("place")
    const summary = describeDungeon(d)
    showToast(`Built ${name}: ${summary}. Undo twice to remove it.`)
    logEvent({ kind: "system", text: `Built ${name}`, detail: summary })
}
