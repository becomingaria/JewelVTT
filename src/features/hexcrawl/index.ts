import type { FeatureModule } from "../types"
import { setActiveTool } from "../view-state"
import { isMarker, makeCamp, rollTodaysWeather, setParty } from "./actions"
import { HEXCRAWL_HELP } from "./help"
import { HexLayer } from "./HexLayer"
import { HexOverlay } from "./HexOverlay"
import { FeatureIcon, GeneratorIcon, TerrainIcon, TravelIcon } from "./icons"
import {
    generatorOpenStore,
    labelEditStore,
    setUi,
    TOOL_FEATURES,
    TOOL_TERRAIN,
    TOOL_TRAVEL,
    uiStore,
} from "./state"
import { TerrainUnderlay } from "./TerrainUnderlay"

/*
 * Feature: hexcrawl. The overland hex-crawl kit: terrain painting, rivers
 * and roads, hex features, party travel with weather and encounter checks,
 * and a seeded overland generator. See src/features/README.md.
 */

const openGenerator = () => {
    setActiveTool(null)
    generatorOpenStore.set(true)
}

export const feature: FeatureModule = {
    id: "hexcrawl",
    AppLayer: HexLayer,
    BoardUnderlay: TerrainUnderlay,
    underlayZ: 10,
    BoardOverlay: HexOverlay,
    overlayZ: 35,
    tools: [
        {
            id: TOOL_TERRAIN,
            label: "Terrain",
            icon: TerrainIcon,
            hint: "Paint terrain, rivers and roads on hexes",
            hotkey: { key: "e" },
            mapKinds: ["hexcrawl"],
            group: "build",
            kind: "mode",
        },
        {
            id: TOOL_FEATURES,
            label: "Hex features",
            icon: FeatureIcon,
            hint: "Place villages, castles, ruins, lairs and other markers",
            hotkey: { key: "e", shift: true },
            mapKinds: ["hexcrawl"],
            group: "build",
            kind: "mode",
        },
        {
            id: "hexcrawl:generate",
            label: "Generate overland map",
            icon: GeneratorIcon,
            hint: "Make a region from a seed",
            hotkey: { key: "x", shift: true },
            mapKinds: ["hexcrawl"],
            group: "build",
            kind: "action",
            onTrigger: openGenerator,
            pressed: generatorOpenStore,
        },
        {
            id: TOOL_TRAVEL,
            label: "Travel",
            icon: TravelIcon,
            hint: "Move the party hex by hex: days, weather and encounters",
            hotkey: { key: "x" },
            mapKinds: ["hexcrawl"],
            group: "play",
            kind: "mode",
        },
    ],
    commands: [
        {
            id: "hexcrawl:coords",
            label: "Hex crawl: show or hide hex numbers",
            keywords: "coordinates CCRR grid labels",
            mapKinds: ["hexcrawl"],
            run: () => setUi({ showCoords: !uiStore.get().showCoords }),
        },
        {
            id: "hexcrawl:camp",
            label: "Hex crawl: end the travel day (make camp)",
            keywords: "rest night day weather",
            mapKinds: ["hexcrawl"],
            run: makeCamp,
        },
        {
            id: "hexcrawl:weather",
            label: "Hex crawl: roll today's weather",
            keywords: "season climate",
            mapKinds: ["hexcrawl"],
            run: rollTodaysWeather,
        },
        {
            id: "hexcrawl:travel-panel",
            label: "Hex crawl: show the travel panel",
            keywords: "hud day watch",
            mapKinds: ["hexcrawl"],
            run: () => setUi({ hudHidden: false, hudCollapsed: false }),
        },
    ],
    humbugMenu: [
        {
            id: "hexcrawl:label",
            label: "Hex label…",
            icon: "edit",
            when: isMarker,
            run: (h) => labelEditStore.set(h.id),
        },
        {
            id: "hexcrawl:party",
            label: "Make this the travelling party",
            icon: "flag",
            when: (h) => h.type === "token",
            run: setParty,
        },
    ],
    help: [HEXCRAWL_HELP],
    mapKindDefaults: {
        hexcrawl: { boardStyle: "overland", gridShape: "hex", showGrid: true },
    },
}
