import React, { useRef, useEffect, useState, useCallback } from "react"
import type { Point, Humbug } from "../types/humbug.types"
import type { PaintTool } from "./Apron"
import { HumbugManager } from "./HumbugManager"
import { exportBoardAsPNG, importBoardFromPNG } from "../utils/export.utils"
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
}

export const InfiniteWhiteboard: React.FC<InfiniteWhiteboardProps> = ({
    showGridLines = true,
    showDragTails = true,
    backgroundTexture = null,
    textureScale = 1.0,
    activePaintTool = null,
    selectedColor = "#3498db",
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [viewport, setViewport] = useState<ViewPort>({ x: 0, y: 0, zoom: 1 })
    const [isDragging, setIsDragging] = useState(false)
    const [lastMousePos, setLastMousePos] = useState<Point>({ x: 0, y: 0 })
    const [contextMenuEvent, setContextMenuEvent] =
        useState<React.MouseEvent | null>(null)
    const [isShiftHeld, setIsShiftHeld] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [paintGrid, setPaintGrid] = useState<Map<string, string>>(new Map())
    const [isPaintDragging, setIsPaintDragging] = useState(false)

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

    // Helper function to paint/erase a grid square
    const paintGridSquare = useCallback(
        (e: React.MouseEvent, forceErase?: boolean) => {
            if (
                !activePaintTool ||
                (activePaintTool !== "paint" && activePaintTool !== "eraser")
            )
                return

            const worldPos = screenToWorld(e.clientX, e.clientY)
            const gridX = Math.floor(worldPos.x / GRID_SIZE)
            const gridY = Math.floor(worldPos.y / GRID_SIZE)
            const key = `${gridX},${gridY}`

            setPaintGrid((prev) => {
                const newGrid = new Map(prev)
                // If forceErase is true (right-click), always erase
                // Otherwise use the active tool
                if (forceErase || activePaintTool === "eraser") {
                    newGrid.delete(key)
                } else if (activePaintTool === "paint") {
                    newGrid.set(key, selectedColor)
                }
                return newGrid
            })
        },
        [activePaintTool, selectedColor, screenToWorld]
    )

    // Draw the grid
    const drawGrid = useCallback(
        (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
            const { width, height } = canvas

            // Clear canvas
            ctx.clearRect(0, 0, width, height)

            // Draw background texture if present
            if (backgroundTexture) {
                const img = new Image()
                img.src = backgroundTexture

                // Only draw if image is loaded
                if (img.complete && img.naturalWidth > 0) {
                    const baseTextureSize = 320 // Base 320x320 pixel texture tiles
                    const scaledTextureSize = baseTextureSize * textureScale

                    // Calculate visible texture range
                    const topLeft = screenToWorld(0, 0)
                    const bottomRight = screenToWorld(width, height)

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

                            const tileScreenSize =
                                scaledTextureSize * viewport.zoom

                            ctx.drawImage(
                                img,
                                screenPos.x,
                                screenPos.y,
                                tileScreenSize,
                                tileScreenSize
                            )
                        }
                    }
                }
            }

            // Draw painted grid squares
            if (paintGrid.size > 0) {
                const topLeft = screenToWorld(0, 0)
                const bottomRight = screenToWorld(width, height)

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
            const topLeft = screenToWorld(0, 0)
            const bottomRight = screenToWorld(width, height)

            const startX = Math.floor(topLeft.x / GRID_SIZE) * GRID_SIZE
            const endX = Math.ceil(bottomRight.x / GRID_SIZE) * GRID_SIZE
            const startY = Math.floor(topLeft.y / GRID_SIZE) * GRID_SIZE
            const endY = Math.ceil(bottomRight.y / GRID_SIZE) * GRID_SIZE

            // Set grid style
            ctx.strokeStyle = viewport.zoom > 0.5 ? "#e0e0e0" : "#f0f0f0"
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
            screenToWorld,
            worldToScreen,
            showGridLines,
            backgroundTexture,
            textureScale,
            paintGrid,
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
                setIsPaintDragging(true)
                // Right-click with paint tool should erase
                const isRightClick = e.button === 2
                paintGridSquare(e, isRightClick && activePaintTool === "paint")
                return
            }

            // Only start panning if shift key is held or if clicking on empty space
            // (humbugs will stopPropagation if shift is not held)
            setIsDragging(true)
            setLastMousePos({ x: e.clientX, y: e.clientY })
        },
        [activePaintTool, paintGridSquare]
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
                paintGridSquare(e, isRightClick && activePaintTool === "paint")
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
        setIsPaintDragging(false)
    }, [])

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
    }, [viewport])

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
    }, [screenToWorld, setPaintGrid])

    return (
        <div
            className={`infinite-whiteboard-container ${
                isShiftHeld ? "shift-pan-mode" : ""
            } ${activePaintTool === "paint" ? "paint-mode" : ""} ${
                activePaintTool === "eraser" ? "eraser-mode" : ""
            }`}
            ref={containerRef}
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
                screenToWorld={screenToWorld}
                containerToWorld={containerToWorld}
                worldToScreen={worldToScreen}
                contextMenuEvent={contextMenuEvent}
                showDragTails={showDragTails}
                isShiftHeld={isShiftHeld}
                onExportRequest={handleExportRequest}
                onImportRequest={handleImportRequest}
                onModalStateChange={handleModalStateChange}
            />

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
