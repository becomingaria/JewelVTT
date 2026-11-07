import React, { useRef, useEffect, useState, useCallback, useMemo } from "react"
import type { Point, Humbug } from "../types/humbug.types"
import type { PaintTool } from "./Apron"
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
import { getBoardStyle, type BoardStyleId } from "../utils/board-styles"
import { useBoardSlice } from "../utils/board-store"
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
        const toWorld = (p: { x: number; y: number }) => {
            const v = viewportRef.current
            return {
                x: (p.x - container.clientWidth / 2) / v.zoom - v.x,
                y: (p.y - container.clientHeight / 2) / v.zoom - v.y,
            }
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
            const a = toWorld(start)
            const b = toWorld(p)
            const detail: AreaSelectDetail = {
                x1: Math.min(a.x, b.x),
                y1: Math.min(a.y, b.y),
                x2: Math.max(a.x, b.x),
                y2: Math.max(a.y, b.y),
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

            return {
                x:
                    (containerX - container.clientWidth / 2) / viewport.zoom -
                    viewport.x,
                y:
                    (containerY - container.clientHeight / 2) / viewport.zoom -
                    viewport.y,
            }
        },
        [viewport]
    )

    // Convert container-relative coordinates to world coordinates
    const containerToWorld = useCallback(
        (containerX: number, containerY: number): Point => {
            const container = containerRef.current
            if (!container) return { x: 0, y: 0 }

            return {
                x:
                    (containerX - container.clientWidth / 2) / viewport.zoom -
                    viewport.x,
                y:
                    (containerY - container.clientHeight / 2) / viewport.zoom -
                    viewport.y,
            }
        },
        [viewport]
    )

    // Convert world coordinates to screen coordinates
    const worldToScreen = useCallback(
        (worldX: number, worldY: number): Point => {
            const container = containerRef.current
            if (!container) return { x: 0, y: 0 }

            return {
                x:
                    (worldX + viewport.x) * viewport.zoom +
                    container.clientWidth / 2,
                y:
                    (worldY + viewport.y) * viewport.zoom +
                    container.clientHeight / 2,
            }
        },
        [viewport]
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

                if (forceErase || activePaintTool === "eraser") {
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

    // Draw the grid
    const drawGrid = useCallback(
        (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
            const { width, height } = canvas

            // Board base colour
            ctx.fillStyle = style.base
            ctx.fillRect(0, 0, width, height)

            // Draw background texture if present
            if (textureImage) {
                const img = textureImage
                const baseTextureSize = 320 // Base 320x320 pixel texture tiles
                const scaledTextureSize = baseTextureSize * textureScale
                ctx.imageSmoothingEnabled = !texturePixelated

                // Calculate visible texture range (canvas coords are
                // container-relative)
                const topLeft = containerToWorld(0, 0)
                const bottomRight = containerToWorld(width, height)

                const startTileX = Math.floor(topLeft.x / scaledTextureSize)
                const endTileX = Math.ceil(
                    bottomRight.x / scaledTextureSize
                )
                const startTileY = Math.floor(topLeft.y / scaledTextureSize)
                const endTileY = Math.ceil(
                    bottomRight.y / scaledTextureSize
                )

                // Draw texture tiles
                for (let tileX = startTileX; tileX <= endTileX; tileX++) {
                    for (
                        let tileY = startTileY;
                        tileY <= endTileY;
                        tileY++
                    ) {
                        const worldX = tileX * scaledTextureSize
                        const worldY = tileY * scaledTextureSize
                        const screenPos = worldToScreen(worldX, worldY)
                        const nextPos = worldToScreen(
                            worldX + scaledTextureSize,
                            worldY + scaledTextureSize
                        )

                        // Snap to whole pixels so tiles never show seams
                        const x = Math.floor(screenPos.x)
                        const y = Math.floor(screenPos.y)
                        ctx.drawImage(
                            img,
                            x,
                            y,
                            Math.floor(nextPos.x) - x,
                            Math.floor(nextPos.y) - y
                        )
                    }
                }
            }

            ctx.imageSmoothingEnabled = true

            // Draw painted grid squares
            if (paintGrid.size > 0) {
                const topLeft = containerToWorld(0, 0)
                const bottomRight = containerToWorld(width, height)

                const startGridX = Math.floor(topLeft.x / GRID_SIZE)
                const endGridX = Math.ceil(bottomRight.x / GRID_SIZE)
                const startGridY = Math.floor(topLeft.y / GRID_SIZE)
                const endGridY = Math.ceil(bottomRight.y / GRID_SIZE)

                for (let gridX = startGridX; gridX <= endGridX; gridX++) {
                    for (let gridY = startGridY; gridY <= endGridY; gridY++) {
                        const key = `${gridX},${gridY}`
                        const color = paintGrid.get(key)

                        if (color) {
                            const worldX = gridX * GRID_SIZE
                            const worldY = gridY * GRID_SIZE
                            const screenPos = worldToScreen(worldX, worldY)
                            const screenSize = GRID_SIZE * viewport.zoom

                            ctx.fillStyle = color
                            ctx.fillRect(
                                screenPos.x,
                                screenPos.y,
                                screenSize,
                                screenSize
                            )
                        }
                    }
                }
            }

            if (!showGridLines) return

            // Calculate visible grid range
            const topLeft = containerToWorld(0, 0)
            const bottomRight = containerToWorld(width, height)

            const startX = Math.floor(topLeft.x / GRID_SIZE) * GRID_SIZE
            const endX = Math.ceil(bottomRight.x / GRID_SIZE) * GRID_SIZE
            const startY = Math.floor(topLeft.y / GRID_SIZE) * GRID_SIZE
            const endY = Math.ceil(bottomRight.y / GRID_SIZE) * GRID_SIZE

            // Set grid style
            ctx.strokeStyle = viewport.zoom > 0.5 ? style.grid : style.gridFar
            ctx.lineWidth = 1

            // Draw vertical lines
            for (let x = startX; x <= endX; x += GRID_SIZE) {
                const screenPos = worldToScreen(x, 0)
                ctx.beginPath()
                ctx.moveTo(screenPos.x, 0)
                ctx.lineTo(screenPos.x, height)
                ctx.stroke()
            }

            // Draw horizontal lines
            for (let y = startY; y <= endY; y += GRID_SIZE) {
                const screenPos = worldToScreen(0, y)
                ctx.beginPath()
                ctx.moveTo(0, screenPos.y)
                ctx.lineTo(width, screenPos.y)
                ctx.stroke()
            }

            // Draw coordinate axes
            const origin = worldToScreen(0, 0)
            ctx.strokeStyle = "#ff0000"
            ctx.lineWidth = 2

            // X-axis
            ctx.beginPath()
            ctx.moveTo(0, origin.y)
            ctx.lineTo(width, origin.y)
            ctx.stroke()

            // Y-axis
            ctx.beginPath()
            ctx.moveTo(origin.x, 0)
            ctx.lineTo(origin.x, height)
            ctx.stroke()

            // Draw origin marker
            ctx.fillStyle = "#ff0000"
            ctx.beginPath()
            ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2)
            ctx.fill()
        },
        [
            viewport,
            containerToWorld,
            worldToScreen,
            showGridLines,
            textureImage,
            texturePixelated,
            textureScale,
            paintGrid,
            style,
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

    // Handle mouse down
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
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
        [activePaintTool, paintGridSquare, startPaintStroke]
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

            const deltaX = e.clientX - lastMousePos.x
            const deltaY = e.clientY - lastMousePos.y

            setViewport((prev) => ({
                ...prev,
                x: prev.x + deltaX / prev.zoom,
                y: prev.y + deltaY / prev.zoom,
            }))

            setLastMousePos({ x: e.clientX, y: e.clientY })
        },
        [
            isDragging,
            lastMousePos,
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
            if (activePaintTool === "paint" || activePaintTool === "eraser") {
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

    // Listen for dump fill events
    useEffect(() => {
        const handleDumpFill = (event: CustomEvent) => {
            const { color } = event.detail

            // Record the current paint grid for undo
            const previousGrid = new Map(paintGrid)
            undoRedoManager?.addAction({
                type: "DUMP_FILL",
                timestamp: Date.now(),
                color: color,
                previousGrid: previousGrid,
            })

            setPaintGrid(new Map()) // Clear the grid first

            // Fill a reasonable area around the current viewport
            const container = containerRef.current
            if (!container) return

            const topLeft = screenToWorld(0, 0)
            const bottomRight = screenToWorld(
                container.clientWidth,
                container.clientHeight
            )

            // Expand the area a bit beyond viewport
            const padding = 10 // grid squares
            const startGridX = Math.floor(topLeft.x / GRID_SIZE) - padding
            const endGridX = Math.ceil(bottomRight.x / GRID_SIZE) + padding
            const startGridY = Math.floor(topLeft.y / GRID_SIZE) - padding
            const endGridY = Math.ceil(bottomRight.y / GRID_SIZE) + padding

            const newGrid = new Map<string, string>()
            for (let gridX = startGridX; gridX <= endGridX; gridX++) {
                for (let gridY = startGridY; gridY <= endGridY; gridY++) {
                    const key = `${gridX},${gridY}`
                    newGrid.set(key, color)
                }
            }
            setPaintGrid(newGrid)
        }

        window.addEventListener("dumpFill", handleDumpFill as EventListener)

        return () => {
            window.removeEventListener(
                "dumpFill",
                handleDumpFill as EventListener
            )
        }
    }, [screenToWorld, setPaintGrid, paintGrid, undoRedoManager])

    return (
        <div
            className={`infinite-whiteboard-container ${
                isShiftHeld ? "shift-pan-mode" : ""
            } ${activePaintTool === "paint" ? "paint-mode" : ""} ${
                activePaintTool === "eraser" ? "eraser-mode" : ""
            } ${
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
