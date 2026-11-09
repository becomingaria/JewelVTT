import type { Humbug } from "../../types/humbug.types"
import { humbugFootprint, snapForGrid } from "../../utils/humbug.utils"
import { showToast } from "../../utils/toast"
import { flyTo } from "../../utils/view-events"
import {
    cameraStore,
    humbugsStore,
    newHumbugId,
    pushUndo,
    selectHumbugs,
    selectionStore,
    updateHumbugs,
    type HumbugPatch,
} from "../board-bridge"
import { MAP_KINDS, mapKindStore, type MapKind } from "../map-kind"
import { playSfx } from "../sound"
import {
    LAYERS,
    isHumbugHidden,
    isHumbugLayerLocked,
    layerOf,
    layerStateStore,
    type LayerId,
    type LayerState,
} from "../view-state"
import { alignItems, type AlignOp } from "./align"
import {
    alignBarOpenStore,
    defaultsOfferStore,
    setWorkflowPref,
    workflowPrefs,
} from "./state"

/*
 * Board actions for the workflow feature. Every board change goes through
 * updateHumbugs / pushUndo, so each one is a single undo step.
 */

/** Window event App listens for to apply a map kind's grid/style defaults */
export const APPLY_MAP_DEFAULTS_EVENT = "jewel:applyMapDefaults"

/** Humbugs in the current selection that can be edited right now */
export function selectedEditable(): Humbug[] {
    const ids = new Set(selectionStore.get())
    return humbugsStore
        .get()
        .filter((h) => ids.has(h.id) && !h.locked && !isHumbugHidden(h) && !isHumbugLayerLocked(h))
}

// ------------------------------------------------------------------ groups
export function groupSelection() {
    const sel = selectedEditable()
    if (sel.length < 2) {
        showToast("Select two or more objects to group them")
        return
    }
    const groupId = `grp_${newHumbugId()}`
    updateHumbugs(sel.map((h) => ({ id: h.id, changes: { groupId } })))
    playSfx("ui")
    showToast(`Grouped ${sel.length} objects. Click any of them to pick up the group.`)
}

export function ungroupSelection() {
    const groups = new Set(selectedEditable().flatMap((h) => (h.groupId ? [h.groupId] : [])))
    if (!groups.size) {
        showToast("Nothing selected is grouped")
        return
    }
    const members = humbugsStore.get().filter((h) => h.groupId && groups.has(h.groupId))
    updateHumbugs(members.map((h) => ({ id: h.id, changes: { groupId: undefined } })))
    playSfx("ui")
    showToast(
        groups.size === 1 ? `Ungrouped ${members.length} objects` : `Ungrouped ${groups.size} groups`
    )
}

// ------------------------------------------------------------------- align
export function openAlignBar() {
    if (selectedEditable().length < 2) {
        showToast("Select two or more objects to align them")
        return
    }
    alignBarOpenStore.set(true)
}

export function runAlign(op: AlignOp) {
    const sel = selectedEditable()
    const moves = alignItems(
        sel.map((h) => {
            const f = humbugFootprint(h)
            return { id: h.id, x: h.position.x, y: h.position.y, w: f.width, h: f.height, group: h.groupId }
        }),
        op
    )
    if (!moves.length) {
        if (op.startsWith("distribute") && sel.length < 3)
            showToast("Distributing needs three or more objects")
        return
    }
    updateHumbugs(moves.map((m) => ({ id: m.id, changes: { position: { x: m.x, y: m.y } } })))
    playSfx("place")
}

/** Snap each selected object to the grid (groups keep their shape) */
export function snapSelectionToGrid() {
    const shape = cameraStore.get()?.gridShape ?? "square"
    const sel = selectedEditable()
    const patches: HumbugPatch[] = []
    const groupDelta = new Map<string, { dx: number; dy: number }>()
    for (const h of sel) {
        let d = h.groupId ? groupDelta.get(h.groupId) : undefined
        if (!d) {
            const to = snapForGrid(h.position, humbugFootprint(h), shape)
            d = { dx: to.x - h.position.x, dy: to.y - h.position.y }
            if (h.groupId) groupDelta.set(h.groupId, d)
        }
        if (d.dx || d.dy)
            patches.push({
                id: h.id,
                changes: { position: { x: h.position.x + d.dx, y: h.position.y + d.dy } },
            })
    }
    if (patches.length) {
        updateHumbugs(patches)
        playSfx("place")
    }
}

