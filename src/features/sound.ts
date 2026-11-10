import { prefsStore } from "./prefs"

/*
 * Sound effects facade. Any feature may call playSfx(); it is silent unless
 * the viewer has turned sound on in Settings. The dice feature owns the
 * actual chiptune engine and registers it with registerSfxEngine().
 */

export type SfxName =
    | "ui"
    | "select"
    | "place"
    | "dice"
    | "dice-crit"
    | "dice-fumble"
    | "door"
    | "turn"
    | "page"
    | "reveal"
    | "torch-out"
    | "alert"
    | "error"
    /** Soft bell (the jewel in the top bar) */
    | "chime"

type Engine = {
    play: (name: SfxName, volume: number) => void
    /** Ambient loop for the current scene; null stops it */
    ambient?: (loopId: string | null, volume: number) => void
}

let engine: Engine | null = null

export function registerSfxEngine(e: Engine) {
    engine = e
}

export function playSfx(name: SfxName) {
    const p = prefsStore.get()
    if (!p.sound || !engine) return
    try {
        engine.play(name, p.volume)
    } catch {
        /* audio must never break the app */
    }
}

export function setAmbient(loopId: string | null) {
    const p = prefsStore.get()
    if (!engine?.ambient) return
    try {
        engine.ambient(p.sound && p.ambient ? loopId : null, p.volume)
    } catch {
        /* ignore */
    }
}
