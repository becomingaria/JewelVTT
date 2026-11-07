import React, { useState, useRef } from "react"
import type { Humbug, Point } from "../types/humbug.types"
import { Icon } from "./Icon"
import { pinSize } from "../utils/humbug.utils"
import { IDENTITY, type Projection } from "../utils/projection"
import { isStandee, placeHumbug } from "../utils/humbug-geometry"

const normalizeDeg = (d: number) => ((d % 360) + 360) % 360

/**
 * Pull the angle onto 90° points (±7°) and 45° points (±5°). Works on the
 * continuous (unwrapped) angle, so 359° snaps forward to 360°, not back to 0°.
 */
function softSnap(deg: number): { deg: number; snapped: boolean } {
    for (const [step, tolerance] of [
        [90, 7],
        [45, 5],
    ]) {
        const nearest = Math.round(deg / step) * step
        if (Math.abs(deg - nearest) <= tolerance) {
            return { deg: nearest, snapped: true }
        }
    }
    return { deg, snapped: false }
}
import { DocumentCard } from "./DocumentCard"
import "./HumbugRenderer.css"

interface HumbugRendererProps {
    humbug: Humbug
    isSelected: boolean
    /** Part of a marquee (area) selection */
    isMultiSelected?: boolean
    isDragging?: boolean
    onSelect: (id: string) => void
    onMove: (id: string, newPosition: Point) => void
    /** Live update while dragging; pass `commitFrom` on release to record undo */
    onRotate: (id: string, rotation: number, commitFrom?: number) => void
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
    /** Board-container pixel -> world (inverse camera projection) */
    containerToWorld: (containerX: number, containerY: number) => Point
    /** Camera tilt; identity in 2D */
    projection?: Projection
    /** 0 in 2D, 1 in 2.5D: how far non-map humbugs have stood up */
    standUp?: number
    containerRef: React.RefObject<HTMLDivElement | null>
    snapToGridEnabled?: boolean
    isShiftHeld?: boolean
}

