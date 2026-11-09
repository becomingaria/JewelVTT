import type { Humbug, Point } from "../../types/humbug.types"
import type { GridShape } from "../../utils/board-styles"
import { hexStep, humbugFootprint, snapForGrid } from "../../utils/humbug.utils"
import { showToast } from "../../utils/toast"
import { cameraStore, humbugsStore, updateHumbugs } from "../board-bridge"
import { MAP_SCALE, mapKindStore } from "../map-kind"
import { playSfx } from "../sound"
import { isHumbugHidden } from "../view-state"
import {
    dedupeCells,
    resizeForCategory,
    snapAngle,
    snapTemplateOrigin,
    snapToCellCenter,
    type SizeCategory,
    type Template,
} from "./geometry"
import { announceMeasurement, announceTemplate, readMeasurement, type Scale } from "./describe"
import {
    addTemplate,
    announce,
    clearTemplates,
    deleteTemplate,
    measurePrefsStore,
    measureStore,
    newTemplateId,
    nextSize,
    selectedTemplateStore,
    templatesStore,
    updateTemplate,
} from "./state"

/* Actions that read the shared stores: used by pointer, keyboard and strip */

export const gridShape = (): GridShape => cameraStore.get()?.gridShape ?? "square"
export const mapScale = (): Scale => MAP_SCALE[mapKindStore.get()]

// ---------------------------------------------------------------- ruler
/** Topmost visible token under a world point */
export function tokenAt(p: Point): Humbug | undefined {
    return [...humbugsStore.get()]
        .filter((h) => h.type === "token" && !isHumbugHidden(h))
        .sort((a, b) => b.zIndex - a.zIndex)
        .find((h) => {
            const f = humbugFootprint(h)
            return p.x >= h.position.x && p.x <= h.position.x + f.width && p.y >= h.position.y && p.y <= h.position.y + f.height
        })
}

export function finishMeasurement() {
    const m = measureStore.get()
    if (!m || m.done) return
    const shape = gridShape()
    const points = dedupeCells(m.live ? [...m.points, m.live] : m.points, shape)
    if (points.length < 2) {
        measureStore.set(null)
        return
    }
    const done = { points, live: null, done: true, tokenId: m.tokenId }
    measureStore.set(done)
    const r = readMeasurement(done, shape, measurePrefsStore.get().rule, mapScale(), humbugsStore.get())
    announce(announceMeasurement(r))
}

/** Drop the last waypoint (or the whole measurement if only the start is left) */
export function popWaypoint() {
    const m = measureStore.get()
    if (!m) return
    if (m.done || m.points.length <= 1) return measureStore.set(null)
    measureStore.set({ ...m, points: m.points.slice(0, -1) })
}

export const clearMeasurement = () => measureStore.set(null)

// ------------------------------------------------------------ templates
export const selectedTemplate = (): Template | undefined => {
    const id = selectedTemplateStore.get()
    return id ? templatesStore.get().find((t) => t.id === id) : undefined
}

/** Last aim, so the next cone/line points the same way */
let lastAngle = 0
export const rememberAngle = (a: number) => (lastAngle = a)

/** A new template at a world point, using the strip's shape and size */
export function newTemplate(p: Point, free = false): Template {
    const { shape } = measurePrefsStore.get()
    const scale = mapScale()
    const t = { shape, size: nextSize(shape, scale.unit) }
    return {
        id: newTemplateId(),
        ...t,
        origin: free ? p : snapTemplateOrigin(p, t, gridShape(), scale.perCell),
        angle: shape === "cone" || shape === "line" ? lastAngle : 0,
    }
}

export function announcePlaced(t: Template) {
    announce(announceTemplate("placed", t, gridShape(), mapScale(), humbugsStore.get()))
    playSfx("place")
}

/** Keyboard placement: drop one in the middle of the view */
export function placeTemplateAt(p: Point) {
    const t = newTemplate(p)
    addTemplate(t)
    selectedTemplateStore.set(t.id)
    announcePlaced(t)
}

export function rotateSelected(delta: number) {
    const t = selectedTemplate()
    if (!t || t.shape === "burst") return
    const angle = snapAngle(t.angle + delta)
    if (t.shape !== "square") rememberAngle(angle)
    updateTemplate(t, { ...t, angle }, "Rotate template")
    announce(`Turned to ${angle}°`)
}

export function deleteSelected() {
    const t = selectedTemplate()
    if (!t) return
    deleteTemplate(t.id)
    announce("Template deleted. Undo brings it back.")
}

/** Move the selected template one cell (arrow keys) */
export function nudgeSelected(dx: number, dy: number) {
    const t = selectedTemplate()
    if (!t) return
    const shape = gridShape()
    const d = shape === "hex" ? hexStep(dx, dy, t.origin.y) : { x: dx * 32, y: dy * 32 }
    updateTemplate(t, { ...t, origin: { x: t.origin.x + d.x, y: t.origin.y + d.y } })
}

/** Cycle the selection through the placed templates (keyboard users) */
export function selectNextTemplate() {
    const all = templatesStore.get()
    if (!all.length) return
    const i = all.findIndex((t) => t.id === selectedTemplateStore.get())
    const t = all[(i + 1) % all.length]
    selectedTemplateStore.set(t.id)
    announce(announceTemplate("selected", t, gridShape(), mapScale(), humbugsStore.get()))
}

export function clearAllTemplates() {
    const n = clearTemplates()
    const msg = n
        ? `Cleared ${n} template${n === 1 ? "" : "s"}. Undo brings ${n === 1 ? "it" : "them"} back.`
        : "No templates to clear."
    showToast(msg)
    announce(msg)
}

// ---------------------------------------------------------- token sizes
export function setTokenSize(h: Humbug, category: SizeCategory) {
    if (h.type !== "token") return
    const shape = gridShape()
    const next = resizeForCategory(h.position, h.size, category, (p, s) => snapForGrid(p, s, shape))
    updateHumbugs([{ id: h.id, changes: { sizeCategory: category, size: next.size, position: next.position } }])
}

export function setTokenSpeed(h: Humbug, speed: number) {
    const prev = (h.ext?.measure as Record<string, unknown> | undefined) ?? {}
    updateHumbugs([{ id: h.id, changes: { ext: { ...h.ext, measure: { ...prev, speed } } } }])
}

/** Ruler press: start a new measurement or add a waypoint */
export function rulerPress(w: Point) {
    const shape = gridShape()
    const c = snapToCellCenter(w, shape)
    const m = measureStore.get()
    if (!m || m.done) {
        const tok = tokenAt(w)
        const start = tok
            ? snapToCellCenter(
                  {
                      x: tok.position.x + humbugFootprint(tok).width / 2,
                      y: tok.position.y + humbugFootprint(tok).height / 2,
                  },
                  shape
              )
            : c
        measureStore.set({ points: [start], live: start, done: false, tokenId: tok?.id })
    } else {
        measureStore.set({ ...m, points: dedupeCells([...m.points, c], shape), live: c })
    }
}
