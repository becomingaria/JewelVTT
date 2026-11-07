import React, { useEffect, useRef, useState } from "react"
import type { Humbug, Point } from "../types/humbug.types"
import type {
    Connector,
    ConnectorEnd,
    ConnectorSide,
} from "../types/connector.types"
import { Icon } from "./Icon"
import "./ConnectorLayer.css"

interface ConnectorLayerProps {
    humbugs: Humbug[]
    connectors: Connector[]
    selectedHumbugId: string | null
    selectedConnectorId: string | null
    /** Hide anchors (e.g. while a humbug is being dragged) */
    busy: boolean
    worldToScreen: (x: number, y: number) => Point
    containerRef: React.RefObject<HTMLDivElement | null>
    onCreate: (from: ConnectorEnd, to: ConnectorEnd) => void
    onSelect: (id: string | null) => void
    onDelete: (id: string) => void
}

const SIDES: ConnectorSide[] = ["top", "right", "bottom", "left"]
const NORMALS: Record<ConnectorSide, Point> = {
    top: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    bottom: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
}
/** Anchor dots sit this far outside the edge, clear of the resize handles */
const ANCHOR_OFFSET_PX = 16
/** How far around a humbug the pointer can roam and keep its anchors */
const HOVER_MARGIN_PX = 30

/** World-space box of a humbug (position is its top-left corner) */
function humbugBox(h: Humbug) {
    const w = h.type === "map-pin" ? h.size : h.size.width
    const hgt = h.type === "map-pin" ? h.size : h.size.height
    return { x: h.position.x, y: h.position.y, w, h: hgt }
}

function edgePoint(h: Humbug, side: ConnectorSide): Point {
    const b = humbugBox(h)
    switch (side) {
        case "top":
            return { x: b.x + b.w / 2, y: b.y }
        case "right":
            return { x: b.x + b.w, y: b.y + b.h / 2 }
        case "bottom":
            return { x: b.x + b.w / 2, y: b.y + b.h }
        case "left":
            return { x: b.x, y: b.y + b.h / 2 }
    }
}

/** Side of `h` whose midpoint is closest to a world point */
function nearestSide(h: Humbug, p: Point): ConnectorSide {
    let best: ConnectorSide = "top"
    let bestD = Infinity
    for (const side of SIDES) {
        const e = edgePoint(h, side)
        const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2
        if (d < bestD) {
            bestD = d
            best = side
        }
    }
    return best
}

/** Smooth curve leaving/entering each edge along its outward normal */
function curve(a: Point, sa: ConnectorSide, b: Point, sb: ConnectorSide | null) {
    const k = Math.max(36, Math.hypot(b.x - a.x, b.y - a.y) / 3)
    const na = NORMALS[sa]
    const c1 = { x: a.x + na.x * k, y: a.y + na.y * k }
    const nb = sb ? NORMALS[sb] : { x: 0, y: 0 }
    const c2 = { x: b.x + nb.x * k, y: b.y + nb.y * k }
    return `M${a.x} ${a.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`
}

