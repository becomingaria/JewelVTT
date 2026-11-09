import React, { useEffect } from "react"
import { FEATURES, isTypingTarget, matchesHotkey } from "../registry"
import { applyPrefsToDocument, usePrefs, useReducedMotion } from "../prefs"
import { activeToolStore, toggleActiveTool, useTableMode } from "../view-state"
import { mapKindStore, useMapKind } from "../map-kind"
import { setAmbient } from "../sound"
import { cameraStore, pointerWorldStore } from "../board-bridge"
import { ToolDock } from "./ToolDock"

/*
 * Mounted once by App. Applies preferences to <html>, mounts every
 * feature's AppLayer and dock, and routes feature hotkeys.
 */
export const FeatureHost: React.FC = () => {
    const prefs = usePrefs()
    const reducedMotion = useReducedMotion()
    const tableMode = useTableMode()
    const mapKind = useMapKind()

    // Ambient loop follows the map kind (silent unless sound + ambient are on)
    useEffect(() => {
        setAmbient(mapKind === "dungeon" ? "dungeon" : mapKind === "hexcrawl" ? "wilderness" : null)
    }, [mapKind, prefs.sound, prefs.ambient, prefs.volume])

    useEffect(() => {
        applyPrefsToDocument(prefs, reducedMotion)
    }, [prefs, reducedMotion])

    useEffect(() => {
        document.documentElement.toggleAttribute("data-table-mode", tableMode)
    }, [tableMode])

    // Pointer position over the board, in world units
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const cam = cameraStore.get()
            const el = cam?.container
            if (!cam || !el) return
            const r = el.getBoundingClientRect()
            const inside =
                e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
            pointerWorldStore.set(inside ? cam.containerToWorld(e.clientX - r.left, e.clientY - r.top) : null)
        }
        window.addEventListener("mousemove", onMove)
        return () => window.removeEventListener("mousemove", onMove)
    }, [])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.defaultPrevented || isTypingTarget(e.target)) return
            // Esc always drops the active board tool first
            if (e.key === "Escape" && activeToolStore.get()) {
                activeToolStore.set(null)
                return
            }
            const kind = mapKindStore.get()
            for (const f of FEATURES) {
                for (const t of f.tools ?? []) {
                    if (!t.hotkey || !matchesHotkey(e, t.hotkey)) continue
                    if (t.mapKinds && !t.mapKinds.includes(kind)) continue
                    e.preventDefault()
                    if (t.kind === "mode") toggleActiveTool(t.id)
                    else t.onTrigger?.()
                    return
                }
                for (const c of f.commands ?? []) {
                    if (!c.hotkey || !matchesHotkey(e, c.hotkey)) continue
                    if (c.mapKinds && !c.mapKinds.includes(kind)) continue
                    e.preventDefault()
                    c.run()
                    return
                }
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])

    return (
        <>
            <ToolDock />
            {FEATURES.map((f) => (f.AppLayer ? <f.AppLayer key={f.id} /> : null))}
        </>
    )
}
