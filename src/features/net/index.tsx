import type { FeatureModule } from "../types"
import { NetLayer } from "./NetLayer"
import { NetHelp } from "./help"
import { NetIcon } from "./icon"
import { panelOpenStore, togglePanel } from "./profile"
import { createStore } from "../store"

/*
 * Feature: multiplayer over peer-to-peer connections (no servers).
 * The GM hosts the board; players join with a room link.
 */

const panelPressed = createStore(panelOpenStore.get().open)
panelOpenStore.subscribe(() => panelPressed.set(panelOpenStore.get().open))

export const feature: FeatureModule = {
    id: "net",
    AppLayer: NetLayer,
    tools: [
        {
            id: "net:panel",
            label: "Multiplayer",
            hint: "Host a game or join one",
            icon: <NetIcon />,
            group: "view",
            kind: "action",
            pressed: panelPressed,
            onTrigger: togglePanel,
        },
    ],
    commands: [
        {
            id: "net:panel",
            label: "Multiplayer: host or join a game",
            keywords: "network online players share room link peer",
            run: togglePanel,
        },
    ],
    help: [{ id: "net", title: "Playing together", icon: "link", body: <NetHelp /> }],
}