// ------------------------------------------------------------------ layers
export function moveToLayer(h: Humbug, layer: LayerId) {
    // Right-clicking one of several selected objects moves them all
    const sel = selectedEditable()
    const targets = sel.length > 1 && sel.some((s) => s.id === h.id) ? sel : [h]
    const patches = targets
        .filter((t) => layerOf(t) !== layer)
        .map((t) => ({ id: t.id, changes: { layer } }))
    if (!patches.length) return
    updateHumbugs(patches)
    const label = LAYERS.find((l) => l.id === layer)?.label ?? layer
    const hidden = !layerStateStore.get()[layer].visible
    showToast(
        `Moved ${patches.length === 1 ? "1 object" : `${patches.length} objects`} to ${label}` +
            (hidden ? " (that layer is hidden)" : "")
    )
}

/** Toggle a layer's visibility or lock as one undo step */
export function toggleLayer(id: LayerId, field: keyof LayerState) {
    const before = layerStateStore.get()
    const after = { ...before, [id]: { ...before[id], [field]: !before[id][field] } }
    layerStateStore.set(after)
    // Hidden or locked objects leave the selection (so Delete can't reach them)
    const sel = selectionStore.get()
    const byId = new Map(humbugsStore.get().map((h) => [h.id, h]))
    const keep = sel.filter((sid) => {
        const h = byId.get(sid)
        return !!h && !isHumbugHidden(h) && !isHumbugLayerLocked(h)
    })
    if (keep.length !== sel.length) selectHumbugs(keep)
    const label = LAYERS.find((l) => l.id === id)?.label ?? id
    pushUndo({
        label: `${field === "visible" ? "Show/hide" : "Lock/unlock"} ${label} layer`,
        undo: () => layerStateStore.set(before),
        redo: () => layerStateStore.set(after),
    })
    playSfx("ui")
}

// ---------------------------------------------------------------- map kind
export const mapKindLabel = (k: MapKind) => MAP_KINDS.find((m) => m.id === k)?.label ?? k

/** Switch the board's map kind (undoable). Optionally apply its defaults. */
export function changeMapKind(kind: MapKind, opts: { applyDefaults?: boolean; offer?: boolean } = {}) {
    const before = mapKindStore.get()
    if (before !== kind) {
        mapKindStore.set(kind)
        pushUndo({
            label: "Change map type",
            undo: () => mapKindStore.set(before),
            redo: () => mapKindStore.set(kind),
        })
    }
    if (opts.applyDefaults) {
        applyMapDefaults(kind)
        defaultsOfferStore.set(null)
    } else if (opts.offer) {
        defaultsOfferStore.set(kind)
    }
    if (!opts.offer) showToast(`Map type: ${mapKindLabel(kind)}`)
}

export function applyMapDefaults(kind: MapKind) {
    window.dispatchEvent(new CustomEvent(APPLY_MAP_DEFAULTS_EVENT, { detail: kind }))
    showToast(`Applied ${mapKindLabel(kind)} grid and style`)
}

// -------------------------------------------------------------------- misc
export function toggleMenuStyle() {
    const next = workflowPrefs.get().menuStyle === "radial" ? "list" : "radial"
    setWorkflowPref("menuStyle", next)
    showToast(`Right-click menu: ${next === "radial" ? "Radial ring" : "List"}`)
}

/** Fly the camera to a humbug and select it */
export function goToHumbug(h: Humbug) {
    const f = humbugFootprint(h)
    flyTo({ x: h.position.x + f.width / 2, y: h.position.y + f.height / 2 })
    selectHumbugs([h.id])
}

/** Display name for a humbug in the palette (null = not worth listing) */
export function humbugName(h: Humbug): string | null {
    switch (h.type) {
        case "token":
            return h.name?.trim() || "Unnamed token"
        case "map-pin":
            return h.label?.trim() || null
        case "document":
            return h.title?.trim() || null
        case "text": {
            const line = h.content?.split("\n").find((l) => l.trim())?.trim()
            return line ? (line.length > 40 ? `${line.slice(0, 40)}…` : line) : null
        }
        default:
            return null
    }
}
