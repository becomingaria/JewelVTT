import type { Humbug } from "../../types/humbug.types"
import { HOTKEYS, formatHotkey, runHotkeyAction } from "../../utils/hotkeys"
import { showToast } from "../../utils/toast"
import type { MapKind } from "../map-kind"
import { FEATURES, formatHotkeySpec } from "../registry"
import { toggleActiveTool, isHumbugHidden } from "../view-state"
import { goToHumbug, humbugName } from "./actions"

/*
 * Everything the command palette (#26) can run: every feature's commands
 * and tools (for this map kind), the core hotkey actions, and the named
 * objects on the board.
 */

export interface PaletteItem {
    id: string
    label: string
    keywords?: string
    /** Hotkey label shown on the right */
    hotkey?: string
    /** Short kind tag: Command, Tool, Board, Go to */
    tag: string
    run: () => void
}

/** The palette's own opener isn't listed inside it */
const HIDDEN_COMMANDS = new Set(["workflow.palette"])

const TYPE_WORDS: Record<Humbug["type"], string> = {
    token: "token character monster npc",
    "map-pin": "pin marker",
    document: "document link note",
    text: "text note label",
    image: "image picture",
    map: "map",
    "solid-color": "colour color",
}

export function buildPaletteItems(kind: MapKind, humbugs: readonly Humbug[]): PaletteItem[] {
    const items: PaletteItem[] = []
    const fits = (kinds?: MapKind[]) => !kinds || kinds.includes(kind)

    for (const f of FEATURES) {
        for (const c of f.commands ?? []) {
            if (!fits(c.mapKinds) || HIDDEN_COMMANDS.has(c.id)) continue
            items.push({
                id: `cmd:${c.id}`,
                label: c.label,
                keywords: c.keywords,
                hotkey: c.hotkey ? formatHotkeySpec(c.hotkey) : undefined,
                tag: "Command",
                run: c.run,
            })
        }
        for (const t of f.tools ?? []) {
            if (!fits(t.mapKinds)) continue
            items.push({
                id: `tool:${t.id}`,
                label: t.label,
                keywords: `${t.hint ?? ""} tool ${t.group}`,
                hotkey: t.hotkey ? formatHotkeySpec(t.hotkey) : undefined,
                tag: "Tool",
                run: () => (t.kind === "mode" ? toggleActiveTool(t.id) : t.onTrigger?.()),
            })
        }
    }

    // Core actions run through the same handlers as their keys (App's useHotkeys)
    for (const def of HOTKEYS) {
        if (def.action === "nudge") continue
        items.push({
            id: `core:${def.action}`,
            label: def.label,
            keywords: def.group,
            hotkey: formatHotkey(def),
            tag: "Board",
            run: () => {
                if (!runHotkeyAction(def.action)) showToast("That isn't available right now")
            },
        })
    }

    for (const h of humbugs) {
        if (isHumbugHidden(h)) continue
        const name = humbugName(h)
        if (!name) continue
        items.push({
            id: `go:${h.id}`,
            label: `Go to ${name}`,
            keywords: TYPE_WORDS[h.type],
            tag: "Go to",
            run: () => goToHumbug(h),
        })
    }
    return items
}
