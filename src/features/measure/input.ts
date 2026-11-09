import type { Point } from "../../types/humbug.types"
import type { BoardCamera } from "../board-bridge"
import { canRotate, dedupeCells, snapAngle, snapTemplateOrigin, snapToCellCenter, templateContains, templateHandle, type Template } from "./geometry"
import {
    announcePlaced,
    clearMeasurement,
    deleteSelected,
    finishMeasurement,
    mapScale,
    newTemplate,
    nudgeSelected,
    popWaypoint,
    rememberAngle,
    rulerPress,
    selectedTemplate,
} from "./actions"
import {
    measureStore,
    recordAdd,
    recordUpdate,
    RULER_TOOL,
    selectedTemplateStore,
    templatesStore,
} from "./state"

/*
 * Board input while a measure tool is active. Listeners sit on the board
 * container in the capture phase, so left-button presses on the board
 * (canvas or humbugs) come to us instead of panning or dragging. Right and
 * middle buttons, the wheel and every UI element are left alone. Nothing
 * is attached while the tools are off.
 */

type Drag =
    | { kind: "ruler"; x: number; y: number; moved: boolean }
    | { kind: "place"; id: string }
    | { kind: "move"; before: Template; dx: number; dy: number }
    | { kind: "rotate"; before: Template }

/** UI that must keep its own clicks (menus, dialogs, our strip and × buttons) */
const NOT_BOARD =
    "[data-measure-ui], button, input, select, textarea, a[href], [role='dialog'], [role='menu'], [class*='context-menu'], .humbug-modal"

const DIALOGS = ".humbug-modal, .image-cropper-modal, .token-library-drawer, .how-to-dialog, .board-file-dialog, .measure-speed"

const isTyping = (t: EventTarget | null) => {
    const el = t as HTMLElement | null
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)
}

const ARROWS: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
}

const byId = (id: string) => templatesStore.get().find((t) => t.id === id)
const put = (t: Template) => templatesStore.set((all) => all.map((x) => (x.id === t.id ? t : x)))
const angleTo = (o: Point, p: Point) => (Math.atan2(p.y - o.y, p.x - o.x) * 180) / Math.PI

