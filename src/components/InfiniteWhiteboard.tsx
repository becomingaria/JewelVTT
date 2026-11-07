import React, { useRef, useEffect, useState, useCallback, useMemo } from "react"
import type { Point, Humbug } from "../types/humbug.types"
import { TRANSPARENT, type PaintTool } from "./Apron"
import { HumbugManager } from "./HumbugManager"
import { exportBoardAsPNG, importBoardFromPNG } from "../utils/export.utils"
import { UndoRedoManager } from "../utils/undo-redo.utils"
import {
    AREA_SELECT_EVENT,
    FLY_TO_EVENT,
    type AreaSelectDetail,
    type FlyToDetail,
} from "../utils/view-events"
import type { Spot } from "../types/spot.types"
import {
    getBoardStyle,
    type BoardStyleId,
    type GridShape,
} from "../utils/board-styles"
import { useBoardSlice } from "../utils/board-store"
import {
    apply,
    invert,
    projectionForTilt,
    type Projection,
    type ViewMode,
} from "../utils/projection"
import type { DragTailStyleId } from "../utils/drag-tail-styles"
import { ScribbleOverlay } from "./ScribbleOverlay"
import type {
    ScribbleLayer,
    ScribbleSettings,
    ScribbleStroke,
} from "../types/scribble.types"
import { Icon } from "./Icon"
import "./InfiniteWhiteboard.css"

interface ViewPort {
    x: number
    y: number
    zoom: number
}

const GRID_SIZE = 32 // 32x32 pixel squares
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5

interface InfiniteWhiteboardProps {
    showGridLines?: boolean
    showDragTails?: boolean
    dragTailStyle?: DragTailStyleId
    gridShape?: GridShape
    /** 2D top-down or 2.5D isometric camera */
    viewMode?: ViewMode
    backgroundTexture?: string | null
    textureScale?: number
    activePaintTool?: PaintTool
    selectedColor?: string
    paintGrid?: Map<string, string>
    setPaintGrid?: React.Dispatch<React.SetStateAction<Map<string, string>>>
    undoRedoManager?: UndoRedoManager
    spots?: Spot[]
    /** Draw the texture without smoothing (generated pixel-art styles) */
    texturePixelated?: boolean
    boardStyle?: BoardStyleId
    scribbleLayers?: ScribbleLayer[]
    activeScribbleId?: string | null
    scribbleDrawing?: boolean
    scribbleSettings?: ScribbleSettings
    onStrokeComplete?: (layerId: string, stroke: ScribbleStroke) => void
    onScribbleErase?: (
        layerId: string,
        removed: { stroke: ScribbleStroke; index: number }[]
    ) => void
}

