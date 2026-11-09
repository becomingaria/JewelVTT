import type { Humbug } from "../../types/humbug.types"

/*
 * Flowchart shapes for text humbugs, stored in ext["table-slides"].shape.
 *
 * Every outline passes through the midpoints of the humbug's four box edges,
 * which is where the core connectors attach, so arrows meet the ink line.
 * (The parallelogram and the document wave lean slightly outside the box
 * to manage that; the SVG has overflow: visible.)
 */

export const FEATURE_ID = "table-slides"

export type FlowShape = "process" | "decision" | "terminal" | "io" | "document" | "note"

export interface FlowShapeInfo {
    id: FlowShape
    label: string
    /** What the shape usually means in a flowchart */
    meaning: string
    defaultText: string
    /** World size of a new shape */
    size: { width: number; height: number }
}

export const FLOW_SHAPES: FlowShapeInfo[] = [
    { id: "terminal", label: "Start / end", meaning: "Where the flow begins or stops", defaultText: "Start", size: { width: 160, height: 64 } },
    { id: "process", label: "Process", meaning: "A step or action", defaultText: "Do a thing", size: { width: 160, height: 80 } },
    { id: "decision", label: "Decision", meaning: "A yes / no question", defaultText: "Yes or no?", size: { width: 176, height: 112 } },
    { id: "io", label: "Input / output", meaning: "Something given or received", defaultText: "Clue found", size: { width: 176, height: 72 } },
    { id: "document", label: "Document", meaning: "A letter, map or handout", defaultText: "Handout", size: { width: 160, height: 88 } },
    { id: "note", label: "Note", meaning: "A side remark", defaultText: "Note", size: { width: 144, height: 96 } },
]

const IDS = new Set<string>(FLOW_SHAPES.map((s) => s.id))

/** The flowchart shape of a humbug, or null for a plain box */
export function flowShapeOf(h: Humbug): FlowShape | null {
    if (h.type !== "text") return null
    const ext = h.ext?.[FEATURE_ID] as { shape?: unknown } | undefined
    return typeof ext?.shape === "string" && IDS.has(ext.shape) ? (ext.shape as FlowShape) : null
}

/** ext with the shape set (null removes it), keeping other features' data */
export function withShape(h: Humbug, shape: FlowShape | null): Record<string, unknown> {
    const ext = { ...(h.ext ?? {}) }
    const mine = { ...((ext[FEATURE_ID] as Record<string, unknown> | undefined) ?? {}) }
    if (shape) mine.shape = shape
    else delete mine.shape
    if (Object.keys(mine).length) ext[FEATURE_ID] = mine
    else delete ext[FEATURE_ID]
    return ext
}

// ------------------------------------------------------------- geometry
interface ShapeGeometry {
    /** Outline path */
    d: string
    /** Extra ink detail drawn on top (the note's folded corner) */
    detail?: string
    /** Room to keep clear for the text: px from each side */
    pad: { top: number; right: number; bottom: number; left: number }
}

/** Outline of a shape in a w×h pixel box; `i` insets for the stroke */
export function shapeGeometry(shape: FlowShape, w: number, h: number, i = 1): ShapeGeometry {
    const L = i, T = i, R = w - i, B = h - i
    const base = Math.max(4, Math.min(w, h) * 0.08)
    const pad = { top: base, right: base, bottom: base, left: base }
    switch (shape) {
        case "process": {
            const r = Math.min(10, (B - T) / 4, (R - L) / 4)
            return { d: roundRect(L, T, R, B, r), pad }
        }
        case "terminal": {
            const r = (B - T) / 2
            return { d: roundRect(L, T, R, B, Math.min(r, (R - L) / 2)), pad: { ...pad, left: r * 0.6, right: r * 0.6 } }
        }
        case "decision":
            return {
                d: `M${w / 2} ${T} L${R} ${h / 2} L${w / 2} ${B} L${L} ${h / 2} Z`,
                pad: { top: h * 0.2, bottom: h * 0.2, left: w * 0.22, right: w * 0.22 },
            }
        case "io": {
            // Leans by s; edges pass through the left/right midpoints
            const s = Math.min(w * 0.14, h * 0.5)
            return {
                d: `M${L + s / 2} ${T} L${R + s / 2} ${T} L${R - s / 2} ${B} L${L - s / 2} ${B} Z`,
                pad: { ...pad, left: s / 2 + base, right: s / 2 + base },
            }
        }
        case "document": {
            // One wave whose centre line is the bottom edge
            const a = Math.min(8, h * 0.12)
            return {
                d: `M${L} ${T} L${R} ${T} L${R} ${B} Q${w * 0.75} ${B + 2 * a} ${w / 2} ${B} Q${w * 0.25} ${B - 2 * a} ${L} ${B} Z`,
                pad: { ...pad, bottom: a + base },
            }
        }
        case "note": {
            const f = Math.min(16, w / 4, h / 4)
            return {
                d: `M${L} ${T} L${R - f} ${T} L${R} ${T + f} L${R} ${B} L${L} ${B} Z`,
                detail: `M${R - f} ${T} L${R - f} ${T + f} L${R} ${T + f}`,
                pad: { ...pad, right: Math.max(base, f * 0.6) },
            }
        }
    }
}

function roundRect(l: number, t: number, r: number, b: number, rad: number) {
    const k = Math.max(0, rad)
    return (
        `M${l + k} ${t} L${r - k} ${t} A${k} ${k} 0 0 1 ${r} ${t + k} ` +
        `L${r} ${b - k} A${k} ${k} 0 0 1 ${r - k} ${b} L${l + k} ${b} ` +
        `A${k} ${k} 0 0 1 ${l} ${b - k} L${l} ${t + k} A${k} ${k} 0 0 1 ${l + k} ${t} Z`
    )
}
