import { createPersistentStore } from "../store"

/** Walls tool: draw or erase (per viewer) */
export const wallModeStore = createPersistentStore<{ mode: "draw" | "erase" }>("jewel:fog-light:wall-mode", { mode: "draw" })
