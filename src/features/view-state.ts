import type { Humbug } from "../types/humbug.types"
import { createStore, useStore } from "./store"

/*
 * Shared view state: layers, Table Mode and the active board tool.
 */

// ---------------------------------------------------------------- layers
export type LayerId = "map" | "objects" | "tokens" | "gm"

export const LAYERS: { id: LayerId; label: string; description: string }[] = [
    { id: "map", label: "Map", description: "Maps, floors and backgrounds" },
    { id: "objects", label: "Objects", description: "Notes, images, stamps, doors" },
    { id: "tokens", label: "Tokens", description: "Characters and monsters" },
    { id: "gm", label: "GM only", description: "Hidden from players in Table Mode" },
]

export interface LayerState {
    visible: boolean
    locked: boolean
}

export const DEFAULT_LAYER_STATE: Record<LayerId, LayerState> = {
    map: { visible: true, locked: false },
    objects: { visible: true, locked: false },
    tokens: { visible: true, locked: false },
    gm: { visible: true, locked: false },
}

/** Saved with the board by the workflow (layers) feature */
export const layerStateStore = createStore<Record<LayerId, LayerState>>(DEFAULT_LAYER_STATE)
export const useLayerState = () => useStore(layerStateStore)

/** Which layer a humbug is on: explicit `layer`, else by type */
export function layerOf(h: Humbug): LayerId {
    if (h.layer) return h.layer
    if (h.type === "map") return "map"
    if (h.type === "token") return "tokens"
    return "objects"
}

// ------------------------------------------------------------ Table Mode
/**
 * Table Mode: the players are looking at the screen. GM-only content is
 * hidden, fog is fully opaque, and the interface tucks itself away.
 * Single-screen setup, so this is a toggle rather than a second window.
 */
export const tableModeStore = createStore<boolean>(false)
export const useTableMode = () => useStore(tableModeStore)

/** Should this humbug be left out of the board entirely right now? */
export function isHumbugHidden(
    h: Humbug,
    layers: Record<LayerId, LayerState> = layerStateStore.get(),
    tableMode: boolean = tableModeStore.get()
): boolean {
    const layer = layerOf(h)
    if (!layers[layer].visible) return true
    return tableMode && layer === "gm"
}

/** Locked by its layer (on top of the humbug's own lock) */
export function isHumbugLayerLocked(
    h: Humbug,
    layers: Record<LayerId, LayerState> = layerStateStore.get()
): boolean {
    return layers[layerOf(h)].locked
}

// ------------------------------------------------------------ board tool
/**
 * The one active board tool ("mode" tools in the dock: fog brush, measure,
 * room drawing...). null = normal select/pan. Esc always returns to null.
 */
export const activeToolStore = createStore<string | null>(null)
export const useActiveTool = () => useStore(activeToolStore)
export const setActiveTool = (id: string | null) => activeToolStore.set(id)
export const toggleActiveTool = (id: string) =>
    activeToolStore.set((cur) => (cur === id ? null : id))
