import type { Humbug } from "../../types/humbug.types"
import { showToast } from "../../utils/toast"
import { flyTo } from "../../utils/view-events"
import { humbugFootprint } from "../../utils/humbug.utils"
import { humbugsStore, selectHumbugs } from "../board-bridge"
import { netRoleStore } from "../view-state"
import { clientStore } from "./client"
import { ownerOf } from "./filter"
import { openPanel } from "./profile"

/*
 * "Go to my token": centres the view on the player's token. Pressed again,
 * it moves on to their next token. For the GM, it goes round the party.
 */

let turn = 0

const isParty = (h: Humbug) =>
    h.type === "token" && (!!ownerOf(h) || (h.ext?.tracker as { side?: string } | undefined)?.side === "party")

export function goToMyToken() {
    const player = netRoleStore.get() === "player"
    const you = clientStore.get()?.you
    const list = humbugsStore
        .get()
        .filter((h) => (player ? !!you && ownerOf(h) === you : isParty(h)))
        .sort((a, b) => a.createdAt - b.createdAt)
    if (!list.length) {
        if (player) {
            showToast("You haven't placed a character yet.")
            openPanel()
        } else showToast("No party tokens on this board yet.")
        return
    }
    const h = list[turn++ % list.length]
    const size = humbugFootprint(h)
    flyTo({ x: h.position.x + size.width / 2, y: h.position.y + size.height / 2 })
    selectHumbugs([h.id])
    if (list.length > 1) showToast(`${(h.type === "token" && h.name) || "Token"} (${list.indexOf(h) + 1} of ${list.length})`)
}
