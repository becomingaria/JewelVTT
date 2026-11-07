import React, { useEffect, useRef, useState } from "react"
import type {
    ScribbleLayer,
    ScribbleSettings,
    ScribbleStroke,
} from "../types/scribble.types"
import { SCRIBBLE_OPACITY } from "../types/scribble.types"
import { GRAIN_FILTER_ID, strokePath } from "../utils/scribble-art"
import { IDENTITY, invert, type Projection } from "../utils/projection"
import "./ScribbleOverlay.css"

interface ViewPort {
    x: number
    y: number
    zoom: number
}

interface ScribbleOverlayProps {
    layers: ScribbleLayer[]
    activeLayerId: string | null
    /** Pencil mode on: left-drag draws instead of panning/selecting */
    drawing: boolean
    settings: ScribbleSettings
    viewport: ViewPort
    projection?: Projection
    containerRef: React.RefObject<HTMLDivElement | null>
    onStrokeComplete: (layerId: string, stroke: ScribbleStroke) => void
    onErase: (
        layerId: string,
        removed: { stroke: ScribbleStroke; index: number }[]
    ) => void
}

const ERASER_RADIUS_PX = 10

/** Distance from point to the closest segment of a stroke */
function distanceToStroke(px: number, py: number, s: ScribbleStroke) {
    const p = s.points
    let best = Infinity
    if (p.length === 2) return Math.hypot(px - p[0], py - p[1])
    for (let i = 0; i < p.length - 2; i += 2) {
        const ax = p[i], ay = p[i + 1], bx = p[i + 2], by = p[i + 3]
        const dx = bx - ax, dy = by - ay
        const len2 = dx * dx + dy * dy || 1
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
        best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
    }
    return best
}

let strokeCounter = 0
const newStrokeId = () => `stroke_${Date.now().toString(36)}_${strokeCounter++}`

