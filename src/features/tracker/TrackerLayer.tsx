import React, { useEffect } from "react"
import { useBoardSlice } from "../../utils/board-store"
import { loadParty, onPartyChanged } from "../../utils/party"
import { useStore } from "../store"
import { normaliseDungeon, normaliseInit, type DungeonState, type InitState } from "./logic"
import { dungeonStore, initStore, partyStore, stripPickStore } from "./state"
import { InitiativeStrip } from "./InitiativeStrip"
import { DungeonHud } from "./DungeonHud"
import { TokenPopover } from "./TokenPopover"
import { CharGenDialog } from "./CharGenDialog"
import "./tracker.css"

/** Mounted once at the app root: saves tracker state with the board and shows its panels */
export const TrackerLayer: React.FC = () => {
    const init = useStore(initStore)
    const dungeon = useStore(dungeonStore)

    useBoardSlice<InitState>("tracker:initiative", init, (v) => {
        initStore.set(normaliseInit(v))
        stripPickStore.set(null)
    })
    useBoardSlice<DungeonState>("tracker:dungeon", dungeon, (v) => dungeonStore.set(normaliseDungeon(v)))

    // "My Party" images count as the party side; keep their names for labels
    useEffect(() => {
        let alive = true
        const load = () =>
            loadParty().then((p) => {
                if (alive) partyStore.set(new Map(p.map((m) => [m.imageUrl, m.name])))
            })
        void load()
        const off = onPartyChanged(() => void load())
        return () => {
            alive = false
            off()
        }
    }, [])

    // Forget a picked portrait that has left the order
    useEffect(() => {
        const pick = stripPickStore.get()
        if (pick && !init.order.some((c) => c.id === pick)) stripPickStore.set(null)
    }, [init.order])

    return (
        <>
            <div className='tracker-top'>
                <InitiativeStrip />
                <DungeonHud />
            </div>
            <TokenPopover />
            <CharGenDialog />
        </>
    )
}
