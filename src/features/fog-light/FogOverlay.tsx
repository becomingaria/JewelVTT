import React, { useCallback, useEffect, useRef, useState } from "react"
import type { Point } from "../../types/humbug.types"
import type { BoardOverlayProps } from "../types"
import { useStore } from "../store"
import { useActiveTool, useTableMode } from "../view-state"
import { useMapKind } from "../map-kind"
import { cellAt, parseCellKey } from "../grid"
import { playSfx } from "../sound"
import { FOG_KINDS, FOG_TOOL_ID } from "./ids"
import { FogRenderer, type FogLook } from "./render-fog"
import { sizeCanvas } from "./world-texture"
import { fogLook, useThemeTick } from "./looks"
import { brushCells, brushSweep, outlineEdges } from "./brush"
import {
    brushStore,
    commitFog,
    fogNoticeStore,
    fogShape,
    fogStore,
    withCells,
    type FogState,
} from "./fog-store"
import { useEffectiveFog } from "./effective-fog"
import {
    brushTargetStore,
    commitReveals,
    revealLayersStore,
    withLayerCells,
    type RevealLayer,
} from "./reveal-store"
import "./fog-light.css"

interface Stroke {
    pointerId: number
    before: FogState
    /** Painting into a reveal layer instead of the board fog */
    target: string | null
    beforeLayers: readonly RevealLayer[]
    reveal: boolean
    last: Point
}

/**
 * Fog of war (overlayZ 30). Draw-only, except while the fog brush is the
 * active tool: then it takes the pointer and paints cells.
 */
