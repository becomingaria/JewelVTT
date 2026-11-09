import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { BoardOverlayProps } from "../types"
import { useStore } from "../store"
import { usePrefs } from "../prefs"
import { floorStore } from "./state"
import { FloorRenderer, mapColours } from "./render"

/** The dungeon floor, walls and hatching, drawn below the humbugs */
export const FloorUnderlay: React.FC<BoardOverlayProps> = ({ camera }) => {
    const floor = useStore(floorStore)
    const { highContrast, theme } = usePrefs()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rendererRef = useRef<FloorRenderer | null>(null)
    const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 })

    // Track the board container's size (and the screen's pixel ratio)
    const empty = floor.size === 0
    useEffect(() => {
        const el = canvasRef.current?.parentElement
        if (!el) return
        const measure = () =>
            setSize({ w: el.clientWidth, h: el.clientHeight, dpr: Math.min(window.devicePixelRatio || 1, 2) })
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [empty])

    useLayoutEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx || !size.w || !size.h) return
        const pw = Math.round(size.w * size.dpr)
        const ph = Math.round(size.h * size.dpr)
        if (canvas.width !== pw) canvas.width = pw
        if (canvas.height !== ph) canvas.height = ph
        rendererRef.current ??= new FloorRenderer()
        const r = rendererRef.current
        r.setFloor(floor)
        r.draw(ctx, camera, size.w, size.h, size.dpr, mapColours(), { highContrast })
        // theme: colours come from tokens, so redraw when it changes
    }, [camera, floor, size, highContrast, theme])

    if (empty) return null
    return <canvas ref={canvasRef} className='dgn-floor' aria-hidden='true' />
}
