import { createPersistentStore, createStore, useStore } from "../store"
import type { MapKind } from "../map-kind"

/*
 * Workflow feature state.
 *
 * Per viewer (localStorage): right-click menu style, Layers panel open/side,
 * recently used palette commands. Session only: palette and align bar.
 */

export type MenuStyle = "radial" | "list"

export interface WorkflowPrefs {
    /** Right-click menu on humbugs */
    menuStyle: MenuStyle
    layersOpen: boolean
    /** Which screen edge the Layers panel docks to */
    layersSide: "left" | "right"
    /** Palette item ids, most recent first */
    recent: string[]
}

export const workflowPrefs = createPersistentStore<WorkflowPrefs>("jewel:workflow", {
    menuStyle: "radial",
    layersOpen: false,
    layersSide: "left",
    recent: [],
})
export const useWorkflowPrefs = () => useStore(workflowPrefs)

export function setWorkflowPref<K extends keyof WorkflowPrefs>(key: K, value: WorkflowPrefs[K]) {
    workflowPrefs.set((p) => ({ ...p, [key]: value }))
}

export const RECENT_MAX = 8

export function rememberRecent(id: string) {
    workflowPrefs.set((p) => ({
        ...p,
        recent: [id, ...p.recent.filter((r) => r !== id)].slice(0, RECENT_MAX),
    }))
}

/** Layers panel open state drives the dock button's aria-pressed */
export const layersOpenStore = createStore<boolean>(workflowPrefs.get().layersOpen)
layersOpenStore.subscribe(() => setWorkflowPref("layersOpen", layersOpenStore.get()))

export const paletteOpenStore = createStore<boolean>(false)
export const alignBarOpenStore = createStore<boolean>(false)

/** The map-kind "apply defaults?" offer shown inline in the Layers panel */
export const defaultsOfferStore = createStore<MapKind | null>(null)

// Layers panel focus: focus moves in only when the user opened the panel
// just now (not when it reopens itself after a reload), and goes back to
// the opener on close.
let layersFocusRequested = false
let layersReturnFocus: HTMLElement | null = null

export function consumeLayersFocusRequest(): boolean {
    const r = layersFocusRequested
    layersFocusRequested = false
    return r
}

export function toggleLayersPanel() {
    if (layersOpenStore.get()) {
        closeLayersPanel()
        return
    }
    layersReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    layersFocusRequested = true
    layersOpenStore.set(true)
}

export function closeLayersPanel() {
    const panel = document.querySelector(".wf-layers")
    const hadFocus = !!panel && panel.contains(document.activeElement)
    layersOpenStore.set(false)
    defaultsOfferStore.set(null)
    if (hadFocus && layersReturnFocus?.isConnected) layersReturnFocus.focus()
    layersReturnFocus = null
}

export function togglePalette() {
    paletteOpenStore.set((o) => !o)
}
