import { pushUndo } from "../board-bridge"
import { createPersistentStore, createStore } from "../store"
import { applyDiff, diffFor, diffSize, EMPTY_MAP, type HexMap, type MapDiff } from "./map-data"
import type { MarkerKind } from "./markers"
import type { TerrainId } from "./terrain"
import type { Climate, Season } from "./weather"
import { DEFAULT_SETTINGS, type GeneratorSettings } from "./generator"

/*
 * Hex crawl state.
 * - mapStore: terrain, rivers and roads (saved with the board)
 * - travelStore: day, season, weather, party (saved with the board)
 * - uiStore: this viewer's brush, panel position... (localStorage)
 */

export const TOOL_TERRAIN = "hexcrawl:terrain"
export const TOOL_FEATURES = "hexcrawl:features"
export const TOOL_TRAVEL = "hexcrawl:travel"

// -------------------------------------------------------------------- map
export const mapStore = createStore<HexMap>(EMPTY_MAP)

/** Record an already-applied map change as one undo step */
export function pushMapUndo(diff: MapDiff, label: string) {
    if (!diffSize(diff)) return
    pushUndo({
        label,
        undo: () => mapStore.set((m) => applyDiff(m, diff, "before")),
        redo: () => mapStore.set((m) => applyDiff(m, diff, "after")),
    })
}

/** Apply a change to the map as one undo step */
export function changeMap(change: Parameters<typeof diffFor>[1], label: string) {
    const diff = diffFor(mapStore.get(), change)
    if (!diffSize(diff)) return
    mapStore.set((m) => applyDiff(m, diff, "after"))
    pushMapUndo(diff, label)
}

// ----------------------------------------------------------------- travel
export interface TravelState {
    /** The party's token */
    partyId: string | null
    day: number
    season: Season
    climate: Climate
    /** Weather rolled for `day` */
    weather: { id: string; roll: number; day: number } | null
    /** Roll an encounter check on every hex entered */
    checks: boolean
}

export const DEFAULT_TRAVEL: TravelState = {
    partyId: null,
    day: 1,
    season: "spring",
    climate: "temperate",
    weather: null,
    checks: true,
}

export const travelStore = createStore<TravelState>(DEFAULT_TRAVEL)

/** Change travel state as one undo step */
export function changeTravel(patch: Partial<TravelState>, label: string) {
    const before = travelStore.get()
    const after = { ...before, ...patch }
    travelStore.set(after)
    pushUndo({
        label,
        undo: () => travelStore.set((t) => ({ ...t, ...pick(before, patch) })),
        redo: () => travelStore.set((t) => ({ ...t, ...patch })),
    })
}

function pick(from: TravelState, keys: Partial<TravelState>): Partial<TravelState> {
    const out: Partial<TravelState> = {}
    for (const k of Object.keys(keys) as (keyof TravelState)[]) (out as Record<string, unknown>)[k] = from[k]
    return out
}

export function sanitizeTravel(raw: unknown): TravelState {
    const t = { ...DEFAULT_TRAVEL, ...(raw && typeof raw === "object" ? raw : {}) } as TravelState
    t.day = Math.max(1, Math.floor(Number(t.day) || 1))
    return t
}

// --------------------------------------------------------------------- ui
export type Brush = TerrainId | "river" | "road" | "erase" | "erase-paths"

export interface HexUi {
    brush: Brush
    size: 1 | 2 | 3
    marker: MarkerKind
    /** Add the hex number (CCRR) to new markers */
    autoNumber: boolean
    showCoords: boolean
    hudCollapsed: boolean
    /** Hidden until the travel tool is picked again */
    hudHidden: boolean
    /** Dragged HUD position (left/top px), null = docked top-right */
    hudPos: { x: number; y: number } | null
    gen: GeneratorSettings & { replace: boolean; fog: boolean }
}

export const uiStore = createPersistentStore<HexUi>("jewel:hexcrawl:ui", {
    brush: "grassland",
    size: 1,
    marker: "village",
    autoNumber: true,
    showCoords: false,
    hudCollapsed: false,
    hudHidden: false,
    hudPos: null,
    gen: { ...DEFAULT_SETTINGS, replace: true, fog: false },
})

export const setUi = (patch: Partial<HexUi>) => uiStore.set((u) => ({ ...u, ...patch }))

// ------------------------------------------------------- transient stores
export const generatorOpenStore = createStore(false)
/** Label typed in the feature panel for the next marker */
export const labelDraft = createStore("")
/** Marker humbug whose label is being edited */
export const labelEditStore = createStore<string | null>(null)
/** Last travel result, read out politely */
export const travelResultStore = createStore<{ text: string; encounter: boolean } | null>(null)
