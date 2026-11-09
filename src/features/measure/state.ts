import type { Point } from "../../types/humbug.types"
import { pushUndo } from "../board-bridge"
import { createPersistentStore, createStore } from "../store"
import type { DiagonalRule, Template, TemplateShape } from "./geometry"

/*
 * Measure feature state. The ruler is transient (never saved); templates
 * are board state (saved through useBoardSlice in the AppLayer) and every
 * change to them goes through the undoable helpers below.
 */

export const RULER_TOOL = "measure:ruler"
export const TEMPLATE_TOOL = "measure:templates"

// ---------------------------------------------------------------- ruler
export interface Measurement {
    /** Fixed waypoints (cell centres, world units); the first is the start */
    points: Point[]
    /** Where the free end follows the pointer; null once finished */
    live: Point | null
    done: boolean
    /** Started on this token: show distance against its movement rate */
    tokenId?: string
}

export const measureStore = createStore<Measurement | null>(null)

// ------------------------------------------------------------ templates
export const templatesStore = createStore<Template[]>([])
export const selectedTemplateStore = createStore<string | null>(null)

/** Per-viewer choices for the options strip (localStorage) */
export interface MeasurePrefs {
    rule: DiagonalRule
    shape: TemplateShape
    /** Next template size per shape, keyed by unit ("ft" / "mi") */
    sizes: Record<string, Record<TemplateShape, number>>
}

export const DEFAULT_SIZES: Record<string, Record<TemplateShape, number>> = {
    ft: { cone: 30, line: 60, burst: 20, square: 20 },
    mi: { cone: 18, line: 30, burst: 6, square: 18 },
}

export const measurePrefsStore = createPersistentStore<MeasurePrefs>("jewel:measure", {
    rule: "alternate",
    shape: "cone",
    sizes: DEFAULT_SIZES,
})

export function nextSize(shape: TemplateShape, unit: string): number {
    return measurePrefsStore.get().sizes[unit]?.[shape] ?? DEFAULT_SIZES[unit]?.[shape] ?? 30
}

export function setNextSize(shape: TemplateShape, unit: string, size: number) {
    measurePrefsStore.set((p) => ({
        ...p,
        sizes: {
            ...p.sizes,
            [unit]: { ...(DEFAULT_SIZES[unit] ?? DEFAULT_SIZES.ft), ...p.sizes[unit], [shape]: size },
        },
    }))
}

const SHAPES: TemplateShape[] = ["cone", "line", "burst", "square"]

/** Accept only well-formed templates from a saved board */
export function sanitizeTemplates(value: unknown): Template[] {
    if (!Array.isArray(value)) return []
    return value.filter(
        (t): t is Template =>
            !!t &&
            typeof t.id === "string" &&
            SHAPES.includes(t.shape) &&
            Number.isFinite(t.size) &&
            t.size > 0 &&
            Number.isFinite(t.angle) &&
            Number.isFinite(t.origin?.x) &&
            Number.isFinite(t.origin?.y)
    )
}

export const newTemplateId = () => `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

// Each helper applies the change, then records one undo step. They work by
// id so undoing one template never disturbs the others.
const without = (id: string) => templatesStore.set((all) => all.filter((t) => t.id !== id))
const insertAt = (t: Template, index: number) =>
    templatesStore.set((all) => {
        const rest = all.filter((x) => x.id !== t.id)
        return [...rest.slice(0, index), t, ...rest.slice(index)]
    })
const replace = (t: Template) => templatesStore.set((all) => all.map((x) => (x.id === t.id ? t : x)))

/** Record an add that has already been applied (e.g. after a placing drag) */
export function recordAdd(t: Template) {
    pushUndo({
        label: "Place template",
        undo: () => {
            without(t.id)
            if (selectedTemplateStore.get() === t.id) selectedTemplateStore.set(null)
        },
        redo: () => insertAt(t, templatesStore.get().length),
    })
}

export function addTemplate(t: Template) {
    insertAt(t, templatesStore.get().length)
    recordAdd(t)
}

/** Record a change already applied live (drag); no-op if nothing changed */
export function recordUpdate(before: Template, after: Template, label = "Move template") {
    if (JSON.stringify(before) === JSON.stringify(after)) return
    pushUndo({ label, undo: () => replace(before), redo: () => replace(after) })
}

export function updateTemplate(before: Template, after: Template, label?: string) {
    replace(after)
    recordUpdate(before, after, label)
}

export function deleteTemplate(id: string) {
    const all = templatesStore.get()
    const index = all.findIndex((t) => t.id === id)
    if (index < 0) return
    const t = all[index]
    without(id)
    if (selectedTemplateStore.get() === id) selectedTemplateStore.set(null)
    pushUndo({ label: "Delete template", undo: () => insertAt(t, index), redo: () => without(id) })
}

/** Remove every template as one undo step. Returns how many were removed. */
export function clearTemplates(): number {
    const before = templatesStore.get()
    if (!before.length) return 0
    templatesStore.set([])
    selectedTemplateStore.set(null)
    pushUndo({
        label: "Clear templates",
        undo: () =>
            templatesStore.set((now) => [...before, ...now.filter((t) => !before.some((b) => b.id === t.id))]),
        redo: () => templatesStore.set((now) => now.filter((t) => !before.some((b) => b.id === t.id))),
    })
    return before.length
}

// --------------------------------------------------------- announcements
/** Text for the polite live region (n flips so repeats are re-announced) */
export const announceStore = createStore<{ text: string; n: number }>({ text: "", n: 0 })
export const announce = (text: string) => announceStore.set((a) => ({ text, n: a.n + 1 }))

// ------------------------------------------------------- movement popover
export const speedPopoverStore = createStore<{ tokenId: string } | null>(null)

/** Default movement rate in feet (exploration pace) */
export const DEFAULT_SPEED = 120

export function tokenSpeed(ext: Record<string, unknown> | undefined): number {
    const m = ext?.measure as { speed?: unknown } | undefined
    const s = Number(m?.speed)
    return Number.isFinite(s) && s > 0 ? s : DEFAULT_SPEED
}
