/*
 * Align and distribute maths for the align bar. Pure (no runtime imports)
 * so it can be checked with a throwaway node script.
 *
 * Items are axis-aligned boxes (position = top-left corner, rotation is
 * ignored, like most whiteboards). Humbugs that share a groupId move as one
 * unit, so aligning two groups lines the groups up rather than scattering
 * their members, unless every selected item is in the same group, in
 * which case the members are aligned individually.
 */

export interface AlignItem {
    id: string
    x: number
    y: number
    w: number
    h: number
    group?: string
}

export type AlignOp =
    | "left"
    | "centre"
    | "right"
    | "top"
    | "middle"
    | "bottom"
    | "distribute-h"
    | "distribute-v"

export interface Move {
    id: string
    x: number
    y: number
}

interface Unit {
    members: AlignItem[]
    x: number
    y: number
    w: number
    h: number
}

function unitOf(members: AlignItem[]): Unit {
    const x1 = Math.min(...members.map((m) => m.x))
    const y1 = Math.min(...members.map((m) => m.y))
    const x2 = Math.max(...members.map((m) => m.x + m.w))
    const y2 = Math.max(...members.map((m) => m.y + m.h))
    return { members, x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

/** Groups become single units; ungrouped items are units of their own */
export function toUnits(items: AlignItem[]): Unit[] {
    const byGroup = new Map<string, AlignItem[]>()
    const units: Unit[] = []
    for (const it of items) {
        if (!it.group) {
            units.push(unitOf([it]))
            continue
        }
        const list = byGroup.get(it.group)
        if (list) list.push(it)
        else byGroup.set(it.group, [it])
    }
    for (const members of byGroup.values()) units.push(unitOf(members))
    // A single group (or a single item) has nothing to align against:
    // align its members instead
    return units.length < 2 ? items.map((it) => unitOf([it])) : units
}

/** Where each unit's top-left goes, for one operation */
function targets(units: Unit[], op: AlignOp): { x: number; y: number }[] {
    const minX = Math.min(...units.map((u) => u.x))
    const minY = Math.min(...units.map((u) => u.y))
    const maxX = Math.max(...units.map((u) => u.x + u.w))
    const maxY = Math.max(...units.map((u) => u.y + u.h))
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    switch (op) {
        case "left":
            return units.map((u) => ({ x: minX, y: u.y }))
        case "right":
            return units.map((u) => ({ x: maxX - u.w, y: u.y }))
        case "centre":
            return units.map((u) => ({ x: cx - u.w / 2, y: u.y }))
        case "top":
            return units.map((u) => ({ x: u.x, y: minY }))
        case "bottom":
            return units.map((u) => ({ x: u.x, y: maxY - u.h }))
        case "middle":
            return units.map((u) => ({ x: u.x, y: cy - u.h / 2 }))
        case "distribute-h":
            return distribute(units, "x")
        case "distribute-v":
            return distribute(units, "y")
    }
}

/**
 * Equal gaps between neighbours along one axis; the first and last stay put.
 * If they overlap too much for positive gaps, centres are spaced evenly
 * instead.
 */
function distribute(units: Unit[], axis: "x" | "y"): { x: number; y: number }[] {
    const size = (u: Unit) => (axis === "x" ? u.w : u.h)
    const pos = (u: Unit) => u[axis]
    const out = units.map((u) => ({ x: u.x, y: u.y }))
    if (units.length < 3) return out
    const order = units
        .map((u, i) => ({ u, i }))
        .sort((a, b) => pos(a.u) + size(a.u) / 2 - (pos(b.u) + size(b.u) / 2) || a.i - b.i)
    const first = order[0].u
    const last = order[order.length - 1].u
    const span = pos(last) + size(last) - pos(first)
    const total = order.reduce((s, { u }) => s + size(u), 0)
    const gap = (span - total) / (order.length - 1)
    if (gap >= 0) {
        let at = pos(first)
        for (const { u, i } of order) {
            out[i][axis] = at
            at += size(u) + gap
        }
    } else {
        const c0 = pos(first) + size(first) / 2
        const c1 = pos(last) + size(last) / 2
        const step = (c1 - c0) / (order.length - 1)
        order.forEach(({ u, i }, k) => {
            out[i][axis] = c0 + step * k - size(u) / 2
        })
    }
    return out
}

/** New positions for every item that moves (members of a unit move together) */
export function alignItems(items: AlignItem[], op: AlignOp): Move[] {
    if (items.length < 2) return []
    const units = toUnits(items)
    const to = targets(units, op)
    const moves: Move[] = []
    units.forEach((u, k) => {
        const dx = to[k].x - u.x
        const dy = to[k].y - u.y
        if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return
        for (const m of u.members) moves.push({ id: m.id, x: m.x + dx, y: m.y + dy })
    })
    return moves
}