export const HumbugRenderer: React.FC<HumbugRendererProps> = ({
    humbug,
    isSelected,
    isMultiSelected = false,
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
    containerToWorld,
    projection = IDENTITY,
    standUp = 0,
    containerRef,
    snapToGridEnabled = false,
    isShiftHeld = false,
}) => {
    /** Mouse event -> world point (through the camera projection) */
    const pointerWorld = (e: { clientX: number; clientY: number }) => {
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return { x: 0, y: 0 }
        return containerToWorld(e.clientX - rect.left, e.clientY - rect.top)
    }

    /** Footprint of the humbug in world units */
    const worldSize = () =>
        humbug.type === "map-pin"
            ? { width: pinSize(humbug), height: pinSize(humbug) }
            : "size" in humbug
            ? humbug.size
            : { width: 100, height: 100 }

    const [interactionMode, setInteractionMode] = useState<
        "none" | "dragging" | "rotating" | "resizing"
    >("none")
    // Angle readout shown while the rotation pin is dragged
    const [liveRotation, setLiveRotation] = useState<{
        deg: number
        snapped: boolean
    } | null>(null)
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

        // Offset from the humbug's corner to the grabbed point, in world
        // units, so dragging stays under the cursor in 2D and 2.5D
        const pointer = pointerWorld(e)
        const offset = {
            x: pointer.x - humbug.position.x,
            y: pointer.y - humbug.position.y,
        }

        // Start dragging
        onStartDrag(humbug.id, offset)
    }

    // Rotation pin: drag around the centre. Soft-snaps to 90° and 45°
    // points (hold Alt for free rotation); one undo step per drag.
    const handleRotateMouseDown = (e: React.MouseEvent) => {
        // If shift key is held, allow event to bubble up for panning
        if (e.shiftKey) {
            return
        }

        e.stopPropagation()
        e.preventDefault()

        if (humbug.locked) return

        setInteractionMode("rotating")
        initialRotation.current = humbug.rotation

        // Centre of the humbug on the board (world units)
        const box = worldSize()
        rotationCenter.current = {
            x: humbug.position.x + box.width / 2,
            y: humbug.position.y + box.height / 2,
        }
        const angleTo = (ev: { clientX: number; clientY: number }) => {
            const p = pointerWorld(ev)
            return (Math.atan2(p.y - rotationCenter.current.y, p.x - rotationCenter.current.x) * 180) / Math.PI
        }
        // Accumulate the pointer's turning so the angle stays continuous:
        // crossing 359° -> 360° keeps going instead of jumping back to 0°
        // (which would make the element spin backwards the long way).
        let prevAngle = angleTo(e)
        let turned = 0
        let current = humbug.rotation
        setLiveRotation({ deg: normalizeDeg(current), snapped: false })

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const a = angleTo(moveEvent)
            let d = a - prevAngle
            if (d > 180) d -= 360
            if (d < -180) d += 360
            turned += d
            prevAngle = a
            const raw = initialRotation.current + turned
            const r = moveEvent.altKey ? { deg: raw, snapped: false } : softSnap(raw)
            current = r.deg
            setLiveRotation({ deg: normalizeDeg(r.deg), snapped: r.snapped })
            onRotate(humbug.id, current)
        }

        const handleMouseUp = () => {
            setInteractionMode("none")
            setLiveRotation(null)
            // Commit once, recording the whole drag as a single undo step
            onRotate(humbug.id, current, initialRotation.current)
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

        // Resize in world units so handles track the cursor at any angle
        const start = pointerWorld(e)

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const now = pointerWorld(moveEvent)
            const deltaX = now.x - start.x
            const deltaY = now.y - start.y

            let newWidth = initialSize.current.width
            let newHeight = initialSize.current.height

            switch (handle) {
                case "e":
                    newWidth = Math.max(
                        20,
                        initialSize.current.width + deltaX
                    )
                    break
                case "w":
                    newWidth = Math.max(
                        20,
                        initialSize.current.width - deltaX
                    )
                    break
                case "s":
                    newHeight = Math.max(
                        20,
                        initialSize.current.height + deltaY
                    )
                    break
                case "n":
                    newHeight = Math.max(
                        20,
                        initialSize.current.height - deltaY
                    )
                    break
                case "se":
                    newWidth = Math.max(
                        20,
                        initialSize.current.width + deltaX
                    )
                    newHeight = Math.max(
                        20,
                        initialSize.current.height + deltaY
                    )
                    break
                case "sw":
                    newWidth = Math.max(
                        20,
                        initialSize.current.width - deltaX
                    )
                    newHeight = Math.max(
                        20,
                        initialSize.current.height + deltaY
                    )
                    break
                case "ne":
                    newWidth = Math.max(
                        20,
                        initialSize.current.width + deltaX
                    )
                    newHeight = Math.max(
                        20,
                        initialSize.current.height - deltaY
                    )
                    break
                case "nw":
                    newWidth = Math.max(
                        20,
                        initialSize.current.width - deltaX
                    )
                    newHeight = Math.max(
                        20,
                        initialSize.current.height - deltaY
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

    // Flat on the (possibly tilted) board, or standing up as a 2.5D standee;
    // the same geometry drives connector anchors (utils/humbug-geometry.ts)
    const standee = isStandee(humbug, standUp)
    const geometry = placeHumbug(humbug, {
        scale,
        standUp,
        projection,
        worldToScreen,
        containerWidth: containerRef.current?.clientWidth ?? 0,
    })
    const placement: React.CSSProperties = {
        left: geometry.left,
        top: geometry.top,
        transform: geometry.transform,
        transformOrigin: geometry.transformOrigin,
        zIndex: geometry.zIndex,
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
                            color: "#333",
                        }}
                    >
                        <Icon
                            name='pin'
                            size={pinSize(humbug) * scale}
                            style={
                                {
                                    "--ji-accent": humbug.color,
                                } as React.CSSProperties
                            }
                        />
                        {humbug.label && (
                            <span
                                className='map-pin-label'
                                style={{ fontSize: pinSize(humbug) * 0.6 * scale }}
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

            case "document":
                return <DocumentCard humbug={humbug} scale={scale} />

            default:
                return null
        }
    }

    return (
        <div
            ref={elementRef}
            className={`humbug-renderer humbug-element ${
                isSelected ? "selected" : ""
            } ${isMultiSelected ? "multi-selected" : ""} ${standee ? "standee" : ""} ${humbug.locked ? "locked" : ""} ${
                isDragging ? "dragging" : ""
            } ${interactionMode === "rotating" ? "rotating" : ""} ${
                interactionMode === "resizing" ? "resizing" : ""
            } ${isShiftHeld ? "shift-disabled" : ""} ${
                humbug.type === "map-pin" ? "jicon-host" : ""
            }`}
            style={{
                position: "absolute",
                ...placement,
                opacity: humbug.opacity,
                pointerEvents: isShiftHeld ? "none" : "auto",
            }}
            data-humbug-id={humbug.id}
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

                    <div
                        className='rotate-pin'
                        onMouseDown={handleRotateMouseDown}
                        title='Drag to rotate (snaps to 45° and 90°; hold Alt for free rotation)'
                    >
                        <span className='rotate-pin-stem' />
                        <span className='rotate-pin-knob'>
                            <Icon name='rotate' size={12} />
                        </span>
                    </div>
                    <button
                        className='delete-handle'
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete(humbug.id)
                        }}
                        title='Delete'
                    >
                        <Icon name='close' size={13} />
                    </button>
                </div>
            )}

            {/* Live rotation readout, kept upright */}
            {liveRotation && (
                <div
                    className={`rotate-readout ${liveRotation.snapped ? "snapped" : ""}`}
                    style={{ transform: `translate(-50%, -50%) rotate(${-humbug.rotation}deg)` }}
                >
                    <strong>{Math.round(liveRotation.deg)}°</strong>
                    <span>{Math.round((liveRotation.deg / 360) * 100)}%</span>
                </div>
            )}

            {/* Lock indicator */}
            {humbug.locked && (
                <div
                    className='lock-indicator'
                    onContextMenu={(e) => onContextMenu(e, humbug.id)}
                    title='Right-click to unlock'
                >
                    <Icon name='lock' size={13} />
                </div>
            )}
        </div>
    )
}
