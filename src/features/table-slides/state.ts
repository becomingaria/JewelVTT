import { cameraStore, GRID_SIZE, pushUndo, selectHumbugs, type BoardCamera } from "../board-bridge"
import { createPersistentStore, createStore, useStore } from "../store"
import { prefersReducedMotion } from "../prefs"
import { playSfx } from "../sound"
import { setActiveTool, tableModeStore } from "../view-state"
import { flyTo } from "../../utils/view-events"
import { showToast } from "../../utils/toast"
import { snapshotBoard } from "../../utils/board-store"
import { MOD } from "../../utils/hotkeys"
import type { Spot } from "../../types/spot.types"
import type { Point } from "../../types/humbug.types"

/*
 * State for Table Mode, slide frames and presenting. Frames are saved with
 * the board (AppLayer registers the "table-slides:frames" slice); the rest
 * is per-session view state.
 */

export const FRAME_TOOL_ID = "table-slides:frame"

// ---------------------------------------------------------------- frames
export interface Frame {
    id: string
    title: string
    /** World rect (top-left + size) */
    x: number
    y: number
    width: number
    height: number
}

export type Rect = Pick<Frame, "x" | "y" | "width" | "height">

/** Frames in presentation order */
export const framesStore = createStore<Frame[]>([])
export const useFrames = () => useStore(framesStore)

/** Smallest frame side, in world units */
export const MIN_FRAME = GRID_SIZE * 2

