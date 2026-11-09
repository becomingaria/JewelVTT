import React, { useCallback, useEffect, useRef, useState } from "react"
import type { BoardOverlayProps } from "../types"
import { GRID_SIZE, useHumbugs } from "../board-bridge"
import { useStore } from "../store"
import { isHumbugHidden, useLayerState, useTableMode } from "../view-state"
import { MAP_SCALE, useMapKind, type MapKind } from "../map-kind"
import { useReducedMotion } from "../prefs"
import type { Humbug } from "../../types/humbug.types"
import { humbugFootprint } from "../../utils/humbug.utils"
import { darknessStore } from "./light-store"
import { flickerFactor } from "./dither"
import { LightRenderer, type DarkLook, type LitSource } from "./render-light"
import { parseColour, sizeCanvas } from "./world-texture"
import { darkLook, useThemeTick } from "./looks"
import "./fog-light.css"

/** Redraw rate while torches flicker (the wobble itself is ~2 Hz) */
const FLICKER_MS = 80

/** Feet → world units on this kind of map */
function feetToWorld(kind: MapKind, feet: number): number {
    const s = MAP_SCALE[kind]
    const feetPerCell = s.unit === "ft" ? s.perCell : s.perCell * 5280
    return (feet / feetPerCell) * GRID_SIZE
}

function phaseOf(id: string): number {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
    return ((h >>> 0) % 1000) / 1000 * Math.PI * 2
}

const isLit = (h: Humbug) => !!h.light && (h.light.bright > 0 || h.light.dim > 0)

/**
 * Scene darkness (overlayZ 20): darkens the board in Dim and Dark scenes,
 * except around humbugs that carry a light. Draw-only.
 */
export const LightOverlay: React.FC<BoardOverlayProps> = ({ camera }) => {
    const darkness = useStore(darknessStore)
    const tableMode = useTableMode()
    const humbugs = useHumbugs()
    const layers = useLayerState()
    const kind = useMapKind()
    const reduced = useReducedMotion()
    const themeTick = useThemeTick()

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [renderer] = useState(() => new LightRenderer())
    const frame = useRef(0)
    const look = useRef<{ key: string; look: DarkLook | null } | null>(null)

    const lights = humbugs.filter((h) => isLit(h) && !isHumbugHidden(h, layers, false))
    const flickering = !reduced && darkness !== "daylight" && lights.some((h) => h.light?.flicker)

    const latest = useRef({ camera, darkness, tableMode, lights, kind, reduced, themeTick })
    useEffect(() => {
        latest.current = { camera, darkness, tableMode, lights, kind, reduced, themeTick }
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
        const key = `${L.themeTick}|${L.tableMode}|${L.darkness}`
        if (look.current?.key !== key) look.current = { key, look: darkLook(canvas, L.darkness, L.tableMode) }
        const dl = look.current.look
        if (!dl) return

        const now = performance.now() / 1000
        const sources: LitSource[] = L.lights.map((hb) => {
            const light = hb.light!
            const size = humbugFootprint(hb)
            const f = light.flicker && !L.reduced ? flickerFactor(now, phaseOf(hb.id)) : 1
            const bright = feetToWorld(L.kind, Math.max(0, light.bright)) * f
            const outer = feetToWorld(L.kind, Math.max(0, light.bright) + Math.max(0, light.dim)) * f
            return {
                x: hb.position.x + size.width / 2,
                y: hb.position.y + size.height / 2,
                bright,
                outer,
                tint: light.color ? parseColour(light.color, [255, 200, 120, 255]) : null,
            }
        })
        renderer.draw(ctx, L.camera, sources, dl, w, h, dpr)
    }, [renderer])

    const schedule = useCallback(() => {
        if (!frame.current) frame.current = requestAnimationFrame(draw)
    }, [draw])

    useEffect(() => {
        schedule()
    }, [camera, darkness, tableMode, humbugs, layers, kind, reduced, themeTick, schedule])

    useEffect(() => {
        if (!flickering) return
        const id = window.setInterval(schedule, FLICKER_MS)
        return () => window.clearInterval(id)
    }, [flickering, schedule])

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

    return (
        <div className='fogl-overlay fogl-light' aria-hidden='true'>
            <canvas ref={canvasRef} className='fogl-canvas' />
        </div>
    )
}