export function attachInput(container: HTMLElement, tool: string, camera: () => BoardCamera): () => void {
    let drag: Drag | null = null
    const ruler = tool === RULER_TOOL

    const local = (e: MouseEvent) => {
        const r = container.getBoundingClientRect()
        return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const toWorld = (e: MouseEvent) => {
        const p = local(e)
        return camera().containerToWorld(p.x, p.y)
    }
    const onBoard = (t: EventTarget | null) =>
        t instanceof Element && container.contains(t) && !t.closest(NOT_BOARD)

    // ---------------------------------------------------------- templates
    const templateDown = (e: MouseEvent, w: Point) => {
        const cam = camera()
        const { perCell } = mapScale()
        const sel = selectedTemplate()
        if (sel && canRotate(sel.shape)) {
            const h = templateHandle(sel, perCell)
            const hs = cam.worldToScreen(h.x, h.y)
            const p = local(e)
            if (Math.hypot(p.x - hs.x, p.y - hs.y) <= 16) {
                drag = { kind: "rotate", before: sel }
                return
            }
        }
        const all = templatesStore.get()
        const tol = 6 / Math.max(cam.scale, 0.05)
        for (let i = all.length - 1; i >= 0; i--) {
            const t = all[i]
            if (templateContains(t, w, perCell, tol) || Math.hypot(w.x - t.origin.x, w.y - t.origin.y) <= tol + 8) {
                selectedTemplateStore.set(t.id)
                drag = { kind: "move", before: t, dx: w.x - t.origin.x, dy: w.y - t.origin.y }
                return
            }
        }
        const t = newTemplate(w, e.altKey)
        templatesStore.set([...all, t])
        selectedTemplateStore.set(t.id)
        drag = { kind: "place", id: t.id }
    }

    const templateMove = (e: MouseEvent, w: Point) => {
        if (!drag || drag.kind === "ruler") return
        const t = byId(drag.kind === "place" ? drag.id : drag.before.id)
        if (!t) return
        if (drag.kind === "move") {
            const raw = { x: w.x - drag.dx, y: w.y - drag.dy }
            const origin = e.altKey ? raw : snapTemplateOrigin(raw, t, camera().gridShape, mapScale().perCell)
            if (origin.x !== t.origin.x || origin.y !== t.origin.y) put({ ...t, origin })
            return
        }
        // Aim: placing a cone/line, or dragging any rotate handle
        if (drag.kind === "place" && t.shape !== "cone" && t.shape !== "line") return
        if (Math.hypot(w.x - t.origin.x, w.y - t.origin.y) < 6) return
        const raw = angleTo(t.origin, w)
        const angle = e.altKey ? ((raw % 360) + 360) % 360 : snapAngle(raw)
        if (angle !== t.angle) put({ ...t, angle })
    }

    const templateUp = () => {
        if (!drag || drag.kind === "ruler") return
        if (drag.kind === "place") {
            const t = byId(drag.id)
            if (t) {
                if (t.shape === "cone" || t.shape === "line") rememberAngle(t.angle)
                recordAdd(t)
                announcePlaced(t)
            }
        } else {
            const now = byId(drag.before.id)
            if (now) {
                if (drag.kind === "rotate" && now.shape !== "square") rememberAngle(now.angle)
                recordUpdate(drag.before, now, drag.kind === "rotate" ? "Rotate template" : "Move template")
            }
        }
    }

    // ------------------------------------------------------------- events
    const onDown = (e: MouseEvent) => {
        if (e.button !== 0 || !onBoard(e.target)) return
        e.preventDefault()
        e.stopPropagation()
        const w = toWorld(e)
        if (ruler) {
            rulerPress(w)
            drag = { kind: "ruler", x: e.clientX, y: e.clientY, moved: false }
        } else {
            templateDown(e, w)
        }
    }

    const onMove = (e: MouseEvent) => {
        if (ruler) {
            const m = measureStore.get()
            if (!m || m.done) return
            if (drag?.kind === "ruler" && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true
            const c = snapToCellCenter(toWorld(e), camera().gridShape)
            if (!m.live || m.live.x !== c.x || m.live.y !== c.y) measureStore.set({ ...m, live: c })
            return
        }
        if (drag) templateMove(e, toWorld(e))
    }

    const onUp = (e: MouseEvent) => {
        if (e.button !== 0 || !drag) return
        if (drag.kind === "ruler") {
            const m = measureStore.get()
            if (drag.moved && m && !m.done) {
                // Shift on release keeps going from here; otherwise it's done
                if (e.shiftKey && m.live) {
                    measureStore.set({ ...m, points: dedupeCells([...m.points, m.live], camera().gridShape) })
                } else {
                    finishMeasurement()
                }
            }
        } else {
            templateUp()
        }
        drag = null
    }

    const onDouble = (e: MouseEvent) => {
        if (!onBoard(e.target)) return
        e.preventDefault()
        e.stopPropagation()
        if (ruler) finishMeasurement()
    }

    const onKey = (e: KeyboardEvent) => {
        if (e.defaultPrevented || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
        if (document.querySelector(DIALOGS)) return
        const stop = () => {
            e.preventDefault()
            e.stopPropagation()
        }
        const del = e.key === "Delete" || e.key === "Backspace"
        if (ruler) {
            const m = measureStore.get()
            if (!m) return
            const onButton = e.target instanceof Element && !!e.target.closest("button, a[href]")
            if (e.key === "Enter" && !m.done && !onButton) {
                stop()
                finishMeasurement()
            } else if (del) {
                stop()
                popWaypoint()
            }
            return
        }
        if (!selectedTemplate()) return
        if (del) {
            stop()
            deleteSelected()
        } else if (e.key in ARROWS && !e.shiftKey) {
            stop()
            const [dx, dy] = ARROWS[e.key]
            nudgeSelected(dx, dy)
        }
    }

    container.addEventListener("mousedown", onDown, true)
    container.addEventListener("dblclick", onDouble, true)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    window.addEventListener("keydown", onKey, true)
    container.dataset.measureTool = ruler ? "ruler" : "templates"

    return () => {
        // Tool switched off mid-drag: put things back as they were
        if (drag?.kind === "place") templatesStore.set((all) => all.filter((t) => t.id !== (drag as { id: string }).id))
        else if (drag && drag.kind !== "ruler") put(drag.before)
        drag = null
        if (ruler) clearMeasurement()
        container.removeEventListener("mousedown", onDown, true)
        container.removeEventListener("dblclick", onDouble, true)
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
        window.removeEventListener("keydown", onKey, true)
        delete container.dataset.measureTool
    }
}
