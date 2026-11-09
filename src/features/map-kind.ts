import type { IconName } from "../components/Icon"
import type { BoardStyleId, GridShape } from "../utils/board-styles"
import { createStore, useStore } from "./store"

/*
 * Every board is one kind of map. The kind picks sensible defaults (grid,
 * style) when a board is created and decides which tools the dock shows.
 * It is saved with the board ("mapKind" slice, registered in App).
 */

export type MapKind = "freeform" | "dungeon" | "hexcrawl" | "slides"

export interface MapKindInfo {
    id: MapKind
    label: string
    description: string
    icon: IconName
}

export const MAP_KINDS: MapKindInfo[] = [
    {
        id: "freeform",
        label: "Freeform board",
        description: "An open whiteboard for anything: maps, notes, images and tokens.",
        icon: "grid",
    },
    {
        id: "dungeon",
        label: "Dungeon crawl",
        description: "Graph paper, rooms and corridors, doors, traps, torchlight and dungeon turns.",
        icon: "map",
    },
    {
        id: "hexcrawl",
        label: "Overland hex crawl",
        description: "A hex map of terrain to explore, with travel days, weather and hidden hexes.",
        icon: "hex",
    },
    {
        id: "slides",
        label: "Slides & flowcharts",
        description: "Frames you step through like a slideshow, with boxes and arrows for flowcharts.",
        icon: "connector",
    },
]

export interface MapKindDefaults {
    gridShape: GridShape
    boardStyle: BoardStyleId
    showGrid: boolean
}

/** Base defaults; features refine them via FeatureModule.mapKindDefaults */
export const BASE_MAP_KIND_DEFAULTS: Record<MapKind, MapKindDefaults> = {
    freeform: { gridShape: "square", boardStyle: "parchment", showGrid: true },
    dungeon: { gridShape: "square", boardStyle: "parchment", showGrid: true },
    hexcrawl: { gridShape: "hex", boardStyle: "parchment", showGrid: true },
    slides: { gridShape: "square", boardStyle: "blank", showGrid: false },
}

/**
 * Map scale: what one grid cell means. Dungeons use the classic 10 ft
 * square; freeform boards 5 ft; hex crawls 6 miles per hex.
 */
export const MAP_SCALE: Record<MapKind, { perCell: number; unit: "ft" | "mi" }> = {
    freeform: { perCell: 5, unit: "ft" },
    dungeon: { perCell: 10, unit: "ft" },
    hexcrawl: { perCell: 6, unit: "mi" },
    slides: { perCell: 5, unit: "ft" },
}

export const mapKindStore = createStore<MapKind>("freeform")
export const useMapKind = () => useStore(mapKindStore)
