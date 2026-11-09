import { useSyncExternalStore } from "react"
import { createPersistentStore, useStore } from "./store"

/*
 * Per-viewer preferences: accessibility and comfort. Every feature must
 * respect these. Defaults are chosen to be calm: no sound, no CRT effect,
 * motion follows the operating system setting.
 *
 * The Settings panel UI is owned by the theme feature; this file is the
 * single source of truth for the values.
 */

export interface Prefs {
    /** "system" follows prefers-reduced-motion */
    reducedMotion: "system" | "on" | "off"
    /** Master sound switch. Off by default: nothing ever plays unasked. */
    sound: boolean
    /** 0..1 */
    volume: number
    /** Ambient loops per scene (only when sound is on) */
    ambient: boolean
    /** Interface zoom, 0.85..1.6 (big screens across a table) */
    uiScale: number
    /** Stronger borders, no textures behind text, bigger focus rings */
    highContrast: boolean
    /** Palette theme id (theme feature defines the list) */
    theme: string
    /** CRT scanline overlay (purely cosmetic, off by default) */
    crt: boolean
    /** Swap pixel/display fonts for a plain, highly readable font */
    readableFont: boolean
    /** Add patterns/shapes wherever colour carries meaning */
    colourblindSafe: boolean
    /** Ask before destructive actions that can't be undone */
    confirmDestructive: boolean
    /** Show hover hints and hotkey labels */
    hints: boolean
}

export const DEFAULT_PREFS: Prefs = {
    reducedMotion: "system",
    sound: false,
    volume: 0.5,
    ambient: false,
    uiScale: 1,
    highContrast: false,
    theme: "default",
    crt: false,
    readableFont: false,
    colourblindSafe: false,
    confirmDestructive: true,
    hints: true,
}

export const prefsStore = createPersistentStore<Prefs>("jewel:prefs", DEFAULT_PREFS)

export const usePrefs = () => useStore(prefsStore)

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    prefsStore.set((p) => ({ ...p, [key]: value }))
}

const motionQuery =
    typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null

const subscribeMotion = (cb: () => void) => {
    motionQuery?.addEventListener("change", cb)
    return () => motionQuery?.removeEventListener("change", cb)
}

/** True when animations should be skipped or replaced with instant changes */
export function prefersReducedMotion(): boolean {
    const p = prefsStore.get().reducedMotion
    if (p === "on") return true
    if (p === "off") return false
    return !!motionQuery?.matches
}

export function useReducedMotion(): boolean {
    const prefs = usePrefs()
    const system = useSyncExternalStore(
        subscribeMotion,
        () => !!motionQuery?.matches,
        () => false
    )
    return prefs.reducedMotion === "on" || (prefs.reducedMotion === "system" && system)
}

/**
 * Mirror prefs onto <html> so plain CSS can react:
 *   html[data-reduced-motion]  html[data-high-contrast]  html[data-crt]
 *   html[data-readable-font]   html[data-colourblind]    html[data-theme="..."]
 *   --ui-scale
 */
export function applyPrefsToDocument(p: Prefs, reducedMotion: boolean) {
    const el = document.documentElement
    const flag = (name: string, on: boolean) =>
        on ? el.setAttribute(name, "") : el.removeAttribute(name)
    flag("data-reduced-motion", reducedMotion)
    flag("data-high-contrast", p.highContrast)
    flag("data-crt", p.crt)
    flag("data-readable-font", p.readableFont)
    flag("data-colourblind", p.colourblindSafe)
    el.setAttribute("data-theme", p.theme)
    el.style.setProperty("--ui-scale", String(p.uiScale))
}
