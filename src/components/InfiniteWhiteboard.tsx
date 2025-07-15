import React, { useRef, useEffect, useState, useCallback } from "react"
import type { Point, Humbug } from "../types/humbug.types"
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
  showGridLines?: boolean;
  showDragTails?: boolean;
}

export const InfiniteWhiteboard: React.FC<InfiniteWhiteboardProps> = ({ 
  showGridLines = true,
  showDragTails = true
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const humbugManagerRef = useRef<any>(null) // Will hold reference to HumbugManager's methods
    const [viewport, setViewport] = useState<ViewPort>({ x: 0, y: 0, zoom: 1 })
    const [isDragging, setIsDragging] = useState(false)
    const [lastMousePos, setLastMousePos] = useState<Point>({ x: 0, y: 0 })
    const [contextMenuEvent, setContextMenuEvent] = useState<React.MouseEvent | null>(null)
    const [isShiftHeld, setIsShiftHeld] = useState(false)

    // Convert screen coordinates to world coordinates
    const screenToWorld = useCallback(
        (screenX: number, screenY: number): Point => {
            const canvas = canvasRef.current
            if (!canvas) return { x: 0, y: 0 }

            const rect = canvas.getBoundingClientRect()
            const canvasX = screenX - rect.left
            const canvasY = screenY - rect.top

            return {
                x: (canvasX - canvas.width / 2) / viewport.zoom - viewport.x,
                y: (canvasY - canvas.height / 2) / viewport.zoom - viewport.y,
            }
        },
        [viewport]
    )

    // Convert world coordinates to screen coordinates
    const worldToScreen = useCallback(
        (worldX: number, worldY: number): Point => {
            const canvas = canvasRef.current
            if (!canvas) return { x: 0, y: 0 }

            return {
                x: (worldX + viewport.x) * viewport.zoom + canvas.width / 2,
                y: (worldY + viewport.y) * viewport.zoom + canvas.height / 2,
            }
        },
        [viewport]
    )

    // Draw the grid
    const drawGrid = useCallback(
        (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
            const { width, height } = canvas

            // Clear canvas
            ctx.clearRect(0, 0, width, height)

            if (!showGridLines) return;

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
        [viewport, screenToWorld, worldToScreen, showGridLines]
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
        [viewport]
    )

    // Handle mouse down
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Only start panning if shift key is held or if clicking on empty space
        // (humbugs will stopPropagation if shift is not held)
        setIsDragging(true)
        setLastMousePos({ x: e.clientX, y: e.clientY })
    }, [])

    // Handle mouse move
    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
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
        [isDragging, lastMousePos]
    )

    // Handle mouse up
    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    // Handle right-click - delegate to HumbugManager
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setContextMenuEvent(e)
        // Clear the event after a short delay to allow the HumbugManager to process it
        setTimeout(() => setContextMenuEvent(null), 100)
    }, [])

    // Resize canvas to match container
    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) return

        const rect = container.getBoundingClientRect()
        canvas.width = rect.width
        canvas.height = rect.height
        render()
    }, [render])

    // Set up event listeners and resize handling
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        canvas.addEventListener("wheel", handleWheel, { passive: false })
        window.addEventListener("resize", resizeCanvas)

        // Initial resize
        resizeCanvas()

        return () => {
            canvas.removeEventListener("wheel", handleWheel)
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
                const windowGlobal = window as unknown as { exportHumbugData?: () => void };
                windowGlobal.exportHumbugData?.();
            }
        };

        const handleImport = async (event: Event) => {
            const customEvent = event as CustomEvent<File>;
            const file = customEvent.detail;
            const boardData = await importBoardFromPNG(file);
            
            if (boardData) {
                const windowGlobal = window as unknown as { importHumbugData?: (humbugs: unknown[]) => void };
                windowGlobal.importHumbugData?.(boardData.humbugs);
                
                // Restore viewport
                setViewport(boardData.viewport);
            }
        };

        window.addEventListener('exportBoard', handleExport);
        window.addEventListener('importBoard', handleImport);

        return () => {
            window.removeEventListener('exportBoard', handleExport);
            window.removeEventListener('importBoard', handleImport);
        };
    }, [viewport]);

    // Callback to handle export request from HumbugManager
    const handleExportRequest = useCallback(async (humbugs: Humbug[], currentViewport: { x: number; y: number; zoom: number }) => {
        if (containerRef.current) {
            await exportBoardAsPNG(containerRef.current, humbugs, viewport);
        }
    }, [viewport]);

    // Callback to handle import completion
    const handleImportRequest = useCallback((humbugs: Humbug[]) => {
        console.log(`Imported ${humbugs.length} humbugs successfully`);
    }, []);

    // Track shift key state for panning
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftHeld(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftHeld(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    return (
        <div 
            className={`infinite-whiteboard-container ${isShiftHeld ? 'shift-pan-mode' : ''}`} 
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
                worldToScreen={worldToScreen}
                contextMenuEvent={contextMenuEvent}
                showDragTails={showDragTails}
                onExportRequest={handleExportRequest}
                onImportRequest={handleImportRequest}
            />
            
            <div className='viewport-info'>
                <div>Zoom: {(viewport.zoom * 100).toFixed(0)}%</div>
                <div>
                    Position: ({viewport.x.toFixed(0)}, {viewport.y.toFixed(0)})
                </div>
            </div>
        </div>
    )
}