export const FogOverlay: React.FC<BoardOverlayProps> = ({ camera }) => {
    const fog = useStore(fogStore)
    // What's drawn: painted fog minus visible reveal layers and token vision
    const shown = useEffectiveFog()
    const target = useStore(brushTargetStore)
    const layers = useStore(revealLayersStore)
    const tableMode = useTableMode()
    const kind = useMapKind()
    const active = useActiveTool() === FOG_TOOL_ID && FOG_KINDS.includes(kind)
    const brush = useStore(brushStore)
    const themeTick = useThemeTick()

    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [renderer] = useState(() => new FogRenderer())
    const frame = useRef(0)
    const hover = useRef<Point | null>(null)
    const altHeld = useRef(false)
    const stroke = useRef<Stroke | null>(null)
    const look = useRef<{ key: string; look: FogLook } | null>(null)

    const latest = useRef({ camera, fog, shown, target, layers, tableMode, active, brush, themeTick })
    useEffect(() => {
        latest.current = { camera, fog, shown, target, layers, tableMode, active, brush, themeTick }
    })

    const draw = useCallback(() => {
        frame.current = 0
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return
        const { w, h, dpr } = sizeCanvas(canvas)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const L = latest.current

        if (L.fog.enabled) {
            const key = `${L.themeTick}|${L.tableMode}`
            if (look.current?.key !== key) look.current = { key, look: fogLook(canvas, L.tableMode) }
            renderer.draw(ctx, L.camera, L.shown, look.current.look, w, h, dpr)
        }

        // While painting a reveal layer, outline its cells (dashed gold) so
        // the GM can see a layer that isn't switched on yet
        const layer = L.active && L.target ? L.layers.find((l) => l.id === L.target) : undefined
        if (layer?.cells.size) {
            const shape = fogShape(L.fog)
            const edges = outlineEdges([...layer.cells].map(parseCellKey), shape)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.beginPath()
            for (const [a, b] of edges) {
                const p = L.camera.worldToScreen(a.x, a.y)
                const q = L.camera.worldToScreen(b.x, b.y)
                ctx.moveTo(p.x, p.y)
                ctx.lineTo(q.x, q.y)
            }
            ctx.setLineDash([4, 4])
            ctx.lineWidth = 3
            ctx.strokeStyle = "#f5c542"
            ctx.stroke()
            ctx.setLineDash([])
        }

        // Brush outline: solid = reveal, dashed = hide (not colour alone)
        if (L.active && hover.current) {
            const shape = fogShape(L.fog)
            const hide = L.brush.mode === "hide" || altHeld.current || stroke.current?.reveal === false
            const cells = brushCells(cellAt(hover.current, shape), L.brush.size, shape)
            const edges = outlineEdges(cells, shape)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.beginPath()
            for (const [a, b] of edges) {
                const p = L.camera.worldToScreen(a.x, a.y)
                const q = L.camera.worldToScreen(b.x, b.y)
                ctx.moveTo(p.x, p.y)
                ctx.lineTo(q.x, q.y)
            }
            ctx.lineCap = "square"
            ctx.setLineDash([])
            ctx.lineWidth = 4
            ctx.strokeStyle = "rgba(10, 8, 16, 0.9)"
            ctx.stroke()
            ctx.setLineDash(hide ? [6, 5] : [])
            ctx.lineWidth = 2
            ctx.strokeStyle = hide ? "#ff9db0" : "#fff3b8"
            ctx.stroke()
        }
    }, [renderer])

    const schedule = useCallback(() => {
        if (!frame.current) frame.current = requestAnimationFrame(draw)
    }, [draw])

    useEffect(() => {
        schedule()
    }, [camera, fog, shown, target, layers, tableMode, active, brush, themeTick, schedule])

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

    // ------------------------------------------------------------ painting
    const toWorld = (e: React.PointerEvent | PointerEvent): Point => {
        const r = wrapRef.current!.getBoundingClientRect()
        return latest.current.camera.containerToWorld(e.clientX - r.left, e.clientY - r.top)
    }

    const paint = (from: Point, to: Point) => {
        const s = stroke.current
        if (!s) return
        const cur = fogStore.get()
        const cells = brushSweep(from, to, latest.current.brush.size, fogShape(cur))
        if (s.target) revealLayersStore.set(withLayerCells(revealLayersStore.get(), s.target, cells, s.reveal))
        else fogStore.set(withCells(cur, cells, s.reveal))
    }

    const finish = useCallback(() => {
        const s = stroke.current
        if (!s) return
        stroke.current = null
        if (s.target) {
            commitReveals(s.reveal ? "Paint reveal layer" : "Erase reveal layer", s.beforeLayers, revealLayersStore.get())
            return
        }
        const after = fogStore.get()
        if (after === s.before) return
        // The cells are already on screen; record the whole stroke as one step
        commitFog(s.reveal ? "Reveal fog" : "Hide fog", s.before, after)
        if (s.reveal) playSfx("reveal")
    }, [])

    // Leaving the tool mid-stroke still records the stroke
    useEffect(() => {
        if (!active) {
            finish()
            hover.current = null
        }
    }, [active, finish])

    // Alt flips the brush to Hide while held; the outline follows
    useEffect(() => {
        if (!active) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Alt") return
            altHeld.current = e.type === "keydown"
            // Stop Alt from focusing the browser menu bar while painting
            if (e.type === "keyup") e.preventDefault()
            schedule()
        }
        const onBlur = () => {
            altHeld.current = false
            schedule()
        }
        window.addEventListener("keydown", onKey)
        window.addEventListener("keyup", onKey)
        window.addEventListener("blur", onBlur)
        return () => {
            window.removeEventListener("keydown", onKey)
            window.removeEventListener("keyup", onKey)
            window.removeEventListener("blur", onBlur)
        }
    }, [active, schedule])

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!active || stroke.current) return
        if (e.button !== 0 && e.button !== 2) return
        e.preventDefault()
        e.stopPropagation()
        const before = fogStore.get()
        const target = brushTargetStore.get()
        const targetExists = !!target && revealLayersStore.get().some((l) => l.id === target)
        if (!before.enabled && !targetExists) {
            fogNoticeStore.set("Fog is off on this board. Turn it on (Shift+G) or Cover board first.")
            return
        }
        fogNoticeStore.set("")
        const reveal = !(e.altKey || e.button === 2 || latest.current.brush.mode === "hide")
        const p = toWorld(e)
        e.currentTarget.setPointerCapture(e.pointerId)
        stroke.current = {
            pointerId: e.pointerId,
            before,
            target: targetExists ? target : null,
            beforeLayers: revealLayersStore.get(),
            reveal,
            last: p,
        }
        hover.current = p
        paint(p, p)
        schedule()
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!active) return
        const p = toWorld(e)
        hover.current = p
        altHeld.current = e.altKey
        const s = stroke.current
        if (s && e.pointerId === s.pointerId) {
            paint(s.last, p)
            s.last = p
        }
        schedule()
    }

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (stroke.current?.pointerId === e.pointerId) finish()
    }

    const onPointerLeave = () => {
        if (stroke.current) return
        hover.current = null
        schedule()
    }

    return (
        <div
            ref={wrapRef}
            className={`fogl-overlay fogl-fog ${active ? "is-brush" : ""}`}
            aria-hidden='true'
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onLostPointerCapture={onPointerUp}
            onPointerLeave={onPointerLeave}
            onContextMenu={active ? (e) => e.preventDefault() : undefined}
        >
            <canvas ref={canvasRef} className='fogl-canvas' />
        </div>
    )
}