const FLY_DURATION_MS = 550
const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export const InfiniteWhiteboard: React.FC<InfiniteWhiteboardProps> = ({
    showGridLines = true,
    showDragTails = true,
    dragTailStyle = "ruler",
    gridShape = "square",
    viewMode = "2d",
    backgroundTexture = null,
    textureScale = 1.0,
    activePaintTool = null,
    selectedColor = "#3498db",
    paintGrid: externalPaintGrid,
    setPaintGrid: setExternalPaintGrid,
    undoRedoManager,
    spots = [],
    texturePixelated = false,
    boardStyle = "blank",
    scribbleLayers = [],
    activeScribbleId = null,
    scribbleDrawing = false,
    scribbleSettings = { tool: "pencil", color: "#2b2b30", size: 4 },
    onStrokeComplete = () => {},
    onScribbleErase = () => {},
}) => {
    const style = getBoardStyle(boardStyle)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [viewport, setViewport] = useState<ViewPort>({ x: 0, y: 0, zoom: 1 })
    const [isDragging, setIsDragging] = useState(false)
    const [lastMousePos, setLastMousePos] = useState<Point>({ x: 0, y: 0 })
    const [contextMenuEvent, setContextMenuEvent] =
        useState<React.MouseEvent | null>(null)
    const [isShiftHeld, setIsShiftHeld] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isPaintDragging, setIsPaintDragging] = useState(false)

    // Load the background texture once per URL; redraw when it's ready
    const [textureImage, setTextureImage] = useState<HTMLImageElement | null>(
        null
    )
    useEffect(() => {
        if (!backgroundTexture) {
            setTextureImage(null)
            return
        }
        let cancelled = false
        const img = new Image()
        img.onload = () => {
            if (!cancelled) setTextureImage(img)
        }
        img.src = backgroundTexture
        return () => {
            cancelled = true
        }
    }, [backgroundTexture])

    // Camera tilt: 0 = flat 2D, 1 = isometric. Animated so switching views
    // looks like the board pitching down / back up.
    const [tilt, setTilt] = useState(viewMode === "iso" ? 1 : 0)
    const tiltRef = useRef(tilt)
    useEffect(() => {
        tiltRef.current = tilt
    }, [tilt])
    useEffect(() => {
        const target = viewMode === "iso" ? 1 : 0
        const from = tiltRef.current
        if (from === target) return
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        if (reduce) {
            setTilt(target)
            return
        }
        let frame = 0
        const start = performance.now()
        const step = (now: number) => {
            const t = Math.min(1, (now - start) / 550)
            setTilt(from + (target - from) * easeInOutCubic(t))
            if (t < 1) frame = requestAnimationFrame(step)
        }
        frame = requestAnimationFrame(step)
        return () => cancelAnimationFrame(frame)
    }, [viewMode])
    const projection: Projection = useMemo(() => projectionForTilt(tilt), [tilt])

    // Remember where the user was looking
    useBoardSlice<ViewPort>("viewport", viewport, (v) =>
        setViewport(v ?? { x: 0, y: 0, zoom: 1 })
    )

    // Latest viewport for the fly-to animation, which runs outside renders
    const viewportRef = useRef(viewport)
    useEffect(() => {
        viewportRef.current = viewport
    }, [viewport])

    // Middle-mouse drag draws a selection marquee (container coords)
    const [marquee, setMarquee] = useState<{
        x1: number
        y1: number
        x2: number
        y2: number
    } | null>(null)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        let start: { x: number; y: number; shift: boolean } | null = null

        const local = (e: MouseEvent) => {
            const r = container.getBoundingClientRect()
            return { x: e.clientX - r.left, y: e.clientY - r.top }
        }

        const onDown = (e: MouseEvent) => {
            if (e.button !== 1) return
            // Capture phase: keeps humbugs from treating it as a drag, and
            // preventDefault stops the browser's middle-click autoscroll
            e.preventDefault()
            e.stopPropagation()
            const p = local(e)
            start = { ...p, shift: e.shiftKey }
            setMarquee({ x1: p.x, y1: p.y, x2: p.x, y2: p.y })
        }
        const onMove = (e: MouseEvent) => {
            if (!start) return
            const p = local(e)
            setMarquee({ x1: start.x, y1: start.y, x2: p.x, y2: p.y })
        }
        const onUp = (e: MouseEvent) => {
            if (!start || e.button !== 1) return
            const p = local(e)
            const detail: AreaSelectDetail = {
                x1: Math.min(start.x, p.x),
                y1: Math.min(start.y, p.y),
                x2: Math.max(start.x, p.x),
                y2: Math.max(start.y, p.y),
                additive: start.shift,
            }
            window.dispatchEvent(new CustomEvent(AREA_SELECT_EVENT, { detail }))
            start = null
            setMarquee(null)
        }
        const noAutoScroll = (e: MouseEvent) => {
            if (e.button === 1) e.preventDefault()
        }

        container.addEventListener("mousedown", onDown, true)
        container.addEventListener("auxclick", noAutoScroll)
        window.addEventListener("mousemove", onMove)
        window.addEventListener("mouseup", onUp)
        return () => {
            container.removeEventListener("mousedown", onDown, true)
            container.removeEventListener("auxclick", noAutoScroll)
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onUp)
        }
    }, [])

    // Smoothly fly the camera to a world point (Go Home, spot tabs).
    // Any wheel or mouse-down on the board cancels the flight.
    useEffect(() => {
        let frame = 0
        const cancel = () => cancelAnimationFrame(frame)

        const handleFlyTo = (event: Event) => {
            const target = (event as CustomEvent<FlyToDetail>).detail
            cancel()
            const from = viewportRef.current
            const to = {
                x: -target.x,
                y: -target.y,
                zoom: Math.max(
                    MIN_ZOOM,
                    Math.min(MAX_ZOOM, target.zoom ?? from.zoom)
                ),
            }
            const start = performance.now()
            const step = (now: number) => {
                const t = Math.min(1, (now - start) / FLY_DURATION_MS)
                const k = easeInOutCubic(t)
                setViewport({
                    x: from.x + (to.x - from.x) * k,
                    y: from.y + (to.y - from.y) * k,
                    // Interpolate zoom geometrically so it feels even
                    zoom: from.zoom * Math.pow(to.zoom / from.zoom, k),
                })
                if (t < 1) frame = requestAnimationFrame(step)
            }
            frame = requestAnimationFrame(step)
        }

        const container = containerRef.current
        window.addEventListener(FLY_TO_EVENT, handleFlyTo)
        container?.addEventListener("wheel", cancel, { passive: true })
        container?.addEventListener("mousedown", cancel)
        return () => {
            cancel()
            window.removeEventListener(FLY_TO_EVENT, handleFlyTo)
            container?.removeEventListener("wheel", cancel)
            container?.removeEventListener("mousedown", cancel)
        }
    }, [])

    // Track changes during a paint drag operation for batched undo
    const paintDragChanges = useRef<
        Map<string, { oldColor?: string; newColor?: string }>
    >(new Map())

    // Use external paint grid or fallback to local state for backwards compatibility
    const paintGrid = useMemo(
        () => externalPaintGrid || new Map<string, string>(),
        [externalPaintGrid]
    )
    const setPaintGrid = useMemo(
        () => setExternalPaintGrid || (() => {}),
        [setExternalPaintGrid]
    )

    // Convert screen coordinates to world coordinates
    const screenToWorld = useCallback(
        (screenX: number, screenY: number): Point => {
            const container = containerRef.current
            if (!container) return { x: 0, y: 0 }

            // screenX and screenY are expected to be viewport coordinates
            const rect = container.getBoundingClientRect()
            const containerX = screenX - rect.left
            const containerY = screenY - rect.top

            const w = invert(
                projection,
                (containerX - container.clientWidth / 2) / viewport.zoom,
                (containerY - container.clientHeight / 2) / viewport.zoom
            )
            return { x: w.x - viewport.x, y: w.y - viewport.y }
        },
        [viewport, projection]
    )

    // Convert container-relative coordinates to world coordinates
    const containerToWorld = useCallback(
        (containerX: number, containerY: number): Point => {
            const container = containerRef.current
            if (!container) return { x: 0, y: 0 }

            const w = invert(
                projection,
                (containerX - container.clientWidth / 2) / viewport.zoom,
                (containerY - container.clientHeight / 2) / viewport.zoom
            )
            return { x: w.x - viewport.x, y: w.y - viewport.y }
        },
        [viewport, projection]
    )

    // Convert world coordinates to screen coordinates
    const worldToScreen = useCallback(
        (worldX: number, worldY: number): Point => {
            const container = containerRef.current
            if (!container) return { x: 0, y: 0 }

            const s = apply(projection, worldX + viewport.x, worldY + viewport.y)
            return {
                x: s.x * viewport.zoom + container.clientWidth / 2,
                y: s.y * viewport.zoom + container.clientHeight / 2,
            }
        },
        [viewport, projection]
    )

    // Start a paint stroke (batched operation)
    const startPaintStroke = useCallback(() => {
        paintDragChanges.current.clear()
        setIsPaintDragging(true)
    }, [])

    // End a paint stroke and record the batched action
    const endPaintStroke = useCallback(() => {
        if (paintDragChanges.current.size > 0) {
            undoRedoManager?.addAction({
                type: "PAINT_STROKE",
                timestamp: Date.now(),
                changes: new Map(paintDragChanges.current),
            })
        }
        paintDragChanges.current.clear()
        setIsPaintDragging(false)
    }, [undoRedoManager])

    // Helper function to paint/erase a grid square (now supports batching)
    const paintGridSquare = useCallback(
        (e: React.MouseEvent, forceErase?: boolean, isPartOfStroke = false) => {
            if (
                !activePaintTool ||
                (activePaintTool !== "paint" && activePaintTool !== "eraser")
            )
                return

            const worldPos = screenToWorld(e.clientX, e.clientY)
            const gridX = Math.floor(worldPos.x / GRID_SIZE)
            const gridY = Math.floor(worldPos.y / GRID_SIZE)
            const key = `${gridX},${gridY}`

            // Get the current color at this position for undo
            const previousColor = paintGrid.get(key)

            setPaintGrid((prev) => {
                const newGrid = new Map(prev)

                // Painting with "transparent" clears squares like the eraser
                if (
                    forceErase ||
                    activePaintTool === "eraser" ||
                    selectedColor === TRANSPARENT
                ) {
                    if (isPartOfStroke) {
                        // Batch the change
                        if (!paintDragChanges.current.has(key)) {
                            paintDragChanges.current.set(key, {
                                oldColor: previousColor,
                            })
                        }
                        paintDragChanges.current.get(key)!.newColor = undefined
                    } else if (previousColor) {
                        // Single action - record immediately
                        undoRedoManager?.addAction({
                            type: "ERASE_SQUARE",
                            timestamp: Date.now(),
                            gridKey: key,
                            previousColor: previousColor,
                        })
                    }
                    newGrid.delete(key)
                } else if (activePaintTool === "paint") {
                    if (isPartOfStroke) {
                        // Batch the change
                        if (!paintDragChanges.current.has(key)) {
                            paintDragChanges.current.set(key, {
                                oldColor: previousColor,
                            })
                        }
                        paintDragChanges.current.get(key)!.newColor =
                            selectedColor
                    } else {
                        // Single action - record immediately
                        undoRedoManager?.addAction({
                            type: "PAINT_SQUARE",
                            timestamp: Date.now(),
                            gridKey: key,
                            color: selectedColor,
                            previousColor: previousColor,
                        })
                    }
                    newGrid.set(key, selectedColor)
                }
                return newGrid
            })
        },
        [
            activePaintTool,
            selectedColor,
            screenToWorld,
            setPaintGrid,
            paintGrid,
            undoRedoManager,
        ]
    )

    // Draw the board: base colour, texture, painted squares, grid and axes.
    // Everything is drawn in world units under one canvas transform, so the
    // same code renders the flat 2D board and the tilted 2.5D one.
    const drawGrid = useCallback(
        (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
            const { width, height } = canvas
            const z = viewport.zoom
            const p = projection
            const cx = width / 2
            const cy = height / 2

            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.fillStyle = style.base
            ctx.fillRect(0, 0, width, height)

            // world -> screen as a canvas matrix (see utils/projection.ts)
            ctx.setTransform(
                z * p.m11,
                z * p.m21,
                z * p.m12,
                z * p.m22,
                cx + z * (p.m11 * viewport.x + p.m12 * viewport.y),
                cy + z * (p.m21 * viewport.x + p.m22 * viewport.y)
            )

            // Visible world area: bounding box of the four screen corners
            const corners = [
                containerToWorld(0, 0),
                containerToWorld(width, 0),
                containerToWorld(0, height),
                containerToWorld(width, height),
            ]
            const minX = Math.min(...corners.map((c) => c.x))
            const maxX = Math.max(...corners.map((c) => c.x))
            const minY = Math.min(...corners.map((c) => c.y))
            const maxY = Math.max(...corners.map((c) => c.y))

            // Texture: one seamless pattern fill (no tile seams at any angle)
            if (textureImage) {
                const tileWorld = 320 * textureScale
                const pattern = ctx.createPattern(textureImage, "repeat")
                if (pattern) {
                    pattern.setTransform(
                        new DOMMatrix().scale(
                            tileWorld / textureImage.naturalWidth,
                            tileWorld / textureImage.naturalHeight
                        )
                    )
                    ctx.imageSmoothingEnabled = !texturePixelated
                    ctx.fillStyle = pattern
                    ctx.fillRect(minX, minY, maxX - minX, maxY - minY)
                    ctx.imageSmoothingEnabled = true
                }
            }

            // Painted grid squares
            if (paintGrid.size > 0) {
                const gx0 = Math.floor(minX / GRID_SIZE)
                const gx1 = Math.ceil(maxX / GRID_SIZE)
                const gy0 = Math.floor(minY / GRID_SIZE)
                const gy1 = Math.ceil(maxY / GRID_SIZE)
                // Iterate whichever is smaller: painted cells or visible cells
                const visibleCells = (gx1 - gx0 + 1) * (gy1 - gy0 + 1)
                const drawCell = (gx: number, gy: number, color: string) => {
                    ctx.fillStyle = color
                    // tiny overlap hides anti-aliasing hairlines between cells
                    ctx.fillRect(gx * GRID_SIZE, gy * GRID_SIZE, GRID_SIZE + 0.3, GRID_SIZE + 0.3)
                }
                if (paintGrid.size < visibleCells) {
                    paintGrid.forEach((color, key) => {
                        const [gx, gy] = key.split(",").map(Number)
                        if (gx >= gx0 && gx <= gx1 && gy >= gy0 && gy <= gy1) drawCell(gx, gy, color)
                    })
                } else {
                    for (let gx = gx0; gx <= gx1; gx++)
                        for (let gy = gy0; gy <= gy1; gy++) {
                            const color = paintGrid.get(`${gx},${gy}`)
                            if (color) drawCell(gx, gy, color)
                        }
                }
            }

            if (showGridLines) {
                ctx.strokeStyle = z > 0.5 ? style.grid : style.gridFar
                ctx.lineWidth = 1 / z // 1 screen pixel

                if (gridShape === "hex") {
                    // Pointy-top hexagons as wide as a grid square, odd rows
                    // shifted half a hex. Skip when they'd be too small to see.
                    const w = GRID_SIZE
                    const r = w / Math.sqrt(3) // centre-to-corner
                    const rowStep = 1.5 * r
                    if (w * z >= 8) {
                        const row0 = Math.floor(minY / rowStep) - 1
                        const row1 = Math.ceil(maxY / rowStep) + 1
                        const col0 = Math.floor(minX / w) - 1
                        const col1 = Math.ceil(maxX / w) + 1
                        ctx.beginPath()
                        for (let row = row0; row <= row1; row++) {
                            const hy = row * rowStep
                            const shift = ((row % 2) + 2) % 2 ? w / 2 : 0
                            for (let col = col0; col <= col1; col++) {
                                const hx = col * w + shift
                                for (let k = 0; k <= 6; k++) {
                                    const a = (Math.PI / 3) * k - Math.PI / 2
                                    const px = hx + r * Math.cos(a)
                                    const py = hy + r * Math.sin(a)
                                    if (k === 0) ctx.moveTo(px, py)
                                    else ctx.lineTo(px, py)
                                }
                            }
                        }
                        ctx.stroke()
                    }
                } else if (GRID_SIZE * z >= 3) {
                    ctx.beginPath()
                    for (let x = Math.floor(minX / GRID_SIZE) * GRID_SIZE; x <= maxX; x += GRID_SIZE) {
                        ctx.moveTo(x, minY)
                        ctx.lineTo(x, maxY)
                    }
                    for (let y = Math.floor(minY / GRID_SIZE) * GRID_SIZE; y <= maxY; y += GRID_SIZE) {
                        ctx.moveTo(minX, y)
                        ctx.lineTo(maxX, y)
                    }
                    ctx.stroke()
                }

                // Coordinate axes and origin
                ctx.strokeStyle = "#ff0000"
                ctx.lineWidth = 2 / z
                ctx.beginPath()
                ctx.moveTo(minX, 0)
                ctx.lineTo(maxX, 0)
                ctx.moveTo(0, minY)
                ctx.lineTo(0, maxY)
                ctx.stroke()

                ctx.setTransform(1, 0, 0, 1, 0, 0)
                const origin = worldToScreen(0, 0)
                ctx.fillStyle = "#ff0000"
                ctx.beginPath()
                ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2)
                ctx.fill()
            }

            ctx.setTransform(1, 0, 0, 1, 0, 0)
        },
        [
            viewport,
            projection,
            containerToWorld,
            worldToScreen,
            showGridLines,
            textureImage,
            texturePixelated,
            textureScale,
            paintGrid,
            style,
            gridShape,
        ]
    )

    // Render function
    const render = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        drawGrid(ctx, canvas)
    }, [drawGrid])

    // Handle mouse wheel for zooming
    const handleWheel = useCallback(
        (e: WheelEvent) => {
            // Don't zoom if a modal is open - allow scrolling in modal instead
            if (isModalOpen) {
                return
            }

            e.preventDefault()

            const canvas = canvasRef.current
            if (!canvas) return

            // Calculate new zoom
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
            const newZoom = Math.max(
                MIN_ZOOM,
                Math.min(MAX_ZOOM, viewport.zoom * zoomFactor)
            )

            // The viewport position should remain the same to keep the center fixed
            // Only the zoom level changes
            setViewport((prev) => ({
                x: prev.x,
                y: prev.y,
                zoom: newZoom,
            }))
        },
        [viewport, isModalOpen]
    )

    // Dump (bucket) fill: flood the connected area of the clicked square's
    // colour. Empty space is unbounded, so the fill stays within the visible
    // board (plus a margin). Recorded as one undoable stroke.
    const dumpFillAt = useCallback(
        (e: React.MouseEvent) => {
            const container = containerRef.current
            if (!container) return
            const world = screenToWorld(e.clientX, e.clientY)
            const sx = Math.floor(world.x / GRID_SIZE)
            const sy = Math.floor(world.y / GRID_SIZE)
            const target = paintGrid.get(`${sx},${sy}`)
            const fill = selectedColor === TRANSPARENT ? undefined : selectedColor
            if (target === fill) return

            // Visible board area (all four corners: it's a diamond in 2.5D)
            const w = container.clientWidth
            const h = container.clientHeight
            const corners = [
                containerToWorld(0, 0),
                containerToWorld(w, 0),
                containerToWorld(0, h),
                containerToWorld(w, h),
            ]
            const pad = 4
            const minX = Math.floor(Math.min(...corners.map((c) => c.x)) / GRID_SIZE) - pad
            const maxX = Math.ceil(Math.max(...corners.map((c) => c.x)) / GRID_SIZE) + pad
            const minY = Math.floor(Math.min(...corners.map((c) => c.y)) / GRID_SIZE) - pad
            const maxY = Math.ceil(Math.max(...corners.map((c) => c.y)) / GRID_SIZE) + pad

            const changes = new Map<string, { oldColor?: string; newColor?: string }>()
            const seen = new Set<string>()
            const queue: [number, number][] = [[sx, sy]]
            while (queue.length) {
                const [x, y] = queue.pop()!
                const key = `${x},${y}`
                if (seen.has(key) || x < minX || x > maxX || y < minY || y > maxY) continue
                seen.add(key)
                if (paintGrid.get(key) !== target) continue
                changes.set(key, { oldColor: target, newColor: fill })
                queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
            }
            if (changes.size === 0) return

            setPaintGrid((prev) => {
                const next = new Map(prev)
                changes.forEach((c, key) => {
                    if (c.newColor) next.set(key, c.newColor)
                    else next.delete(key)
                })
                return next
            })
            undoRedoManager?.addAction({
                type: "PAINT_STROKE",
                timestamp: Date.now(),
                changes,
            })
        },
        [paintGrid, selectedColor, screenToWorld, containerToWorld, setPaintGrid, undoRedoManager]
    )

    // Handle mouse down
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (activePaintTool === "dump") {
                if (e.button === 0) dumpFillAt(e)
                return
            }

            // Handle paint tool clicks
            if (activePaintTool === "paint" || activePaintTool === "eraser") {
                startPaintStroke()
                // Right-click with paint tool should erase
                const isRightClick = e.button === 2
                paintGridSquare(
                    e,
                    isRightClick && activePaintTool === "paint",
                    true
                )
                return
            }

            // Only start panning if shift key is held or if clicking on empty space
            // (humbugs will stopPropagation if shift is not held)
            setIsDragging(true)
            setLastMousePos({ x: e.clientX, y: e.clientY })
        },
        [activePaintTool, paintGridSquare, startPaintStroke, dumpFillAt]
    )

    // Handle mouse move
    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            // Handle paint dragging
            if (
                isPaintDragging &&
                (activePaintTool === "paint" || activePaintTool === "eraser")
            ) {
                // Check if right mouse button is held during drag
                const isRightClick = (e.buttons & 2) !== 0
                paintGridSquare(
                    e,
                    isRightClick && activePaintTool === "paint",
                    true
                )
                return
            }

            if (!isDragging) return

            // Screen drag -> board movement (through the camera tilt)
            const d = invert(
                projection,
                e.clientX - lastMousePos.x,
                e.clientY - lastMousePos.y
            )

            setViewport((prev) => ({
                ...prev,
                x: prev.x + d.x / prev.zoom,
                y: prev.y + d.y / prev.zoom,
            }))

            setLastMousePos({ x: e.clientX, y: e.clientY })
        },
        [
            isDragging,
            lastMousePos,
            projection,
            isPaintDragging,
            activePaintTool,
            paintGridSquare,
        ]
    )

    // Handle mouse up
    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
        if (isPaintDragging) {
            endPaintStroke()
        }
    }, [isPaintDragging, endPaintStroke])

    // Handle right-click - delegate to HumbugManager
    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault()

            // If paint tools are active, don't show context menu
            if (
                activePaintTool === "paint" ||
                activePaintTool === "eraser" ||
                activePaintTool === "dump"
            ) {
                return
            }

            setContextMenuEvent(e)
            // Clear the event after a short delay to allow the HumbugManager to process it
            setTimeout(() => setContextMenuEvent(null), 100)
        },
        [activePaintTool]
    )

    // Resize canvas to match container
    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) return

        // Use clientWidth/clientHeight to match our coordinate calculations
        canvas.width = container.clientWidth
        canvas.height = container.clientHeight
        render()
    }, [render])

    // Set up event listeners and resize handling
    useEffect(() => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) return

        container.addEventListener("wheel", handleWheel, { passive: false })
        window.addEventListener("resize", resizeCanvas)

        // Initial resize
        resizeCanvas()

        return () => {
            container.removeEventListener("wheel", handleWheel)
            window.removeEventListener("resize", resizeCanvas)
        }
    }, [handleWheel, resizeCanvas])

    // Re-render when viewport changes
    useEffect(() => {
        render()
    }, [render])

    // Handle export/import events from TopBar
    useEffect(() => {
        const handleExport = async () => {
            if (containerRef.current) {
                const windowGlobal = window as unknown as {
                    exportHumbugData?: () => void
                }
                windowGlobal.exportHumbugData?.()
            }
        }

        const handleImport = async (event: Event) => {
            const customEvent = event as CustomEvent<File>
            const file = customEvent.detail
            const boardData = await importBoardFromPNG(file)

            if (boardData) {
                const windowGlobal = window as unknown as {
                    importHumbugData?: (humbugs: unknown[]) => void
                }
                windowGlobal.importHumbugData?.(boardData.humbugs)

                // Restore viewport
                setViewport(boardData.viewport)

                // Restore paintGrid
                if (boardData.paintGrid) {
                    const newPaintGrid = new Map(
                        Object.entries(boardData.paintGrid)
                    )
                    setPaintGrid(newPaintGrid)
                }

                // Restore texture
                if (
                    boardData.backgroundTexture !== undefined ||
                    boardData.textureScale !== undefined
                ) {
                    const textureEvent = new CustomEvent("textureImported", {
                        detail: {
                            backgroundTexture: boardData.backgroundTexture,
                            textureScale: boardData.textureScale,
                        },
                    })
                    window.dispatchEvent(textureEvent)
                }
            }
        }

        const handleClearBoard = () => {
            // Record the current paint grid for undo
            const previousGrid = new Map(paintGrid)
            undoRedoManager?.addAction({
                type: "CLEAR_BOARD",
                timestamp: Date.now(),
                previousGrid: previousGrid,
                // Note: previous humbugs will be recorded by HumbugManager
            })

            // Clear all board content
            setPaintGrid(new Map())
            setViewport({ x: 0, y: 0, zoom: 1 })

            // Clear humbugs via the global function
            const windowGlobal = window as unknown as {
                clearAllHumbugs?: () => void
            }
            windowGlobal.clearAllHumbugs?.()
        }

        window.addEventListener("exportBoard", handleExport)
        window.addEventListener("importBoard", handleImport)
        window.addEventListener("clearBoard", handleClearBoard)

        return () => {
            window.removeEventListener("exportBoard", handleExport)
            window.removeEventListener("importBoard", handleImport)
            window.removeEventListener("clearBoard", handleClearBoard)
        }
    }, [viewport, paintGrid, setPaintGrid, undoRedoManager])

    // Callback to handle export request from HumbugManager
    const handleExportRequest = useCallback(
        async (humbugs: Humbug[]) => {
            if (containerRef.current) {
                await exportBoardAsPNG(
                    containerRef.current,
                    humbugs,
                    viewport,
                    backgroundTexture,
                    textureScale,
                    paintGrid
                )
            }
        },
        [viewport, backgroundTexture, textureScale, paintGrid]
    )

    // Callback to handle import completion
    const handleImportRequest = useCallback((humbugs: Humbug[]) => {
        console.log(`Imported ${humbugs.length} humbugs successfully`)
    }, [])

    // Handle modal state changes from HumbugManager
    const handleModalStateChange = useCallback((isOpen: boolean) => {
        setIsModalOpen(isOpen)
    }, [])

    // Track shift key state for panning
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Shift") {
                setIsShiftHeld(true)
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "Shift") {
                setIsShiftHeld(false)
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        window.addEventListener("keyup", handleKeyUp)

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener("keyup", handleKeyUp)
        }
    }, [])

    return (
        <div
            className={`infinite-whiteboard-container ${
                isShiftHeld ? "shift-pan-mode" : ""
            } ${activePaintTool === "paint" ? "paint-mode" : ""} ${
                activePaintTool === "eraser" ? "eraser-mode" : ""
            } ${activePaintTool === "dump" ? "dump-mode" : ""} ${
                scribbleDrawing
                    ? scribbleSettings.tool === "eraser"
                        ? "scribble-eraser"
                        : "scribble-pencil"
                    : ""
            }`}
            ref={containerRef}
            style={{ backgroundColor: style.base }}
        >
            <canvas
                ref={canvasRef}
                className='infinite-whiteboard-canvas'
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={handleContextMenu}
            />

            {/* Humbug Manager for interactive elements */}
            <HumbugManager
                scale={viewport.zoom}
                containerRef={containerRef}
                containerToWorld={containerToWorld}
                worldToScreen={worldToScreen}
                contextMenuEvent={contextMenuEvent}
                showDragTails={showDragTails}
                dragTailStyle={dragTailStyle}
                projection={projection}
                standUp={tilt}
                gridShape={gridShape}
                isShiftHeld={isShiftHeld}
                onExportRequest={handleExportRequest}
                onImportRequest={handleImportRequest}
                onModalStateChange={handleModalStateChange}
                undoRedoManager={undoRedoManager}
            />

            <ScribbleOverlay
                layers={scribbleLayers}
                activeLayerId={activeScribbleId}
                drawing={scribbleDrawing}
                settings={scribbleSettings}
                viewport={viewport}
                projection={projection}
                containerRef={containerRef}
                onStrokeComplete={onStrokeComplete}
                onErase={onScribbleErase}
            />

            {marquee && (
                <div
                    className='area-select-marquee'
                    style={{
                        left: Math.min(marquee.x1, marquee.x2),
                        top: Math.min(marquee.y1, marquee.y2),
                        width: Math.abs(marquee.x2 - marquee.x1),
                        height: Math.abs(marquee.y2 - marquee.y1),
                    }}
                />
            )}

            {/* Spot markers sit above humbugs but never block interaction */}
            <div className='spot-markers' aria-hidden='true'>
                {spots.map((spot) => {
                    const screen = worldToScreen(spot.x, spot.y)
                    return (
                        <div
                            key={spot.id}
                            className='spot-marker'
                            style={{ left: screen.x, top: screen.y }}
                        >
                            <Icon name='flag' size={26} className='jicon-play' />
                            <span className='spot-marker-label'>
                                {spot.name}
                            </span>
                        </div>
                    )
                })}
            </div>

            <div className='viewport-info'>
                <div>Zoom: {(viewport.zoom * 100).toFixed(0)}%</div>
                <div>
                    Position: ({viewport.x.toFixed(0)}, {viewport.y.toFixed(0)})
                </div>
                {isShiftHeld && (
                    <div style={{ color: "#0066cc", fontWeight: "bold" }}>
                        Pan Mode (Shift)
                    </div>
                )}
            </div>
        </div>
    )
}
