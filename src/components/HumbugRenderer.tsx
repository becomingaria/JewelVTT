import React, { useState, useRef } from "react"
import type { Humbug, Point } from "../types/humbug.types"
import "./HumbugRenderer.css"

interface HumbugRendererProps {
    humbug: Humbug
    isSelected: boolean
    isDragging?: boolean
    onSelect: (id: string) => void
    onMove: (id: string, newPosition: Point) => void
    onRotate: (id: string, rotation: number) => void
    onResize: (
        id: string,
        newSize: { width: number; height: number },
        isComplete?: boolean
    ) => void
    onDelete: (id: string) => void
    onEdit: (id: string) => void
    onStartDrag: (id: string, offset: Point) => void
    onContextMenu: (e: React.MouseEvent, humbugId: string) => void
    scale: number
    worldToScreen: (worldX: number, worldY: number) => Point
    containerRef: React.RefObject<HTMLDivElement | null>
    snapToGridEnabled?: boolean
    isShiftHeld?: boolean
}

export const HumbugRenderer: React.FC<HumbugRendererProps> = ({
    humbug,
    isSelected,
    isDragging = false,
    onSelect,
    onRotate,
    onResize,
    onDelete,
    onEdit,
    onStartDrag,
    onContextMenu,
    scale,
    worldToScreen,
    containerRef,
    snapToGridEnabled = false,
    isShiftHeld = false,
}) => {
    const [interactionMode, setInteractionMode] = useState<
        "none" | "dragging" | "rotating" | "resizing"
    >("none")
    const [, setActiveResizeHandle] = useState<string | null>(null)
    const elementRef = useRef<HTMLDivElement>(null)
    const initialRotation = useRef<number>(0)
    const initialSize = useRef<{ width: number; height: number }>({
        width: 0,
        height: 0,
    })
    const currentResizeSize = useRef<{ width: number; height: number }>({
        width: 0,
        height: 0,
    })
    const rotationCenter = useRef<Point>({ x: 0, y: 0 })

    // Snap size to grid (32px grid)
    const snapSizeToGrid = (size: number): number => {
        if (!snapToGridEnabled) return size
        return Math.max(32, Math.round(size / 32) * 32)
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        // If shift key is held, allow event to bubble up for panning
        if (isShiftHeld) {
            return
        }

        // Locked humbugs are handled by CSS pointer-events: none
        // This handler should never be called for locked humbugs
        if (humbug.locked) {
            return
        }

        e.stopPropagation()
        onSelect(humbug.id)

        // Calculate offset from click position to humbug origin
        const container = containerRef.current
        if (!container) return

        const containerRect = container.getBoundingClientRect()

        // Get the humbug's screen position (relative to container)
        const humbugScreenPos = worldToScreen(
            humbug.position.x,
            humbug.position.y
        )

        // Convert client coordinates to container coordinates
        const containerX = e.clientX - containerRect.left
        const containerY = e.clientY - containerRect.top

        // Calculate offset from click position to humbug's top-left corner
        const offset = {
            x: containerX - humbugScreenPos.x,
            y: containerY - humbugScreenPos.y,
        }

        // Start dragging
        onStartDrag(humbug.id, offset)
    }

    const handleRotateMouseDown = (e: React.MouseEvent) => {
        // If shift key is held, allow event to bubble up for panning
        if (e.shiftKey) {
            return
        }

        e.stopPropagation()
        e.preventDefault()

        if (humbug.locked) return

        if (snapToGridEnabled) {
            // Snap to 90-degree increments when snap-to-grid is enabled
            const currentRotation = humbug.rotation
            const snapRotations = [0, 90, 180, 270]

            // Find the next rotation in the sequence
            let nextRotation = 90
            for (let i = 0; i < snapRotations.length; i++) {
                if (Math.abs(currentRotation - snapRotations[i]) < 45) {
                    nextRotation = snapRotations[(i + 1) % snapRotations.length]
                    break
                }
            }

            onRotate(humbug.id, nextRotation)
            return
        }

        // Original continuous rotation when snap-to-grid is disabled
        setInteractionMode("rotating")
        initialRotation.current = humbug.rotation

        const rect = elementRef.current?.getBoundingClientRect()
        if (rect) {
            rotationCenter.current = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
            }
        }

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - rotationCenter.current.x
            const dy = moveEvent.clientY - rotationCenter.current.y
            const angle = Math.atan2(dy, dx) * (180 / Math.PI)
            onRotate(humbug.id, angle)
        }

        const handleMouseUp = () => {
            setInteractionMode("none")
            document.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("mouseup", handleMouseUp)
        }

        document.addEventListener("mousemove", handleMouseMove)
        document.addEventListener("mouseup", handleMouseUp)
    }

    const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
        // If shift key is held, allow event to bubble up for panning
        if (e.shiftKey) {
            return
        }

        e.stopPropagation()
        e.preventDefault()

        if (humbug.locked) return

        setInteractionMode("resizing")
        setActiveResizeHandle(handle)
        initialSize.current =
            humbug.type === "map-pin"
                ? { width: 32, height: 40 }
                : "size" in humbug
                ? humbug.size
                : { width: 100, height: 100 }

        const startX = e.clientX
        const startY = e.clientY

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX
            const deltaY = moveEvent.clientY - startY

            let newWidth = initialSize.current.width
            let newHeight = initialSize.current.height

            switch (handle) {
                case "e":
                    newWidth = Math.max(
                        20,
                        initialSize.current.width + deltaX / scale
                    )
                    break
                case "w":
                    newWidth = Math.max(
                        20,
                        initialSize.current.width - deltaX / scale
                    )
                    break
                case "s":
                    newHeight = Math.max(
                        20,
                        initialSize.current.height + deltaY / scale
                    )
                    break
                case "n":
                    newHeight = Math.max(
                        20,
                        initialSize.current.height - deltaY / scale
                    )
                    break
                case "se":
                    newWidth = Math.max(
                        20,
                        initialSize.current.width + deltaX / scale
                    )
                    newHeight = Math.max(
                        20,
                        initialSize.current.height + deltaY / scale
                    )
                    break
                case "sw":
                    newWidth = Math.max(
                        20,
                        initialSize.current.width - deltaX / scale
                    )
                    newHeight = Math.max(
                        20,
                        initialSize.current.height + deltaY / scale
                    )
                    break
                case "ne":
                    newWidth = Math.max(
                        20,
                        initialSize.current.width + deltaX / scale
                    )
                    newHeight = Math.max(
                        20,
                        initialSize.current.height - deltaY / scale
                    )
                    break
                case "nw":
                    newWidth = Math.max(
                        20,
                        initialSize.current.width - deltaX / scale
                    )
                    newHeight = Math.max(
                        20,
                        initialSize.current.height - deltaY / scale
                    )
                    break
            }

            // Apply snap-to-grid if enabled
            newWidth = snapSizeToGrid(newWidth)
            newHeight = snapSizeToGrid(newHeight)

            // Update the humbug size in real-time during resize (no undo recording)
            onResize(humbug.id, { width: newWidth, height: newHeight })

            // Store the current size for the final undo action
            currentResizeSize.current = { width: newWidth, height: newHeight }
        }

        const handleMouseUp = () => {
            // Get the final size and call onResize with completion flag to record undo action
            onResize(humbug.id, currentResizeSize.current, true)

            setInteractionMode("none")
            setActiveResizeHandle(null)
            document.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("mouseup", handleMouseUp)
        }

        document.addEventListener("mousemove", handleMouseMove)
        document.addEventListener("mouseup", handleMouseUp)
    }

    const handleDoubleClick = () => {
        onEdit(humbug.id)
    }

    const renderHumbugContent = () => {
        switch (humbug.type) {
            case "text":
                return (
                    <div
                        className='humbug-text-content'
                        style={{
                            fontSize: humbug.fontSize * scale,
                            fontFamily: humbug.fontFamily,
                            color: humbug.color,
                            backgroundColor: humbug.backgroundColor,
                            width: humbug.size.width * scale,
                            height: humbug.size.height * scale,
                            textAlign: humbug.textAlign || "left",
                        }}
                    >
                        {humbug.content || "Double-click to edit"}
                    </div>
                )

            case "image":
                return (
                    <img
                        src={humbug.imageUrl}
                        alt='Humbug'
                        className='humbug-image-content'
                        draggable={false}
                        style={{
                            width: humbug.size.width * scale,
                            height: humbug.size.height * scale,
                        }}
                    />
                )

            case "map-pin":
                return (
                    <div
                        className='humbug-map-pin-content'
                        style={{
                            fontSize: humbug.size * scale,
                            color: humbug.color,
                        }}
                    >
                        📍
                        {humbug.label && (
                            <span
                                className='map-pin-label'
                                style={{ fontSize: humbug.size * 0.6 * scale }}
                            >
                                {humbug.label}
                            </span>
                        )}
                    </div>
                )

            case "solid-color":
                return (
                    <div
                        className='humbug-solid-color-content'
                        style={{
                            backgroundColor: humbug.color,
                            width: humbug.size.width * scale,
                            height: humbug.size.height * scale,
                        }}
                    />
                )

            case "map":
                return (
                    <div
                        className='humbug-map-content'
                        style={{
                            width: humbug.size.width * scale,
                            height: humbug.size.height * scale,
                            position: "relative",
                        }}
                    >
                        <img
                            src={humbug.imageUrl}
                            alt='Map'
                            className='humbug-map-image'
                            draggable={false}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                            }}
                        />
                        {humbug.showGrid && (
                            <div
                                className='humbug-map-grid'
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundImage: `
                                        linear-gradient(rgba(0,0,0,0.2) 1px, transparent 1px),
                                        linear-gradient(90deg, rgba(0,0,0,0.2) 1px, transparent 1px)
                                    `,
                                    backgroundSize: `${32 * scale}px ${
                                        32 * scale
                                    }px`,
                                    pointerEvents: "none",
                                }}
                            />
                        )}
                    </div>
                )

            case "token":
                return (
                    <div
                        className='humbug-token-content'
                        style={{
                            width: humbug.size.width * scale,
                            height: humbug.size.height * scale,
                            borderRadius: "50%",
                            border: `${humbug.borderWidth * scale}px solid ${
                                humbug.borderColor
                            }`,
                            overflow: "hidden",
                            position: "relative",
                        }}
                    >
                        <img
                            src={humbug.imageUrl}
                            alt='Token'
                            className='humbug-token-image'
                            draggable={false}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                borderRadius: "50%",
                            }}
                        />
                    </div>
                )

            default:
                return null
        }
    }

    return (
        <div
            ref={elementRef}
            className={`humbug-renderer humbug-element ${
                isSelected ? "selected" : ""
            } ${humbug.locked ? "locked" : ""} ${
                isDragging ? "dragging" : ""
            } ${interactionMode === "rotating" ? "rotating" : ""} ${
                interactionMode === "resizing" ? "resizing" : ""
            } ${isShiftHeld ? "shift-disabled" : ""}`}
            style={{
                position: "absolute",
                left: worldToScreen(humbug.position.x, humbug.position.y).x,
                top: worldToScreen(humbug.position.x, humbug.position.y).y,
                transform: `rotate(${humbug.rotation}deg)`,
                zIndex: humbug.zIndex,
                opacity: humbug.opacity,
                pointerEvents: isShiftHeld ? "none" : "auto",
            }}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            onContextMenu={(e) => onContextMenu(e, humbug.id)}
        >
            {renderHumbugContent()}

            {/* Selection handles */}
            {isSelected && !humbug.locked && (
                <div className='humbug-handles'>
                    <div className='selection-outline' />

                    {/* Resize handles - only for resizable humbugs */}
                    {humbug.type !== "map-pin" && (
                        <>
                            {/* Corner handles */}
                            <div
                                className='resize-handle corner-handle nw-handle'
                                onMouseDown={(e) =>
                                    handleResizeMouseDown(e, "nw")
                                }
                                title='Resize'
                            />
                            <div
                                className='resize-handle corner-handle ne-handle'
                                onMouseDown={(e) =>
                                    handleResizeMouseDown(e, "ne")
                                }
                                title='Resize'
                            />
                            <div
                                className='resize-handle corner-handle sw-handle'
                                onMouseDown={(e) =>
                                    handleResizeMouseDown(e, "sw")
                                }
                                title='Resize'
                            />
                            <div
                                className='resize-handle corner-handle se-handle'
                                onMouseDown={(e) =>
                                    handleResizeMouseDown(e, "se")
                                }
                                title='Resize'
                            />

                            {/* Edge handles */}
                            <div
                                className='resize-handle edge-handle n-handle'
                                onMouseDown={(e) =>
                                    handleResizeMouseDown(e, "n")
                                }
                                title='Resize'
                            />
                            <div
                                className='resize-handle edge-handle s-handle'
                                onMouseDown={(e) =>
                                    handleResizeMouseDown(e, "s")
                                }
                                title='Resize'
                            />
                            <div
                                className='resize-handle edge-handle e-handle'
                                onMouseDown={(e) =>
                                    handleResizeMouseDown(e, "e")
                                }
                                title='Resize'
                            />
                            <div
                                className='resize-handle edge-handle w-handle'
                                onMouseDown={(e) =>
                                    handleResizeMouseDown(e, "w")
                                }
                                title='Resize'
                            />
                        </>
                    )}

                    <button
                        className={`rotate-handle ${
                            snapToGridEnabled ? "snap-rotate" : ""
                        }`}
                        onMouseDown={handleRotateMouseDown}
                        title={
                            snapToGridEnabled
                                ? "Click to rotate 90°"
                                : "Drag to rotate"
                        }
                    >
                        {snapToGridEnabled ? "↻" : "🔄"}
                    </button>
                    <button
                        className='delete-handle'
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete(humbug.id)
                        }}
                        title='Delete'
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Lock indicator */}
            {humbug.locked && (
                <div
                    className='lock-indicator'
                    onContextMenu={(e) => onContextMenu(e, humbug.id)}
                    title='Right-click to unlock'
                >
                    🔒
                </div>
            )}
        </div>
    )
}
