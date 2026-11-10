import { pushUndo } from "../board-bridge"
import { cellKey, type Cell, type CellKey } from "../grid"
import { createStore } from "../store"
import { playSfx } from "../sound"

/*
 * Reveal layers: named sets of cells the GM paints ahead of time (like
 * scribble layers) and switches on to lift the fog there, e.g. "Room 3" or
 * "Secret passage". A hidden layer reveals nothing; showing it reveals its
 * cells to everyone at once. Saved with the board ("fog-light:reveals").
 */

export interface RevealLayer {
    id: string
    name: string
    /** On = its cells are revealed */
    visible: boolean
    cells: ReadonlySet<CellKey>
}

interface RevealSaved {
    id: string
    name: string
    visible: boolean
    cells: CellKey[]
}

export const revealLayersStore = createStore<readonly RevealLayer[]>([])

/** Where the fog brush paints: null = the board's fog, else a reveal layer id */
export const brushTargetStore = createStore<string | null>(null)

export const serializeReveals = (layers: readonly RevealLayer[]): RevealSaved[] =>
    layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, cells: [...l.cells] }))

export function deserializeReveals(raw: unknown): RevealLayer[] {
    if (!Array.isArray(raw)) return []
    return raw
        .filter((l): l is RevealSaved => !!l && typeof l === "object" && typeof l.id === "string")
        .map((l) => ({
            id: l.id,
            name: typeof l.name === "string" ? l.name : "Reveal",
            visible: !!l.visible,
            cells: new Set(Array.isArray(l.cells) ? l.cells.filter((k) => typeof k === "string") : []),
        }))
}

export function commitReveals(label: string, before: readonly RevealLayer[], after: readonly RevealLayer[]) {
    if (before === after) return
    revealLayersStore.set(after)
    pushUndo({ label, undo: () => revealLayersStore.set(before), redo: () => revealLayersStore.set(after) })
}

const newId = () => `reveal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

export function addRevealLayer(): string {
    const before = revealLayersStore.get()
    const n = before.length + 1
    const layer: RevealLayer = { id: newId(), name: `Reveal ${n}`, visible: false, cells: new Set() }
    commitReveals("New reveal layer", before, [...before, layer])
    brushTargetStore.set(layer.id)
    return layer.id
}

export function renameRevealLayer(id: string, name: string) {
    const before = revealLayersStore.get()
    const clean = name.trim() || "Reveal"
    if (before.find((l) => l.id === id)?.name === clean) return
    commitReveals("Rename reveal layer", before, before.map((l) => (l.id === id ? { ...l, name: clean } : l)))
}

export function setRevealVisible(id: string, visible: boolean) {
    const before = revealLayersStore.get()
    if (before.find((l) => l.id === id)?.visible === visible) return
    commitReveals(
        visible ? "Show reveal layer" : "Hide reveal layer",
        before,
        before.map((l) => (l.id === id ? { ...l, visible } : l))
    )
    if (visible) playSfx("reveal")
}

export function deleteRevealLayer(id: string) {
    const before = revealLayersStore.get()
    commitReveals("Delete reveal layer", before, before.filter((l) => l.id !== id))
    if (brushTargetStore.get() === id) brushTargetStore.set(null)
}

/** Add (reveal) or remove (hide) cells on one layer. Same array when unchanged. */
export function withLayerCells(
    layers: readonly RevealLayer[],
    id: string,
    cells: Cell[],
    add: boolean
): readonly RevealLayer[] {
    const layer = layers.find((l) => l.id === id)
    if (!layer) return layers
    let next: Set<CellKey> | null = null
    for (const c of cells) {
        const k = cellKey(c)
        if ((next ?? layer.cells).has(k) === add) continue
        next ??= new Set(layer.cells)
        if (add) next.add(k)
        else next.delete(k)
    }
    if (!next) return layers
    const updated = next
    return layers.map((l) => (l.id === id ? { ...l, cells: updated } : l))
}
