import type { FeatureModule, HumbugMenuItem } from "../types"
import { netRoleStore } from "../view-state"
import { NetLayer } from "./NetLayer"
import { NetHelp } from "./help"
import { NetIcon } from "./icon"
import { panelOpenStore, togglePanel } from "./profile"
import { createStore } from "../store"
import { PlaceOverlay } from "./PlaceOverlay"
import { goToMyToken } from "./my-token"
import { giveToken, playersStore, takeBack } from "./host"
import { ownerOf } from "./filter"

/*
 * Feature: multiplayer over peer-to-peer connections (no servers).
 * The GM hosts the board; players join with a room link.
 */

const panelPressed = createStore(panelOpenStore.get().open)
panelOpenStore.subscribe(() => panelPressed.set(panelOpenStore.get().open))

const isHost = () => netRoleStore.get() === "host"

/** "Give to <player>" for each connected player, and "Take back" (GM only) */
function netMenu(): HumbugMenuItem[] {
    if (!isHost()) return []
    const players = playersStore.get().filter((p) => p.status === "connected")
    return [
        ...players.map(
            (p): HumbugMenuItem => ({
                id: `net:give-${p.deviceId}`,
                label: `Give to ${p.name}`,
                icon: "link",
                when: (h) => h.type === "token" && ownerOf(h) !== p.deviceId,
                run: (h) => giveToken(h, p.deviceId),
            })
        ),
        {
            id: "net:take-back",
            label: "Take back from player",
            icon: "unlock",
            when: (h) => !!ownerOf(h),
            run: takeBack,
        },
    ]
}

export const feature: FeatureModule = {
    id: "net",
    AppLayer: NetLayer,
    // Players placing a character click the board (above fog and walls)
    BoardOverlay: PlaceOverlay,
    overlayZ: 60,
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
        {
            id: "net:my-token",
            label: "Go to my token (again for the next one)",
            keywords: "character centre center find party person me",
            hotkey: { key: "j" },
            run: goToMyToken,
        },
    ],
    // Read each time a menu opens, so it lists who's connected now
    get humbugMenu() {
        return netMenu()
    },
    help: [{ id: "net", title: "Playing together", icon: "link", body: <NetHelp /> }],
}
