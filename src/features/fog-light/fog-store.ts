import type { GridShape } from "../../utils/board-styles"
import { cameraStore, pushUndo } from "../board-bridge"
import { cellKey, type Cell, type CellKey } from "../grid"
import { createPersistentStore, createStore } from "../store"
import { playSfx } from "../sound"

/*
 * Fog of war for the current board.
 *
 * The board is infinite, so fog is stored as a set of cells relative to a
 * default:
 *   inverted = false  -> the board is covered; `cells` are the revealed ones
 *   inverted = true   -> the board is open;    `cells` are the hidden ones
 * ("Reveal everything" switches to the open default, so the GM can still
 * paint fog back on.)
 *
 * Cells use the shared scheme in features/grid.ts. `shape` remembers which
 * grid they were painted on, so fog stays put if the grid display changes.
 */

export interface FogState {
    enabled: boolean
    inverted: boolean
    cells: ReadonlySet<CellKey>
    shape: GridShape | null
}

export interface FogSaved {
    enabled: boolean
    inverted: boolean
    shape: GridShape | null
    cells: CellKey[]
}

export const EMPTY_FOG: FogState = { enabled: false, inverted: false, cells: new Set(), shape: null }

export const fogStore = createStore<FogState>(EMPTY_FOG)

export const serializeFog = (s: FogState): FogSaved => ({
    enabled: s.enabled,
    inverted: s.inverted,
    shape: s.shape,
    cells: [...s.cells],
})

export function deserializeFog(raw: FogSaved | undefined): FogState {
    if (!raw || typeof raw !== "object") return EMPTY_FOG
    return {
        enabled: !!raw.enabled,
        inverted: !!raw.inverted,
        shape: raw.shape === "hex" || raw.shape === "square" ? raw.shape : null,
        cells: new Set(Array.isArray(raw.cells) ? raw.cells.filter((k) => typeof k === "string") : []),
    }
}

const boardShape = (): GridShape => cameraStore.get()?.gridShape ?? "square"

/** The grid the fog lives on: what it was painted on, else the board's */
export function fogShape(s: FogState = fogStore.get()): GridShape {
    return s.cells.size && s.shape ? s.shape : boardShape()
}

export const isRevealedKey = (s: FogState, k: CellKey) => s.inverted !== s.cells.has(k)

/**
 * How each state was made from the previous one, when it was a plain
 * reveal/hide of a few cells. Lets the renderer redraw only what changed.
 */
export const fogDeltas = new WeakMap<FogState, { from: FogState; cells: Cell[] }>()

/** Reveal or hide cells. Returns a new state, or the same one when nothing changed. */
export function withCells(s: FogState, cells: Cell[], reveal: boolean): FogState {
    // Normal fog keeps revealed cells; inverted fog keeps hidden ones
    const add = reveal !== s.inverted
    let next: Set<CellKey> | null = null
    const changed: Cell[] = []
    for (const c of cells) {
        const k = cellKey(c)
        if ((next ?? s.cells).has(k) === add) continue
        next ??= new Set(s.cells)
        if (add) next.add(k)
        else next.delete(k)
        changed.push(c)
    }
    if (!next) return s
    const shape = s.cells.size && s.shape ? s.shape : boardShape()
    const out: FogState = { ...s, cells: next, shape }
    if (shape === s.shape || !s.cells.size) fogDeltas.set(out, { from: s, cells: changed })
    return out
}

/** Set the fog and record one undo step */
export function commitFog(label: string, before: FogState, after: FogState) {
    if (before === after) return
    fogStore.set(after)
    pushUndo({ label, undo: () => fogStore.set(before), redo: () => fogStore.set(after) })
}

// ------------------------------------------------------------- commands
export function coverBoard() {
    const before = fogStore.get()
    commitFog("Cover board with fog", before, {
        enabled: true,
        inverted: false,
        cells: new Set(),
        shape: boardShape(),
    })
}

export function revealEverything() {
    const before = fogStore.get()
    commitFog("Reveal everything", before, {
        enabled: true,
        inverted: true,
        cells: new Set(),
        shape: boardShape(),
    })
    playSfx("reveal")
}

export function setFogEnabled(enabled: boolean) {
    const before = fogStore.get()
    if (before.enabled === enabled) return
    commitFog(enabled ? "Turn fog on" : "Turn fog off", before, { ...before, enabled })
}

export const toggleFog = () => setFogEnabled(!fogStore.get().enabled)

// ---------------------------------------------------- shared API (services)
function apiChange(cells: Cell[], reveal: boolean) {
    if (!cells.length) return
    const before = fogStore.get()
    const after = withCells(before, cells, reveal)
    commitFog(reveal ? "Reveal fog" : "Hide fog", before, after)
}

export const fogApi = {
    reveal: (cells: Cell[]) => apiChange(cells, true),
    hide: (cells: Cell[]) => apiChange(cells, false),
    // Set by FogLightLayer: includes reveal layers and token vision
    isRevealed: (cell: Cell) => {
        const s = fogStore.get()
        return !s.enabled || isRevealedKey(s, cellKey(cell))
    },
    enabled: () => fogStore.get().enabled,
}

// ---------------------------------------------------------------- brush
export interface BrushSettings {
    /** 1..5 cells across (1 = a single cell, then rings around it) */
    size: number
    mode: "reveal" | "hide"
}

/** Per-viewer convenience (localStorage, guarded) */
export const brushStore = createPersistentStore<BrushSettings>("jewel:fog-light:brush", {
    size: 2,
    mode: "reveal",
})

/** Short message for the brush strip's live region */
export const fogNoticeStore = createStore<string>("")
