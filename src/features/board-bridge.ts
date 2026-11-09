import type { Humbug, Point } from "../types/humbug.types"
import type { Action, CustomAction } from "../types/action.types"
import type { UndoRedoManager } from "../utils/undo-redo.utils"
import type { Projection, ViewMode } from "../utils/projection"
import type { GridShape } from "../utils/board-styles"
import { generateId } from "../utils/humbug.utils"
import { createStore, useStore } from "./store"

/*
 * The bridge between features and the board core.
 *
 * - Read: the current humbugs, selection, camera and pointer, as stores.
 * - Write: add / update / remove humbugs. HumbugManager performs the change
 *   and records it as ONE undo step, exactly like a user edit.
 * - Undo for feature-owned state (fog, initiative, ...): pushUndo().
 */

/** World units per grid square (also the hex size basis) */
export const GRID_SIZE = 32

export interface BoardCamera {
    /** Current zoom */
    scale: number
    viewport: { x: number; y: number; zoom: number }
    /** World -> board-container pixels (handles 2.5D projection) */
    worldToScreen: (worldX: number, worldY: number) => Point
    /** Board-container pixels -> world (inverse projection) */
    containerToWorld: (containerX: number, containerY: number) => Point
    projection: Projection
    viewMode: ViewMode
    gridShape: GridShape
    /** The board container element (overlays are positioned inside it) */
    container: HTMLDivElement | null
}

export const cameraStore = createStore<BoardCamera | null>(null)
export const useCamera = () => useStore(cameraStore)

/** Live list of humbugs (read-only snapshot; publish via the writers below) */
export const humbugsStore = createStore<readonly Humbug[]>([])
export const useHumbugs = () => useStore(humbugsStore)

/** Selected humbug ids (single selection is a one-item list) */
export const selectionStore = createStore<readonly string[]>([])
export const useSelection = () => useStore(selectionStore)

/** Last pointer position over the board, in world units (null when outside) */
export const pointerWorldStore = createStore<Point | null>(null)

// ------------------------------------------------------------- writers
export interface HumbugPatch {
    id: string
    changes: Partial<Humbug>
}

interface Handlers {
    add: (humbugs: Humbug[], select: boolean) => void
    update: (patches: HumbugPatch[], undoable: boolean) => void
    remove: (ids: string[]) => void
    select: (ids: string[]) => void
}

let handlers: Handlers | null = null

/** Called once by HumbugManager */
export function registerHumbugHandlers(h: Handlers | null) {
    handlers = h
}

/** Add humbugs to the board as one undo step (ids/zIndex filled if missing) */
export function addHumbugs(humbugs: Humbug[], opts: { select?: boolean } = {}) {
    handlers?.add(humbugs, opts.select ?? false)
}

/**
 * Change fields on humbugs as one undo step. Pass undoable:false for live
 * updates during a drag, then a final undoable call on release.
 */
export function updateHumbugs(patches: HumbugPatch[], opts: { undoable?: boolean } = {}) {
    handlers?.update(patches, opts.undoable ?? true)
}

export function removeHumbugs(ids: string[]) {
    handlers?.remove(ids)
}

export function selectHumbugs(ids: string[]) {
    handlers?.select(ids)
}

export const newHumbugId = generateId

/** Base fields for a new humbug at a world position */
export function humbugBase(position: Point) {
    const now = Date.now()
    return {
        id: generateId(),
        position,
        rotation: 0,
        locked: false,
        zIndex: 0,
        opacity: 1,
        createdAt: now,
        updatedAt: now,
    }
}

// ---------------------------------------------------------------- undo
let undoManager: UndoRedoManager | null = null

/** Called once by App with the shared undo manager */
export function setUndoManager(m: UndoRedoManager) {
    undoManager = m
}

/**
 * Record an undo step for feature-owned state. Apply the change yourself
 * first; undo/redo are called later by Cmd+Z / Cmd+Shift+Z.
 */
export function pushUndo(entry: { label: string; undo: () => void; redo: () => void }) {
    const action: CustomAction = { type: "CUSTOM", timestamp: Date.now(), ...entry }
    undoManager?.addAction(action as Action)
}

// ------------------------------------------------------------ geometry
/** Centre of the visible board area in world units */
export function viewCentreWorld(): Point {
    const cam = cameraStore.get()
    const el = cam?.container
    if (!cam || !el) return { x: 0, y: 0 }
    return cam.containerToWorld(el.clientWidth / 2, el.clientHeight / 2)
}
