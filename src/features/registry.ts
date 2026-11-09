import type { FeatureModule, HotkeySpec } from "./types"
import { BASE_MAP_KIND_DEFAULTS, type MapKind, type MapKindDefaults } from "./map-kind"
import { IS_MAC } from "../utils/hotkeys"

import { feature as theme } from "./theme"
import { feature as fogLight } from "./fog-light"
import { feature as dice } from "./dice"
import { feature as tracker } from "./tracker"
import { feature as measure } from "./measure"
import { feature as dungeon } from "./dungeon"
import { feature as hexcrawl } from "./hexcrawl"
import { feature as workflow } from "./workflow"
import { feature as tableSlides } from "./table-slides"

/** Every feature, in dock order. Each lives in its own folder. */
export const FEATURES: FeatureModule[] = [
    theme,
    dungeon,
    hexcrawl,
    fogLight,
    measure,
    dice,
    tracker,
    workflow,
    tableSlides,
]

export function mapKindDefaults(kind: MapKind): MapKindDefaults {
    let d = { ...BASE_MAP_KIND_DEFAULTS[kind] }
    for (const f of FEATURES) {
        const extra = f.mapKindDefaults?.[kind]
        if (extra) d = { ...d, ...extra }
    }
    return d
}

export function matchesHotkey(e: KeyboardEvent, h: HotkeySpec): boolean {
    const mod = IS_MAC ? e.metaKey : e.ctrlKey
    if (!!h.mod !== mod) return false
    if (!!h.alt !== e.altKey) return false
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
    if (h.key === "?") return e.key === "?" || (e.key === "/" && e.shiftKey)
    if (!!h.shift !== e.shiftKey) return false
    return key === h.key
}

export function formatHotkeySpec(h: HotkeySpec): string {
    const mod = h.mod ? (IS_MAC ? "⌘" : "Ctrl+") : ""
    const key = h.key.length === 1 ? h.key.toUpperCase() : h.key
    return `${mod}${h.alt ? (IS_MAC ? "⌥" : "Alt+") : ""}${h.shift ? "Shift+" : ""}${key}`
}

/** True while the user is typing somewhere (hotkeys must stand down) */
export function isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null
    return (
        !!el &&
        (el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.tagName === "SELECT" ||
            el.isContentEditable)
    )
}
