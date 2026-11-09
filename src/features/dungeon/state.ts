import { pushUndo } from "../board-bridge"
import { createPersistentStore, createStore, type Store } from "../store"
import { DEFAULT_SETTINGS, type GenSettings } from "./generator"
import type { FloorSet } from "./walls"

/*
 * Dungeon feature state.
 *
 * - floorStore: the board's floor cells (saved with the board by the
 *   AppLayer as "dungeon:floor"). Replace the whole set on every change so
 *   the underlay can tell what changed.
 * - Per-viewer conveniences (localStorage): room tool mode, palette
 *   open/closed, last generator settings.
 */

export const floorStore = createStore<FloorSet>(new Set())

/**
 * Add / remove floor cells as ONE undo step. Returns true if anything
 * changed (no-op drags don't clutter the undo history).
 */
export function editFloor(add: Iterable<string>, remove: Iterable<string>, label: string): boolean {
    const prev = floorStore.get()
    const next = new Set(prev)
    for (const k of remove) next.delete(k)
    for (const k of add) next.add(k)
    if (next.size === prev.size && [...next].every((k) => prev.has(k))) return false
    floorStore.set(next)
    pushUndo({
        label,
        undo: () => floorStore.set(prev),
        redo: () => floorStore.set(next),
    })
    return true
}

// ---------------------------------------------------------------- tools
export type RoomMode = "room" | "corridor" | "erase"
export const roomModeStore = createPersistentStore<{ mode: RoomMode }>("jewel:dungeon:room-mode", { mode: "room" })

/** Stamp picked in the palette (placed by the "dungeon-stamp" board mode) */
export const pickedStampStore = createStore<string | null>(null)

/** A boolean store that remembers itself per viewer */
function persistentFlag(key: string, initial: boolean): Store<boolean> {
    let start = initial
    try {
        const raw = localStorage.getItem(key)
        if (raw !== null) start = raw === "1"
    } catch {
        /* storage unavailable */
    }
    const s = createStore(start)
    s.subscribe(() => {
        try {
            localStorage.setItem(key, s.get() ? "1" : "0")
        } catch {
            /* ignore */
        }
    })
    return s
}

/** Stamp palette open (drives the dock button's aria-pressed) */
export const paletteOpenStore = persistentFlag("jewel:dungeon:palette-open", false)

// ---------------------------------------------------------------- panels
export type DungeonPanel = "generator" | "starters" | null
export const panelStore = createStore<DungeonPanel>(null)

export const togglePanel = (p: Exclude<DungeonPanel, null>) => panelStore.set((cur) => (cur === p ? null : p))

export const genSettingsStore = createPersistentStore<GenSettings>("jewel:dungeon:generator", DEFAULT_SETTINGS)
