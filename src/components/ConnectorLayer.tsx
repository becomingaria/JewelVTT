import React, { useEffect, useRef, useState } from "react"
import type { Humbug, Point } from "../types/humbug.types"
import type {
    Connector,
    ConnectorEnd,
    ConnectorSide,
} from "../types/connector.types"
import { Icon } from "./Icon"
import { IDENTITY, type Projection } from "../utils/projection"
import {
    placeHumbug,
    projectOnHumbug,
    screenQuad,
    type HumbugPlacement,
} from "../utils/humbug-geometry"
import "./ConnectorLayer.css"

interface ConnectorLayerProps {
    humbugs: Humbug[]
    connectors: Connector[]
    selectedHumbugId: string | null
    selectedConnectorId: string | null
    /** Hide anchors (e.g. while a humbug is being dragged) */
    busy: boolean
    worldToScreen: (x: number, y: number) => Point
    /** Board zoom */
    scale: number
    projection?: Projection
    /** 0..1: how far humbugs stand up in 2.5D */
    standUp?: number
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

/** An end of a connector on screen: the edge midpoint and its outward direction */
interface ScreenEnd {
    p: Point
    n: Point
}

/** Midpoint of a side, in the humbug's own (element) pixels */
function sideMidpoint(pl: HumbugPlacement, side: ConnectorSide): Point {
    const { width: w, height: h } = pl
    switch (side) {
        case "top":
            return { x: w / 2, y: 0 }
        case "right":
            return { x: w, y: h / 2 }
        case "bottom":
            return { x: w / 2, y: h }
        case "left":
            return { x: 0, y: h / 2 }
    }
}

/**
 * Where a side of a humbug is on screen, as drawn: flat, tilted, rotated or
 * standing up. The outward direction comes from projecting a point a little
 * outside the edge, so it bends correctly in every view.
 */
function screenEnd(pl: HumbugPlacement, side: ConnectorSide): ScreenEnd {
    const m = sideMidpoint(pl, side)
    const n = NORMALS[side]
    const p = projectOnHumbug(pl, m.x, m.y)
    const q = projectOnHumbug(pl, m.x + n.x * 10, m.y + n.y * 10)
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1
    return { p, n: { x: (q.x - p.x) / len, y: (q.y - p.y) / len } }
}

/** Smooth curve leaving / entering each end along its outward direction */
function curve(a: ScreenEnd, b: ScreenEnd | Point) {
    const end = "p" in b ? b.p : b
    const k = Math.max(36, Math.hypot(end.x - a.p.x, end.y - a.p.y) / 3)
    const c1 = { x: a.p.x + a.n.x * k, y: a.p.y + a.n.y * k }
    const c2 = "p" in b ? { x: b.p.x + b.n.x * k, y: b.p.y + b.n.y * k } : end
    return `M${a.p.x} ${a.p.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`
}

export const ConnectorLayer: React.FC<ConnectorLayerProps> = ({
    humbugs,
    connectors,
    selectedHumbugId,
    selectedConnectorId,
    busy,
    worldToScreen,
    scale,
    projection = IDENTITY,
    standUp = 0,
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

    // Placement of every humbug exactly as HumbugRenderer draws it
    const ctx = {
        scale,
        standUp,
        projection,
        worldToScreen,
        containerWidth: containerRef.current?.clientWidth ?? 0,
    }
    const placements = new Map(humbugs.map((h) => [h.id, placeHumbug(h, ctx)]))
    const byId = new Map(humbugs.map((h) => [h.id, h]))
    const endOf = (id: string, side: ConnectorSide) => {
        const pl = placements.get(id)
        return pl ? screenEnd(pl, side) : null
    }

    const latest = useRef({ humbugs, placements, drag })
    useEffect(() => {
        latest.current = { humbugs, placements, drag }
    })

    // Track which humbug the pointer is near (frontmost wins), using where
    // each one appears on screen
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const container = containerRef.current
            if (!container || latest.current.drag) return
            const r = container.getBoundingClientRect()
            const x = e.clientX - r.left
            const y = e.clientY - r.top
            const { humbugs, placements } = latest.current
            let found: { id: string; z: number } | null = null
            for (const h of humbugs) {
                if (h.locked) continue
                const pl = placements.get(h.id)
                if (!pl) continue
                const q = screenQuad(pl)
                const m = HOVER_MARGIN_PX
                const inside =
                    x >= Math.min(...q.map((p) => p.x)) - m &&
                    x <= Math.max(...q.map((p) => p.x)) + m &&
                    y >= Math.min(...q.map((p) => p.y)) - m &&
                    y <= Math.max(...q.map((p) => p.y)) + m
                if (inside && (!found || pl.zIndex >= found.z)) found = { id: h.id, z: pl.zIndex }
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
            const { placements } = latest.current
            const src = d && placements.get(d.from.humbugId)
            const tgt = targetId ? placements.get(targetId) : undefined
            if (d && src && tgt && targetId) {
                // Attach to the target side nearest the source anchor, on screen
                const from = screenEnd(src, d.from.side).p
                let side: ConnectorSide = "top"
                let best = Infinity
                for (const s of SIDES) {
                    const p = screenEnd(tgt, s).p
                    const dist = (p.x - from.x) ** 2 + (p.y - from.y) ** 2
                    if (dist < best) {
                        best = dist
                        side = s
                    }
                }
                onCreate(d.from, { humbugId: targetId, side })
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
                // Hidden (not lost) while an endpoint is deleted, so undo restores it
                const a = endOf(c.from.humbugId, c.from.side)
                const b = endOf(c.to.humbugId, c.to.side)
                if (!a || !b) return null
                const d = curve(a, b)
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
                (() => {
                    const a = endOf(selected.from.humbugId, selected.from.side)
                    const b = endOf(selected.to.humbugId, selected.to.side)
                    if (!a || !b) return null
                    const m = { x: (a.p.x + b.p.x) / 2, y: (a.p.y + b.p.y) / 2 }
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
                (() => {
                    const src = endOf(drag.from.humbugId, drag.from.side)
                    if (!src) return null
                    const target = drag.targetId ? placements.get(drag.targetId) : undefined
                    return (
                        <>
                            {target && (
                                <polygon
                                    className='connector-target'
                                    points={screenQuad(target).map((p) => `${p.x},${p.y}`).join(" ")}
                                />
                            )}
                            <path
                                d={curve(src, drag.pointer)}
                                className='connector-line connector-rubber'
                                markerEnd='url(#connector-arrow)'
                            />
                        </>
                    )
                })()}

            {/* Anchor dots just outside each side of the hovered / selected humbug */}
            {anchorHumbug &&
                SIDES.map((side) => {
                    const end = endOf(anchorHumbug.id, side)
                    if (!end) return null
                    return (
                        <circle
                            key={side}
                            className='connector-anchor'
                            cx={end.p.x + end.n.x * ANCHOR_OFFSET_PX}
                            cy={end.p.y + end.n.y * ANCHOR_OFFSET_PX}
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
