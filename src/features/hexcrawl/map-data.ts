/*
 * The hex map's data: terrain per hex key plus river and road links
 * between neighbouring hexes. Changes are recorded as diffs so each stroke
 * (or a whole generated map) is one undo step. Pure, no DOM.
 */

import { cellKey, parseCellKey, type Cell, type CellKey } from "../grid"
import { isTerrainId, type TerrainId } from "./terrain"

export type PathKind = "river" | "road"

/** "a|b" with the two cell keys sorted, so each link has one key */
export type EdgeKey = string

export interface HexMap {
    cells: Record<CellKey, TerrainId>
    rivers: Record<EdgeKey, true>
    roads: Record<EdgeKey, true>
}

export const EMPTY_MAP: HexMap = { cells: {}, rivers: {}, roads: {} }

export function edgeKey(a: Cell, b: Cell): EdgeKey {
    const ka = cellKey(a)
    const kb = cellKey(b)
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
}

export function parseEdgeKey(k: EdgeKey): [Cell, Cell] {
    const [a, b] = k.split("|")
    return [parseCellKey(a), parseCellKey(b)]
}

const pathField = (kind: PathKind) => (kind === "river" ? "rivers" : "roads")

export const hasPath = (m: HexMap, kind: PathKind, a: Cell, b: Cell) => !!m[pathField(kind)][edgeKey(a, b)]

/** Before/after values for every key a change touched */
export interface MapDiff {
    cells: Record<CellKey, [TerrainId | undefined, TerrainId | undefined]>
    rivers: Record<EdgeKey, [boolean, boolean]>
    roads: Record<EdgeKey, [boolean, boolean]>
}

export const emptyDiff = (): MapDiff => ({ cells: {}, rivers: {}, roads: {} })

export const diffSize = (d: MapDiff) =>
    Object.keys(d.cells).length + Object.keys(d.rivers).length + Object.keys(d.roads).length

/** Merge `next` into an accumulated diff (keeps the earliest "before") */
export function mergeDiff(acc: MapDiff, next: MapDiff): MapDiff {
    const out: MapDiff = {
        cells: { ...acc.cells },
        rivers: { ...acc.rivers },
        roads: { ...acc.roads },
    }
    for (const [k, [b, a]] of Object.entries(next.cells)) out.cells[k] = [k in acc.cells ? acc.cells[k][0] : b, a]
    for (const f of ["rivers", "roads"] as const)
        for (const [k, [b, a]] of Object.entries(next[f])) out[f][k] = [k in acc[f] ? acc[f][k][0] : b, a]
    // Drop entries that ended where they started
    for (const k of Object.keys(out.cells)) if (out.cells[k][0] === out.cells[k][1]) delete out.cells[k]
    for (const f of ["rivers", "roads"] as const)
        for (const k of Object.keys(out[f])) if (out[f][k][0] === out[f][k][1]) delete out[f][k]
    return out
}

/** Apply the "after" (redo) or "before" (undo) side of a diff */
export function applyDiff(m: HexMap, d: MapDiff, side: "after" | "before"): HexMap {
    const i = side === "after" ? 1 : 0
    const cells = { ...m.cells }
    for (const [k, v] of Object.entries(d.cells)) {
        const t = v[i]
        if (t) cells[k] = t
        else delete cells[k]
    }
    const paths = (f: "rivers" | "roads") => {
        const out = { ...m[f] }
        for (const [k, v] of Object.entries(d[f])) {
            if (v[i]) out[k] = true
            else delete out[k]
        }
        return out
    }
    return { cells, rivers: paths("rivers"), roads: paths("roads") }
}

/** Build the diff that sets these cells/paths on a map */
export function diffFor(
    m: HexMap,
    change: {
        cells?: Record<CellKey, TerrainId | undefined>
        rivers?: Record<EdgeKey, boolean>
        roads?: Record<EdgeKey, boolean>
    }
): MapDiff {
    const d = emptyDiff()
    for (const [k, t] of Object.entries(change.cells ?? {})) if (m.cells[k] !== t) d.cells[k] = [m.cells[k], t]
    for (const f of ["rivers", "roads"] as const)
        for (const [k, on] of Object.entries(change[f] ?? {})) if (!!m[f][k] !== on) d[f][k] = [!!m[f][k], on]
    return d
}

/** Accept whatever a board file holds, dropping anything malformed */
export function sanitizeCells(raw: unknown): Record<CellKey, TerrainId> {
    const out: Record<CellKey, TerrainId> = {}
    if (!raw || typeof raw !== "object") return out
    for (const [k, v] of Object.entries(raw as Record<string, unknown>))
        if (/^-?\d+,-?\d+$/.test(k) && isTerrainId(v)) out[k] = v
    return out
}

export function sanitizeEdges(raw: unknown): Record<EdgeKey, true> {
    const out: Record<EdgeKey, true> = {}
    const list = Array.isArray(raw) ? raw : []
    for (const k of list) if (typeof k === "string" && /^-?\d+,-?\d+\|-?\d+,-?\d+$/.test(k)) out[k] = true
    return out
}

/** Every link touching a hex */
export function edgesAt(m: HexMap, kind: PathKind, c: Cell): EdgeKey[] {
    const key = cellKey(c)
    return Object.keys(m[pathField(kind)]).filter((e) => {
        const [a, b] = e.split("|")
        return a === key || b === key
    })
}
