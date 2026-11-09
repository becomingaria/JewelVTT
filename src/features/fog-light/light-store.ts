import type { Humbug, LightSource } from "../../types/humbug.types"
import { humbugsStore, pushUndo, selectionStore, updateHumbugs } from "../board-bridge"
import { createStore, type Store } from "../store"
import { showToast } from "../../utils/toast"

/*
 * Scene darkness (per board) and the light-source presets.
 */

export type Darkness = "daylight" | "dim" | "dark"

export const DARKNESS_ORDER: Darkness[] = ["daylight", "dim", "dark"]

export const DARKNESS_LABEL: Record<Darkness, string> = {
    daylight: "Daylight",
    dim: "Dim",
    dark: "Dark",
}

export const darknessStore = createStore<Darkness>("daylight")

export const parseDarkness = (v: unknown): Darkness =>
    v === "dim" || v === "dark" ? v : "daylight"

export function setDarkness(next: Darkness) {
    const before = darknessStore.get()
    if (before === next) return
    darknessStore.set(next)
    pushUndo({
        label: `Scene light: ${DARKNESS_LABEL[next]}`,
        undo: () => darknessStore.set(before),
        redo: () => darknessStore.set(next),
    })
}

export function cycleDarkness() {
    const cur = darknessStore.get()
    const next = DARKNESS_ORDER[(DARKNESS_ORDER.indexOf(cur) + 1) % DARKNESS_ORDER.length]
    setDarkness(next)
    showToast(`Scene light: ${DARKNESS_LABEL[next]}`)
}

/** Read-only view for the dock button's aria-pressed (on = not daylight) */
export const darkPressed: Store<boolean> = {
    get: () => darknessStore.get() !== "daylight",
    set: () => {},
    subscribe: darknessStore.subscribe,
}

// --------------------------------------------------------------- presets
export interface LightPreset {
    id: "torch" | "lantern" | "candle" | "magic"
    label: string
    light: LightSource
}

/** Original OSR-ish defaults (radii in feet) */
export const LIGHT_PRESETS: LightPreset[] = [
    { id: "torch", label: "Torch", light: { bright: 30, dim: 10, color: "#ffb35c", flicker: true, turnsLeft: 6 } },
    { id: "lantern", label: "Lantern", light: { bright: 30, dim: 30, color: "#ffd98a" } },
    { id: "candle", label: "Candle", light: { bright: 5, dim: 5, color: "#ffc870", flicker: true } },
    { id: "magic", label: "Magic light", light: { bright: 30, dim: 0, color: "#a6d8ff" } },
]

/** Which preset a light looks like (for the badge's label) */
export function presetOf(light: LightSource): LightPreset | undefined {
    return LIGHT_PRESETS.find(
        (p) => p.light.bright === light.bright && p.light.dim === light.dim && !!p.light.flicker === !!light.flicker
    )
}

/**
 * Give a humbug (or the whole selection, if it's part of it) a light, as
 * one undo step. undefined puts the light out.
 */
export function applyLight(h: Humbug, light: LightSource | undefined) {
    const sel = selectionStore.get()
    const ids = new Set(sel.includes(h.id) ? sel : [h.id])
    // Maps are terrain: never give them a light via a mixed selection
    const targets = humbugsStore.get().filter((x) => ids.has(x.id) && (x.id === h.id || x.type !== "map"))
    const patches = (targets.length ? targets : [h]).map((x) => ({
        id: x.id,
        changes: { light: light ? { ...light } : undefined },
    }))
    updateHumbugs(patches)
}
