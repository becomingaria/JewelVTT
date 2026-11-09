import React from "react"
import type { TokenBadgeProps } from "../types"
import { useTableMode } from "../view-state"
import { presetOf } from "./light-store"

/** Outer flame, then inner core: [row, fromX, toX] on a 7×9 pixel grid */
const OUTER: [number, number, number][] = [
    [0, 3, 3],
    [1, 2, 3],
    [2, 2, 4],
    [3, 1, 4],
    [4, 1, 5],
    [5, 0, 5],
    [6, 0, 6],
    [7, 1, 5],
    [8, 2, 4],
]
const INNER: [number, number, number][] = [
    [4, 3, 3],
    [5, 2, 3],
    [6, 2, 4],
    [7, 3, 4],
]

const rows = (spans: [number, number, number][], cls: string) =>
    spans.map(([y, a, b]) => <rect key={`${cls}${y}`} className={cls} x={a} y={y} width={b - a + 1} height={1} />)

const PixelFlame: React.FC = () => (
    <svg className='fogl-flame' viewBox='0 0 7 9' shapeRendering='crispEdges' aria-hidden='true'>
        {rows(OUTER, "fogl-flame-outer")}
        {rows(INNER, "fogl-flame-inner")}
    </svg>
)

/** Small pixel flame on lit humbugs, with turns left when the light burns out */
export const LightBadge: React.FC<TokenBadgeProps> = ({ humbug }) => {
    const tableMode = useTableMode()
    const light = humbug.light
    // The light itself is on the board; the badge is GM detail
    if (!light || tableMode) return null
    const name = presetOf(light)?.label ?? "Light"
    const turns = light.turnsLeft
    const label =
        turns != null ? `${name}: ${turns} turn${turns === 1 ? "" : "s"} left` : `${name}`
    return (
        <span className={`fogl-badge ${turns != null && turns <= 1 ? "is-low" : ""}`} role='img' aria-label={label} title={label}>
            <PixelFlame />
            {turns != null && <span className='fogl-badge-num'>{turns}</span>}
        </span>
    )
}
