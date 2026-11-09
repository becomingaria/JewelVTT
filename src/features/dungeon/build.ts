import type { Humbug } from "../../types/humbug.types"
import { showToast } from "../../utils/toast"
import { addHumbugs, undoGroup, viewCentreWorld } from "../board-bridge"
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
 * One undo step: the floor cells and every door, stamp and room number are
 * recorded together with undoGroup().
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
    const humbugs: Humbug[] = d.placements.map((p) => {
        const cell = { col: p.col + dc, row: p.row + dr }
        return p.stamp === "label"
            ? labelHumbug(p.room ?? 0, cell)
            : stampHumbug(p.stamp, p.state, cell, p.rotation)
    })
    undoGroup(`Build ${name}`, () => {
        editFloor(cells, [], `Build ${name}`)
        if (humbugs.length) addHumbugs(humbugs)
    })

    playSfx("place")
    const summary = describeDungeon(d)
    showToast(`Built ${name}: ${summary}. Undo to remove it.`)
    logEvent({ kind: "system", text: `Built ${name}`, detail: summary })
}