export const ConnectorLayer: React.FC<ConnectorLayerProps> = ({
    humbugs,
    connectors,
    selectedHumbugId,
    selectedConnectorId,
    busy,
    worldToScreen,
    containerRef,
    onCreate,
    onSelect,
    onDelete,
}) => {
    const [hoveredId, setHoveredId] = useState<string | null>(null)
    const [drag, setDrag] = useState<{
        from: ConnectorEnd
        pointer: Point // container coords
        targetId: string | null
    } | null>(null)

    const latest = useRef({ humbugs, worldToScreen, drag })
    useEffect(() => {
        latest.current = { humbugs, worldToScreen, drag }
    })

    const byId = new Map(humbugs.map((h) => [h.id, h]))
    const screenBox = (h: Humbug) => {
        const b = humbugBox(h)
        const tl = worldToScreen(b.x, b.y)
        const br = worldToScreen(b.x + b.w, b.y + b.h)
        return { x1: tl.x, y1: tl.y, x2: br.x, y2: br.y }
    }

    // Track which humbug the pointer is near (topmost wins)
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const container = containerRef.current
            if (!container || latest.current.drag) return
            const r = container.getBoundingClientRect()
            const x = e.clientX - r.left
            const y = e.clientY - r.top
            const { humbugs, worldToScreen } = latest.current
            let found: Humbug | null = null
            for (const h of humbugs) {
                if (h.locked) continue
                const b = humbugBox(h)
                const tl = worldToScreen(b.x, b.y)
                const br = worldToScreen(b.x + b.w, b.y + b.h)
                const m = HOVER_MARGIN_PX
                if (x >= tl.x - m && x <= br.x + m && y >= tl.y - m && y <= br.y + m) {
                    if (!found || h.zIndex >= found.zIndex) found = h
                }
            }
            setHoveredId(found?.id ?? null)
        }
        window.addEventListener("mousemove", onMove)
        return () => window.removeEventListener("mousemove", onMove)
    }, [containerRef])

    // Dragging a new connector from an anchor
    useEffect(() => {
        if (!drag) return
        const container = containerRef.current
        if (!container) return

        const targetAt = (e: MouseEvent) => {
            const el = document
                .elementsFromPoint(e.clientX, e.clientY)
                .find((n) => (n as HTMLElement).dataset?.humbugId) as HTMLElement | undefined
            const id = el?.dataset.humbugId ?? null
            return id && id !== latest.current.drag?.from.humbugId ? id : null
        }
        const onMove = (e: MouseEvent) => {
            const r = container.getBoundingClientRect()
            setDrag((d) =>
                d && { ...d, pointer: { x: e.clientX - r.left, y: e.clientY - r.top }, targetId: targetAt(e) }
            )
        }
        const onUp = (e: MouseEvent) => {
            const d = latest.current.drag
            const targetId = targetAt(e)
            const target = targetId ? latest.current.humbugs.find((h) => h.id === targetId) : null
            const source = d ? latest.current.humbugs.find((h) => h.id === d.from.humbugId) : null
            if (d && target && source) {
                // Attach to the target side facing the source anchor
                onCreate(d.from, { humbugId: target.id, side: nearestSide(target, edgePoint(source, d.from.side)) })
            }
            setDrag(null)
        }
        window.addEventListener("mousemove", onMove)
        window.addEventListener("mouseup", onUp)
        return () => {
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onUp)
        }
        // Only (re)subscribe when a drag starts or ends
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [!!drag])

    const anchorFor = [hoveredId, selectedHumbugId].find((id) => id && byId.get(id) && !byId.get(id)!.locked)
    const anchorHumbug = !busy && !drag && anchorFor ? byId.get(anchorFor)! : null

    const startDrag = (e: React.MouseEvent, h: Humbug, side: ConnectorSide) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        const r = containerRef.current!.getBoundingClientRect()
        setDrag({ from: { humbugId: h.id, side }, pointer: { x: e.clientX - r.left, y: e.clientY - r.top }, targetId: null })
    }

    const selected = connectors.find((c) => c.id === selectedConnectorId)

    return (
        <svg className='connector-layer'>
            <defs>
                <marker id='connector-arrow' viewBox='0 0 10 10' refX='8' refY='5' markerWidth='7' markerHeight='7' orient='auto-start-reverse'>
                    <path d='M0 0 L10 5 L0 10 z' className='connector-arrowhead' />
                </marker>
                <marker id='connector-arrow-selected' viewBox='0 0 10 10' refX='8' refY='5' markerWidth='7' markerHeight='7' orient='auto-start-reverse'>
                    <path d='M0 0 L10 5 L0 10 z' className='connector-arrowhead selected' />
                </marker>
            </defs>

            {connectors.map((c) => {
                const a = byId.get(c.from.humbugId)
                const b = byId.get(c.to.humbugId)
                // Hidden (not lost) while an endpoint is deleted, so undo restores it
                if (!a || !b) return null
                const p1 = edgePoint(a, c.from.side)
                const p2 = edgePoint(b, c.to.side)
                const s1 = worldToScreen(p1.x, p1.y)
                const s2 = worldToScreen(p2.x, p2.y)
                const d = curve(s1, c.from.side, s2, c.to.side)
                const isSel = c.id === selectedConnectorId
                return (
                    <g key={c.id} className={`connector ${isSel ? "selected" : ""}`}>
                        <path
                            d={d}
                            className='connector-hit'
                            onMouseDown={(e) => {
                                if (e.button !== 0) return
                                e.stopPropagation()
                                onSelect(c.id)
                            }}
                        />
                        <path
                            d={d}
                            className='connector-line'
                            markerEnd={`url(#${isSel ? "connector-arrow-selected" : "connector-arrow"})`}
                        />
                    </g>
                )
            })}

            {/* Delete button at the middle of the selected connector */}
            {selected &&
                byId.get(selected.from.humbugId) &&
                byId.get(selected.to.humbugId) &&
                (() => {
                    const a = edgePoint(byId.get(selected.from.humbugId)!, selected.from.side)
                    const b = edgePoint(byId.get(selected.to.humbugId)!, selected.to.side)
                    const m = worldToScreen((a.x + b.x) / 2, (a.y + b.y) / 2)
                    return (
                        <foreignObject x={m.x - 12} y={m.y - 12} width={24} height={24} className='connector-delete-wrap'>
                            <button
                                type='button'
                                className='connector-delete'
                                title='Remove connection'
                                aria-label='Remove connection'
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => onDelete(selected.id)}
                            >
                                <Icon name='close' size={12} />
                            </button>
                        </foreignObject>
                    )
                })()}

            {/* Rubber band while dragging a new connector */}
            {drag &&
                byId.get(drag.from.humbugId) &&
                (() => {
                    const src = byId.get(drag.from.humbugId)!
                    const p = edgePoint(src, drag.from.side)
                    const s = worldToScreen(p.x, p.y)
                    const target = drag.targetId ? byId.get(drag.targetId) : null
                    const tb = target ? screenBox(target) : null
                    return (
                        <>
                            {tb && (
                                <rect
                                    className='connector-target'
                                    x={tb.x1 - 4}
                                    y={tb.y1 - 4}
                                    width={tb.x2 - tb.x1 + 8}
                                    height={tb.y2 - tb.y1 + 8}
                                    rx={6}
                                />
                            )}
                            <path
                                d={curve(s, drag.from.side, drag.pointer, null)}
                                className='connector-line connector-rubber'
                                markerEnd='url(#connector-arrow)'
                            />
                        </>
                    )
                })()}

            {/* Anchor dots on the hovered / selected humbug */}
            {anchorHumbug &&
                SIDES.map((side) => {
                    const p = edgePoint(anchorHumbug, side)
                    const s = worldToScreen(p.x, p.y)
                    const n = NORMALS[side]
                    return (
                        <circle
                            key={side}
                            className='connector-anchor'
                            cx={s.x + n.x * ANCHOR_OFFSET_PX}
                            cy={s.y + n.y * ANCHOR_OFFSET_PX}
                            r={6}
                            onMouseDown={(e) => startDrag(e, anchorHumbug, side)}
                        >
                            <title>Drag to another object to connect</title>
                        </circle>
                    )
                })}
        </svg>
    )
}
