import { createPersistentStore, createStore } from "../store"

/* Theme feature state: per-viewer settings plus transient UI state. */

export type SettingsTab = "look" | "motion" | "behaviour"

export interface ThemeViewerPrefs {
    /** Show the scene title card when a board or scene loads */
    titleCards: boolean
    /** Settings panel tab to reopen on */
    settingsTab: SettingsTab
}

export const themeViewerStore = createPersistentStore<ThemeViewerPrefs>("jewel:theme", {
    titleCards: true,
    settingsTab: "look",
})

/** Settings dialog open (drives the dock button's aria-pressed) */
export const settingsOpenStore = createStore(false)

export const toggleSettings = () => settingsOpenStore.set((open) => !open)

/** The title card currently showing (key restarts the animation) */
export interface TitleCardState {
    key: number
    title: string
    subtitle?: string
}

export const titleCardStore = createStore<TitleCardState | null>(null)

export function showTitleCard(title: string, subtitle?: string) {
    titleCardStore.set({ key: Date.now(), title, subtitle })
}
