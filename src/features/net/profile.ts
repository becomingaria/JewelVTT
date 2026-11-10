import { createPersistentStore } from "../store"

/** Per-viewer: the name shown to others, and whether the panel is open */
export const profileStore = createPersistentStore("jewel:net:profile", { name: "" })

export const panelOpenStore = createPersistentStore("jewel:net:panel", { open: false })
export const togglePanel = () => panelOpenStore.set((p) => ({ open: !p.open }))
export const openPanel = () => panelOpenStore.set({ open: true })