export const ScribbleOverlay: React.FC<ScribbleOverlayProps> = ({
    layers,
    activeLayerId,
    drawing,
    settings,
    viewport,
    projection = IDENTITY,
    containerRef,
    onStrokeComplete,
    onErase,
}) => {
    const [live, setLive] = useState<ScribbleStroke | null>(null)
    const [erasing, setErasing] = useState<Set<string>>(new Set())

    // Latest props for the native listeners
    const latest = useRef({ layers, activeLayerId, settings, viewport, projection, onStrokeComplete, onErase })
    useEffect(() => {
        latest.current = { layers, activeLayerId, settings, viewport, projection, onStrokeComplete, onErase }
    })

    useEffect(() => {
        const container = containerRef.current
        if (!container || !drawing) return

        let stroke: ScribbleStroke | null = null
        let erased: { stroke: ScribbleStroke; index: number }[] = []
        let pointerId: number | null = null

        const toWorld = (e: PointerEvent) => {
            const { viewport, projection } = latest.current
            const rect = container.getBoundingClientRect()
            const w = invert(
                projection,
                (e.clientX - rect.left - rect.width / 2) / viewport.zoom,
                (e.clientY - rect.top - rect.height / 2) / viewport.zoom
            )
            return { x: w.x - viewport.x, y: w.y - viewport.y }
        }

        const eraseAt = (e: PointerEvent) => {
            const { layers, activeLayerId, viewport } = latest.current
            const layer = layers.find((l) => l.id === activeLayerId)
            if (!layer) return
            const w = toWorld(e)
            const radius = ERASER_RADIUS_PX / viewport.zoom
            layer.strokes.forEach((s, index) => {
                if (erased.some((r) => r.stroke.id === s.id)) return
                if (distanceToStroke(w.x, w.y, s) <= radius + s.size / 2) {
                    erased.push({ stroke: s, index })
                }
            })
            setErasing(new Set(erased.map((r) => r.stroke.id)))
        }

        const onDown = (e: PointerEvent) => {
            // Shift+drag still pans; other buttons keep their normal jobs
            if (e.button !== 0 || e.shiftKey) return
            // Only draw on the board itself or on objects. Menus, their
            // click-away backdrops, dialogs and buttons keep working normally.
            const target = e.target as HTMLElement
            const onBoard =
                target.classList.contains("infinite-whiteboard-canvas") ||
                (!!target.closest(".humbug-layer") && !target.closest("button"))
            if (!onBoard) return
            const { activeLayerId, settings } = latest.current
            if (!activeLayerId) return

            // Cancelling pointerdown also suppresses the follow-up mouse events
            e.preventDefault()
            e.stopPropagation()
            pointerId = e.pointerId
            container.setPointerCapture(e.pointerId)

            if (settings.tool === "eraser") {
                erased = []
                eraseAt(e)
                return
            }
            const w = toWorld(e)
            stroke = {
                id: newStrokeId(),
                color: settings.color,
                size: settings.size,
                points: [w.x, w.y],
            }
            setLive({ ...stroke })
        }

        const onMove = (e: PointerEvent) => {
            if (e.pointerId !== pointerId) return
            if (latest.current.settings.tool === "eraser") {
                eraseAt(e)
                return
            }
            if (!stroke) return
            const w = toWorld(e)
            const p = stroke.points
            const min = 0.75 / latest.current.viewport.zoom
            if (Math.hypot(w.x - p[p.length - 2], w.y - p[p.length - 1]) < min) return
            stroke.points = [...p, w.x, w.y]
            setLive({ ...stroke })
        }

        const onUp = (e: PointerEvent) => {
            if (e.pointerId !== pointerId) return
            pointerId = null
            const { activeLayerId, onStrokeComplete, onErase } = latest.current
            if (stroke && activeLayerId) onStrokeComplete(activeLayerId, stroke)
            if (erased.length && activeLayerId) onErase(activeLayerId, erased)
            stroke = null
            erased = []
            setLive(null)
            setErasing(new Set())
        }

        container.addEventListener("pointerdown", onDown, true)
        container.addEventListener("pointermove", onMove)
        container.addEventListener("pointerup", onUp)
        container.addEventListener("pointercancel", onUp)
        return () => {
            container.removeEventListener("pointerdown", onDown, true)
            container.removeEventListener("pointermove", onMove)
            container.removeEventListener("pointerup", onUp)
            container.removeEventListener("pointercancel", onUp)
        }
    }, [drawing, containerRef])

    const container = containerRef.current
    const cx = (container?.clientWidth ?? 0) / 2
    const cy = (container?.clientHeight ?? 0) / 2
    // World -> screen: centre + zoom * M * (world + viewport)
    const z = viewport.zoom
    const p = projection
    const transform = `matrix(${z * p.m11} ${z * p.m21} ${z * p.m12} ${z * p.m22} ${
        cx + z * (p.m11 * viewport.x + p.m12 * viewport.y)
    } ${cy + z * (p.m21 * viewport.x + p.m22 * viewport.y)})`

    const renderStroke = (s: ScribbleStroke, ghost = false) => (
        <path
            key={s.id}
            d={strokePath(s.points)}
            stroke={s.color}
            strokeWidth={s.size}
            opacity={ghost ? 0.25 : 1}
        />
    )

    return (
        <svg className={`scribble-overlay ${drawing ? "is-drawing" : ""}`} aria-hidden='true'>
            <defs>
                {/* Graphite grain: thins the stroke in a fine noisy pattern */}
                <filter id={GRAIN_FILTER_ID} x='-5%' y='-5%' width='110%' height='110%'>
                    <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='3' result='noise' />
                    <feColorMatrix
                        in='noise'
                        type='matrix'
                        values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 2.1'
                        result='grain'
                    />
                    <feComposite in='SourceGraphic' in2='grain' operator='in' />
                </filter>
            </defs>
            <g transform={transform}>
                {layers.map((layer) =>
                    layer.visible ? (
                        <g
                            key={layer.id}
                            className='scribble-layer'
                            opacity={SCRIBBLE_OPACITY}
                            filter={`url(#${GRAIN_FILTER_ID})`}
                        >
                            {layer.strokes.map((s) => renderStroke(s, erasing.has(s.id)))}
                            {live && layer.id === activeLayerId && renderStroke(live)}
                        </g>
                    ) : null
                )}
            </g>
        </svg>
    )
}
