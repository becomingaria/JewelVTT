import { createPersistentStore, createStore, type Store } from "../store"
import { DEFAULT_DUNGEON, DEFAULT_INIT, type DungeonState, type InitState } from "./logic"

/*
 * Tracker state. Board state (initiative, dungeon turns) is saved with the
 * board by TrackerLayer through useBoardSlice; viewer conveniences (which
 * panels are open) live in localStorage.
 */

/** Saved with the board as "tracker:initiative" */
export const initStore = createStore<InitState>(DEFAULT_INIT)

/** Saved with the board as "tracker:dungeon" */
export const dungeonStore = createStore<DungeonState>(DEFAULT_DUNGEON)

/** Per-viewer: which tracker panels are open */
export const uiStore = createPersistentStore("jewel:tracker:ui", {
    stripOpen: false,
    /** Second row of the strip (rolling, ordering, clearing) */
    stripTools: true,
    hudOpen: true,
})

/** The strip's open state as its own boolean store (drives aria-pressed in the dock) */
export const stripOpenStore: Store<boolean> = createStore(uiStore.get().stripOpen)
stripOpenStore.subscribe(() => uiStore.set((u) => ({ ...u, stripOpen: stripOpenStore.get() })))

/** Small popover next to a token: hit points or conditions */
export const popoverStore = createStore<{ kind: "hp" | "conditions"; id: string } | null>(null)

/** Character generator dialog */
export const chargenOpenStore = createStore(false)

/** "My Party" images → names (loaded by TrackerLayer); party images count as the party side */
export const partyStore = createStore<ReadonlyMap<string, string>>(new Map())

/** Which combatant is picked in the strip (for its move/side/remove controls) */
export const stripPickStore = createStore<string | null>(null)

/** Last initiative message, read out by the strip's aria-live region */
export const announceStore = createStore("")
