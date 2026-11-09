import React, { useLayoutEffect, useMemo, useRef } from "react"
import { useHumbugs } from "../board-bridge"
import { usePrefs } from "../prefs"
import { useStore } from "../store"
import type { BoardOverlayProps } from "../types"
import { isHumbugHidden, useLayerState, useTableMode } from "../view-state"
import { hexExt, humbugCentre } from "./actions"
import { MARKER_SIZE } from "./markers"
import { drawTerrain, type LabelSpec } from "./render"
import { mapStore, uiStore } from "./state"
import { useContainerSize } from "./hooks"

/** Read a CSS custom property for canvas text (canvas can't use var()) */
function cssFont(name: string, fallback: string) {
    try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
        return v || fallback
    } catch {
        return fallback
    }
}

/** Terrain tiles, rivers, roads, marker labels and hex numbers (below humbugs) */
export const TerrainUnderlay: React.FC<BoardOverlayProps> = ({ camera }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const map = useStore(mapStore)
    const { showCoords } = useStore(uiStore)
    const prefs = usePrefs()
    const humbugs = useHumbugs()
    const layers = useLayerState()
    const tableMode = useTableMode()
    const size = useContainerSize(camera.container)

    const labels = useMemo(() => {
        const out: LabelSpec[] = []
        for (const h of humbugs) {
            const ext = hexExt(h)
            if (!ext?.marker || (!ext.label && !ext.number)) continue
            if (isHumbugHidden(h, layers, tableMode)) continue
            const c = humbugCentre(h)
            out.push({
                at: { x: c.x, y: c.y + MARKER_SIZE / 2 },
                text: [ext.number, ext.label].filter(Boolean).join(" "),
            })
        }
        return out
    }, [humbugs, layers, tableMode])

    const empty = !Object.keys(map.cells).length && !labels.length && !showCoords
        && !Object.keys(map.rivers).length && !Object.keys(map.roads).length

    useLayoutEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !size.w || !size.h) return
        const dpr = window.devicePixelRatio || 1
        const W = Math.round(size.w * dpr)
        const H = Math.round(size.h * dpr)
        if (canvas.width !== W) canvas.width = W
        if (canvas.height !== H) canvas.height = H
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        if (empty) {
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.clearRect(0, 0, W, H)
            return
        }
        drawTerrain(ctx, {
            camera,
            width: size.w,
            height: size.h,
            dpr,
            map,
            labels,
            showCoords,
            highContrast: prefs.highContrast,
            bodyFont: prefs.readableFont
                ? "system-ui, sans-serif"
                : cssFont("--jv-font-body", "system-ui, sans-serif"),
            monoFont: cssFont("--jv-font-mono", "ui-monospace, monospace"),
        })
    }, [camera, map, labels, showCoords, size, prefs.highContrast, prefs.readableFont, empty])

    return (
        <canvas
            ref={canvasRef}
            className='hx-underlay'
            aria-hidden='true'
            style={{ width: size.w, height: size.h }}
        />
    )
}
