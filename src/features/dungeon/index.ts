import type { FeatureModule } from "../types"
import { DungeonLayer } from "./DungeonLayer"
import { DungeonOverlay } from "./DungeonOverlay"
import { FloorUnderlay } from "./FloorUnderlay"
import { DUNGEON_HELP } from "./help"
import { generatorIcon, roomsIcon, stampsIcon } from "./icons"
import { HUMBUG_MENU } from "./menu"
import { FEATURE_ID, PALETTE_TOOL, ROOMS_TOOL, STAMP_TOOL } from "./model"
import { requestPanelFocus } from "./panel-focus"
import { paletteOpenStore, panelStore, togglePanel } from "./state"
import { activeToolStore } from "../view-state"
import "./sight"

/*
 * Feature: dungeon. Graph-paper dungeon building: rooms and corridors with
 * automatic walls and hatching, door/trap/secret-door stamps, a stamp
 * palette, a seeded generator and starter dungeons.
 * See src/features/README.md.
 */

const openPanel = (p: "generator" | "starters") => {
    if (panelStore.get() !== p) requestPanelFocus()
    togglePanel(p)
}

export const feature: FeatureModule = {
    id: FEATURE_ID,
    AppLayer: DungeonLayer,
    BoardUnderlay: FloorUnderlay,
    underlayZ: 20,
    BoardOverlay: DungeonOverlay,
    overlayZ: 40,
    tools: [
        {
            id: ROOMS_TOOL,
            label: "Rooms & corridors",
            icon: roomsIcon,
            hint: "Drag floor onto the grid; Alt erases",
            hotkey: { key: "w" },
            mapKinds: ["dungeon"],
            group: "build",
            kind: "mode",
        },
        {
            id: PALETTE_TOOL,
            label: "Stamps",
            icon: stampsIcon,
            hint: "Doors, traps, stairs and dungeon dressing",
            hotkey: { key: "s" },
            mapKinds: ["dungeon"],
            group: "build",
            kind: "action",
            pressed: paletteOpenStore,
            onTrigger: () => {
                const open = paletteOpenStore.get()
                if (open && activeToolStore.get() === STAMP_TOOL) activeToolStore.set(null)
                if (!open) requestPanelFocus()
                paletteOpenStore.set(!open)
            },
        },
        {
            id: "dungeon-generator",
            label: "Dungeon generator",
            icon: generatorIcon,
            hint: "Shift+W · starter dungeons: Shift+S",
            mapKinds: ["dungeon"],
            group: "build",
            kind: "action",
            onTrigger: () => openPanel("generator"),
        },
    ],
    commands: [
        {
            id: "dungeon-generate",
            label: "Generate a dungeon…",
            keywords: "random dungeon generator rooms seed map",
            hotkey: { key: "w", shift: true },
            run: () => openPanel("generator"),
        },
        {
            id: "dungeon-starters",
            label: "Starter dungeons…",
            keywords: "preset dungeon crypt caves tower warren shrine",
            hotkey: { key: "s", shift: true },
            run: () => openPanel("starters"),
        },
    ],
    humbugMenu: HUMBUG_MENU,
    help: [DUNGEON_HELP],
    mapKindDefaults: {
        dungeon: { boardStyle: "graph-paper", gridShape: "square", showGrid: true },
    },
}

