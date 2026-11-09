import type { Humbug, Point } from "../../types/humbug.types"
import type { GridShape } from "../../utils/board-styles"
import { humbugFootprint } from "../../utils/humbug.utils"
import { isHumbugHidden } from "../view-state"
import {
    formatCells,
    formatUnits,
    pathDistance,
    templateCells,
    templateTouchesRect,
    TEMPLATE_SHAPES,
    type DiagonalRule,
    type Template,
} from "./geometry"
import { tokenSpeed, type Measurement } from "./state"

/* Turning measurements and templates into words (labels, live region) */

export interface Scale {
    perCell: number
    unit: string
}

export interface MeasureReadout {
    cells: number
    cellsText: string
    unitsText: string
    /** "60 of 120 ft" when started on a token (feet maps only) */
    speedText?: string
    /** 0..1+ share of the token's movement used */
    speedUsed?: number
    over?: boolean
    tokenName?: string
}

export const measurePoints = (m: Measurement): Point[] => (m.live ? [...m.points, m.live] : m.points)

export function readMeasurement(
    m: Measurement,
    shape: GridShape,
    rule: DiagonalRule,
    scale: Scale,
    humbugs: readonly Humbug[]
): MeasureReadout {
    const { total } = pathDistance(measurePoints(m), shape, rule)
    const units = total * scale.perCell
    const out: MeasureReadout = {
        cells: total,
        cellsText: formatCells(total, shape),
        unitsText: formatUnits(units, scale.unit),
    }
    const token = m.tokenId ? humbugs.find((h) => h.id === m.tokenId) : undefined
    if (token && scale.unit === "ft") {
        const speed = tokenSpeed(token.ext)
        out.speedUsed = units / speed
        out.over = units > speed
        out.speedText = `${units.toLocaleString()} of ${speed.toLocaleString()} ft`
        out.tokenName = token.type === "token" && token.name ? token.name : "Token"
    }
    return out
}

export function announceMeasurement(r: MeasureReadout): string {
    let s = `Distance ${r.unitsText}, ${r.cellsText}.`
    if (r.speedText) {
        s += ` ${r.tokenName}: ${r.speedText}${r.over ? ", over its movement rate" : ""}.`
    }
    return s
}

/** Visible tokens touched by a template (topmost first) */
export function tokensInTemplate(
    t: Template,
    shape: GridShape,
    perCell: number,
    humbugs: readonly Humbug[],
    cells = templateCells(t, shape, perCell)
): Humbug[] {
    return humbugs
        .filter((h) => h.type === "token" && !isHumbugHidden(h))
        .filter((h) => {
            const f = humbugFootprint(h)
            return templateTouchesRect(t, cells, { x: h.position.x, y: h.position.y, ...f }, shape, perCell)
        })
        .sort((a, b) => b.zIndex - a.zIndex)
}

export const tokenName = (h: Humbug) => (h.type === "token" && h.name?.trim()) || "Unnamed token"

export function templateTitle(t: Template, unit: string): string {
    const info = TEMPLATE_SHAPES.find((s) => s.id === t.shape)!
    return `${info.label}, ${formatUnits(t.size, unit)} ${info.sizeLabel}`
}

export function announceTemplate(
    verb: string,
    t: Template,
    shape: GridShape,
    scale: Scale,
    humbugs: readonly Humbug[]
): string {
    const cells = templateCells(t, shape, scale.perCell)
    const inside = tokensInTemplate(t, shape, scale.perCell, humbugs, cells)
    const who = inside.length ? ` Inside: ${inside.map(tokenName).join(", ")}.` : " No tokens inside."
    return `${templateTitle(t, scale.unit)} ${verb}, covering ${formatCells(cells.length, shape)}.${who}`
}
