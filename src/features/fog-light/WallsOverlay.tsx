import React, { useCallback, useEffect, useRef } from "react"
import type { Point } from "../../types/humbug.types"
import type { GridShape } from "../../utils/board-styles"
import type { BoardOverlayProps } from "../types"
import { cellAt, cellCenter, cellPolygon, SQUARE } from "../grid"
import { useStore } from "../store"
import { useActiveTool, useTableMode } from "../view-state"
import { useMapKind } from "../map-kind"
import { FOG_KINDS, WALLS_TOOL_ID } from "./ids"
import { sizeCanvas } from "./world-texture"
import { commitWalls, newWallId, useWalls, wallsStore, type Wall } from "./sight"
import { wallModeStore } from "./walls-mode"

/** Snap to grid corners (squares) or hex corners; Alt draws freely */
function snap(p: Point, shape: GridShape, free: boolean): Point {
    if (free) return p
    if (shape === "hex") {
        const c = cellAt(p, shape)
        const pts = [cellCenter(c, shape), ...cellPolygon(c, shape)]
        return pts.reduce((best, q) => (Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? q : best))
    }
    return { x: Math.round(p.x / SQUARE) * SQUARE, y: Math.round(p.y / SQUARE) * SQUARE }
}

function distToWall(p: Point, w: Wall): number {
    const dx = w.x2 - w.x1
    const dy = w.y2 - w.y1
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / len2)) : 0
    return Math.hypot(p.x - (w.x1 + t * dx), p.y - (w.y1 + t * dy))
}

/**
 * Sight walls the GM draws over a map picture. Shown only to the GM (never
 * in Table Mode or to players). While the Walls tool is active it takes the
 * pointer: drag to draw a wall, or rub out walls in Erase mode.
 */
export const WallsOverlay: React.FC<BoardOverlayProps> = ({ camera }) => {
    const walls = useWalls()
    const tableMode = useTableMode()
    const kind = useMapKind()
    const active = useActiveTool() === WALLS_TOOL_ID && FOG_KINDS.includes(kind)
    const mode = useStore(wallModeStore).mode

    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const frame = useRef(0)
    const hover = useRef<Point | null>(null)
    const drag = useRef<{ pointerId: number; from: Point; to: Point; before: readonly Wall[]; erase: boolean } | null>(null)

    const latest = useRef({ camera, walls, tableMode, active, mode })
    useEffect(() => {
        latest.current = { camera, walls, tableMode, active, mode }
    })

    const draw = useCallback(() => {
        frame.current = 0
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return
        const { dpr } = sizeCanvas(canvas)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const L = latest.current
        if (L.tableMode) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        const line = (list: { x1: number; y1: number; x2: number; y2: number }[], colour: string, width: number, dash: number[]) => {
            if (!list.length) return
            ctx.beginPath()
            for (const w of list) {
                const p = L.camera.worldToScreen(w.x1, w.y1)
                const q = L.camera.worldToScreen(w.x2, w.y2)
                ctx.moveTo(p.x, p.y)
                ctx.lineTo(q.x, q.y)
            }
            ctx.lineCap = "round"
            ctx.setLineDash([])
            ctx.lineWidth = width + 2
            ctx.strokeStyle = "rgba(10, 8, 16, 0.85)"
            ctx.stroke()
            ctx.setLineDash(dash)
            ctx.lineWidth = width
            ctx.strokeStyle = colour
            ctx.stroke()
            ctx.setLineDash([])
        }
        // Faint when the tool is off, so the GM knows they're there
        ctx.globalAlpha = L.active ? 1 : 0.45
        line([...L.walls], "#ff7ad9", L.active ? 3 : 2, L.active ? [] : [6, 4])
        ctx.globalAlpha = 1
        const d = drag.current
        if (L.active && d && !d.erase) line([{ x1: d.from.x, y1: d.from.y, x2: d.to.x, y2: d.to.y }], "#fff3b8", 3, [5, 4])
        // Where the next wall starts (or the eraser)
        if (L.active && hover.current) {
            const p = L.camera.worldToScreen(hover.current.x, hover.current.y)
            ctx.beginPath()
            if (L.mode === "erase") ctx.arc(p.x, p.y, 10, 0, Math.PI * 2)
            else ctx.rect(p.x - 4, p.y - 4, 8, 8)
            ctx.lineWidth = 3
            ctx.strokeStyle = "rgba(10, 8, 16, 0.9)"
            ctx.stroke()
            ctx.lineWidth = 1.5
            ctx.strokeStyle = L.mode === "erase" ? "#ff9db0" : "#fff3b8"
            ctx.stroke()
        }
    }, [])

    const schedule = useCallback(() => {
        if (!frame.current) frame.current = requestAnimationFrame(draw)
    }, [draw])

    useEffect(() => {
        schedule()
    }, [camera, walls, tableMode, active, mode, schedule])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ro = new ResizeObserver(() => schedule())
        ro.observe(canvas)
        return () => {
            ro.disconnect()
            cancelAnimationFrame(frame.current)
            frame.current = 0
        }
    }, [schedule])

    useEffect(() => {
        if (!active) {
            drag.current = null
            hover.current = null
            schedule()
        }
    }, [active, schedule])

    const toWorld = (e: React.PointerEvent): Point => {
        const r = wrapRef.current!.getBoundingClientRect()
        return latest.current.camera.containerToWorld(e.clientX - r.left, e.clientY - r.top)
    }

    const rub = (p: Point) => {
        const reach = 10 / latest.current.camera.scale
        const cur = wallsStore.get()
        const next = cur.filter((w) => distToWall(p, w) > reach)
        if (next.length !== cur.length) wallsStore.set(next)
    }

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!active || drag.current || (e.button !== 0 && e.button !== 2)) return
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        const erase = latest.current.mode === "erase" || e.button === 2
        const raw = toWorld(e)
        const p = erase ? raw : snap(raw, latest.current.camera.gridShape, e.altKey)
        drag.current = { pointerId: e.pointerId, from: p, to: p, before: wallsStore.get(), erase }
        if (erase) rub(raw)
        hover.current = p
        schedule()
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!active) return
        const raw = toWorld(e)
        const d = drag.current
        const erase = d ? d.erase : latest.current.mode === "erase"
        const p = erase ? raw : snap(raw, latest.current.camera.gridShape, e.altKey)
        hover.current = p
        if (d && e.pointerId === d.pointerId) {
            if (d.erase) rub(raw)
            else d.to = p
        }
        schedule()
    }

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = drag.current
        if (!d || d.pointerId !== e.pointerId) return
        drag.current = null
        if (d.erase) {
            commitWalls("Erase sight walls", d.before, wallsStore.get())
        } else if (Math.hypot(d.to.x - d.from.x, d.to.y - d.from.y) >= 4) {
            const wall: Wall = { id: newWallId(), x1: d.from.x, y1: d.from.y, x2: d.to.x, y2: d.to.y }
            commitWalls("Draw sight wall", d.before, [...d.before, wall])
        }
        schedule()
    }

    return (
        <div
            ref={wrapRef}
            className={`fogl-overlay fogl-walls ${active ? "is-drawing" : ""}`}
            aria-hidden='true'
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onLostPointerCapture={onPointerUp}
            onPointerLeave={() => {
                if (drag.current) return
                hover.current = null
                schedule()
            }}
            onContextMenu={active ? (e) => e.preventDefault() : undefined}
        >
            <canvas ref={canvasRef} className='fogl-canvas' />
        </div>
    )
}