const newId = () => `frame_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

/** Replace the frame list as one undo step */
export function commitFrames(next: Frame[], label: string, prev: Frame[] = framesStore.get()) {
    framesStore.set(next)
    pushUndo({ label, undo: () => framesStore.set(prev), redo: () => framesStore.set(next) })
}

/** Live change during a drag (no undo; finish with commitFrames) */
export function patchFrameLive(id: string, changes: Partial<Rect>) {
    framesStore.set((list) => list.map((f) => (f.id === id ? { ...f, ...changes } : f)))
}

export function nextFrameTitle(list: Frame[] = framesStore.get()) {
    const used = new Set(list.map((f) => f.title))
    let n = list.length + 1
    while (used.has(`Frame ${n}`)) n++
    return `Frame ${n}`
}

export function addFrame(rect: Rect, title = nextFrameTitle()): Frame {
    const frame: Frame = { id: newId(), title, ...normRect(rect) }
    commitFrames([...framesStore.get(), frame], "Add frame")
    return frame
}

export function renameFrame(id: string, title: string) {
    const prev = framesStore.get()
    const clean = title.trim()
    const cur = prev.find((f) => f.id === id)
    if (!cur || !clean || clean === cur.title) return
    commitFrames(prev.map((f) => (f.id === id ? { ...f, title: clean } : f)), "Rename frame", prev)
}

/** Move a frame from one place in the order to another */
export function reorderFrame(from: number, to: number) {
    const prev = framesStore.get()
    if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return
    const next = [...prev]
    const [f] = next.splice(from, 1)
    next.splice(to, 0, f)
    commitFrames(next, "Reorder frames", prev)
}

export function deleteFrame(id: string) {
    const prev = framesStore.get()
    const f = prev.find((x) => x.id === id)
    if (!f) return
    commitFrames(prev.filter((x) => x.id !== id), "Delete frame", prev)
    showToast(`Deleted “${f.title}”. Press ${MOD}Z to undo.`)
}

export function setFrameRect(id: string, rect: Rect) {
    const prev = framesStore.get()
    commitFrames(prev.map((f) => (f.id === id ? { ...f, ...normRect(rect) } : f)), "Change frame", prev)
}

function normRect(r: Rect): Rect {
    return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.max(MIN_FRAME, Math.round(r.width)),
        height: Math.max(MIN_FRAME, Math.round(r.height)),
    }
}

/** The world rectangle currently on screen (a little inset) */
export function currentViewRect(): Rect | null {
    const cam = cameraStore.get()
    const el = cam?.container
    if (!cam || !el) return null
    const w = el.clientWidth
    const h = el.clientHeight
    const pts = [
        cam.containerToWorld(w * 0.05, h * 0.05),
        cam.containerToWorld(w * 0.95, h * 0.05),
        cam.containerToWorld(w * 0.05, h * 0.95),
        cam.containerToWorld(w * 0.95, h * 0.95),
    ]
    const x1 = Math.min(...pts.map((p) => p.x))
    const x2 = Math.max(...pts.map((p) => p.x))
    const y1 = Math.min(...pts.map((p) => p.y))
    const y2 = Math.max(...pts.map((p) => p.y))
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

export function addFrameFromView() {
    const r = currentViewRect()
    if (!r) return
    const f = addFrame(r)
    showToast(`Added “${f.title}” from the current view.`)
    return f
}

/** Screen-space corners of a world rect (a quad in 2.5D) */
export function frameQuad(camera: BoardCamera, f: Rect) {
    return [
        camera.worldToScreen(f.x, f.y),
        camera.worldToScreen(f.x + f.width, f.y),
        camera.worldToScreen(f.x + f.width, f.y + f.height),
        camera.worldToScreen(f.x, f.y + f.height),
    ]
}

export function goToFrame(f: Rect, instant = prefersReducedMotion()) {
    flyTo({
        x: f.x + f.width / 2,
        y: f.y + f.height / 2,
        fit: { width: f.width, height: f.height, padding: 24 },
        instant,
    })
}

// ---------------------------------------------------------------- panel
/** Frames panel open/collapsed, remembered per viewer */
export const panelStore = createPersistentStore("jewel:table-slides:panel", {
    open: false,
    collapsed: false,
})
export const usePanel = () => useStore(panelStore)
/** Bumped when the user explicitly opens the panel (focus moves into it) */
export const panelFocusStore = createStore(0)
/** Frame whose title field should take focus in the panel */
export const renameRequestStore = createStore<string | null>(null)

export function requestRename(id: string) {
    openFramesPanel(false)
    renameRequestStore.set(id)
}

export function openFramesPanel(focus = true) {
    panelStore.set((p) => ({ ...p, open: true, collapsed: false }))
    if (focus) panelFocusStore.set((n) => n + 1)
}

export function toggleFramesPanel() {
    if (panelStore.get().open) panelStore.set((p) => ({ ...p, open: false }))
    else openFramesPanel(true)
}

// ------------------------------------------------------- shape picker
export type PickerState =
    | { mode: "place" }
    | { mode: "change"; humbugId: string; at: Point }
    | null
export const pickerStore = createStore<PickerState>(null)
export const usePicker = () => useStore(pickerStore)

// ------------------------------------------------------------ Table Mode
/** Briefly reshape the board after chrome appears or hides */
export function refreshBoardLayout() {
    requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"))
        const vp = cameraStore.get()?.viewport
        // Re-centre on the same world point so the board re-lays out
        if (vp) flyTo({ x: -vp.x, y: -vp.y, zoom: vp.zoom, instant: true })
    })
}

export function toggleTableMode() {
    if (presentStore.get()) return
    const on = !tableModeStore.get()
    if (on) {
        setActiveTool(null)
        selectHumbugs([])
        pickerStore.set(null)
    }
    tableModeStore.set(on)
    refreshBoardLayout()
    showToast(on ? "Table Mode: players' view. Shift+T to return." : "Back to the GM view.")
}

// ------------------------------------------------------------ presenting
export interface PresentTarget {
    kind: "frame" | "spot"
    id: string
    title: string
    x: number
    y: number
    /** Frames only */
    width?: number
    height?: number
}

export interface PresentState {
    targets: PresentTarget[]
    index: number
    /** Camera to go back to on exit */
    returnTo: { x: number; y: number; zoom: number } | null
    wasTableMode: boolean
}

export const presentStore = createStore<PresentState | null>(null)
export const usePresent = () => useStore(presentStore)

function boardSpots(): Spot[] {
    try {
        const spots = snapshotBoard().board.spots
        return Array.isArray(spots) ? (spots as Spot[]) : []
    } catch {
        return []
    }
}

function flyToTarget(t: PresentTarget, instant: boolean) {
    if (t.kind === "frame" && t.width && t.height) goToFrame({ x: t.x, y: t.y, width: t.width, height: t.height }, instant)
    else flyTo({ x: t.x, y: t.y, instant })
}

const setPresentingAttr = (on: boolean) => document.documentElement.toggleAttribute("data-ts-presenting", on)

export function startPresenting() {
    if (presentStore.get()) return
    const frames = framesStore.get()
    let targets: PresentTarget[] = frames.map((f) => ({ kind: "frame", ...f }))
    if (!targets.length) {
        targets = boardSpots().map((s) => ({ kind: "spot", id: s.id, title: s.name, x: s.x, y: s.y }))
        if (!targets.length) {
            showToast("Nothing to present yet. Press O and drag on the board to add a frame (or plant spots with F).")
            return
        }
        showToast("No frames on this board, so presenting its spots. Esc to stop.")
    }
    const vp = cameraStore.get()?.viewport
    setActiveTool(null)
    selectHumbugs([])
    pickerStore.set(null)
    presentStore.set({
        targets,
        index: 0,
        returnTo: vp ? { x: -vp.x, y: -vp.y, zoom: vp.zoom } : null,
        wasTableMode: tableModeStore.get(),
    })
    tableModeStore.set(true)
    // Hide the chrome now so the first frame is fitted to the full screen
    setPresentingAttr(true)
    requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"))
        flyToTarget(targets[0], true)
    })
}

export function stopPresenting() {
    const s = presentStore.get()
    if (!s) return
    presentStore.set(null)
    tableModeStore.set(s.wasTableMode)
    setPresentingAttr(false)
    requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"))
        if (s.returnTo) flyTo({ ...s.returnTo, instant: true })
    })
}

export function togglePresenting() {
    if (presentStore.get()) stopPresenting()
    else startPresenting()
}

export function goToSlide(index: number) {
    const s = presentStore.get()
    if (!s) return
    const i = Math.max(0, Math.min(s.targets.length - 1, index))
    if (i === s.index) return
    presentStore.set({ ...s, index: i })
    playSfx("page")
    flyToTarget(s.targets[i], prefersReducedMotion())
}

export const nextSlide = () => goToSlide((presentStore.get()?.index ?? 0) + 1)
export const prevSlide = () => goToSlide((presentStore.get()?.index ?? 0) - 1)
