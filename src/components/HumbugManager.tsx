import React, { useState, useCallback, useRef, useEffect } from "react"
import type {
    HumbugType,
    Point,
    HumbugState,
    Humbug,
} from "../types/humbug.types"
import type { Action } from "../types/action.types"
import { ContextMenu } from "./ContextMenu"
import { HumbugRenderer } from "./HumbugRenderer"
import { HumbugModal } from "./HumbugModal"
import { HumbugContextMenu } from "./HumbugContextMenu"
import { DragTailRenderer } from "./DragTailRenderer"
import { snapToGrid, generateId } from "../utils/humbug.utils"
import { UndoRedoManager } from "../utils/undo-redo.utils"
import { ClipboardManager } from "../utils/clipboard.utils"
import {
    AREA_SELECT_EVENT,
    CREATE_AT_CURSOR_EVENT,
    DELETE_SELECTION_EVENT,
    SELECT_ALL_EVENT,
    type AreaSelectDetail,
    SPOT_AT_CURSOR_EVENT,
    goHome,
    requestAddSpot,
} from "../utils/view-events"
import { useBoardSlice } from "../utils/board-store"
import { ConnectorLayer } from "./ConnectorLayer"
import type { Connector, ConnectorEnd } from "../types/connector.types"

interface HumbugManagerProps {
    scale: number
    containerRef: React.RefObject<HTMLDivElement | null>
    containerToWorld: (containerX: number, containerY: number) => Point
    worldToScreen: (worldX: number, worldY: number) => Point
    contextMenuEvent?: React.MouseEvent | null
    showDragTails?: boolean
    isShiftHeld?: boolean
    onExportRequest?: (
        humbugs: Humbug[],
        viewport: { x: number; y: number; zoom: number }
    ) => void
    onImportRequest?: (humbugs: Humbug[]) => void
    onModalStateChange?: (isOpen: boolean) => void
    undoRedoManager?: UndoRedoManager
}

export const HumbugManager: React.FC<HumbugManagerProps> = ({
    scale,
    containerRef,
    containerToWorld,
    worldToScreen,
    contextMenuEvent,
    showDragTails = true,
    isShiftHeld = false,
    onExportRequest,
    onImportRequest,
    onModalStateChange,
    undoRedoManager: externalUndoRedoManager,
}) => {
    const [state, setState] = useState<HumbugState>({
        humbugs: [],
        selectedHumbugId: null,
        dragTail: null,
        contextMenu: {
            isOpen: false,
            position: { x: 0, y: 0 },
        },
        humbugContextMenu: {
            isOpen: false,
            position: { x: 0, y: 0 },
            humbugId: null,
        },
    })

    // Persist humbugs with the board (save files + autosave)
    useBoardSlice("humbugs", state.humbugs, (humbugs) =>
        setState((prev) => ({
            ...prev,
            humbugs: humbugs ?? [],
            selectedHumbugId: null,
        }))
    )

    // Area (marquee) selection: several humbugs that move/delete/copy together
    const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([])
    // Start positions of the group while it's being dragged
    const groupDragRef = useRef<Map<string, Point> | null>(null)

    const [isDragging, setIsDragging] = useState(false)
    const draggedHumbugRef = useRef<string | null>(null)
    const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 })
    const initialDragPositionRef = useRef<Point>({ x: 0, y: 0 })
    const isResizingRef = useRef<string | null>(null) // Track which humbug is being resized
    const initialResizeSizeRef = useRef<{ width: number; height: number }>({
        width: 0,
        height: 0,
    })

    // Settings state
    const [snapToGridEnabled, setSnapToGridEnabled] = useState(true)

    // Modal state
    const [modalState, setModalState] = useState<{
        isOpen: boolean
        type: HumbugType | null
        position: Point
    }>({
        isOpen: false,
        type: null,
        position: { x: 0, y: 0 },
    })

    // Track which humbug is being edited (null means creating new)
    const [editingHumbugId, setEditingHumbugId] = useState<string | null>(null)

    // Notify parent when modal state changes
    useEffect(() => {
        onModalStateChange?.(modalState.isOpen)
    }, [modalState.isOpen, onModalStateChange])

    // Undo/Redo and Clipboard managers
    const localUndoRedoManager = useRef(new UndoRedoManager()).current
    const undoRedoManager = externalUndoRedoManager || localUndoRedoManager
    const clipboardManager = useRef(new ClipboardManager()).current

    // Flowchart connectors between humbug edges
    const [connectors, setConnectors] = useState<Connector[]>([])
    const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null)
    useBoardSlice("connectors", connectors, (c) => {
        setConnectors(c ?? [])
        setSelectedConnectorId(null)
    })

    const createConnector = useCallback(
        (from: ConnectorEnd, to: ConnectorEnd) => {
            const connector: Connector = {
                id: `conn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
                from,
                to,
            }
            setConnectors((prev) => {
                const dup = prev.some(
                    (c) =>
                        c.from.humbugId === from.humbugId &&
                        c.to.humbugId === to.humbugId &&
                        c.from.side === from.side &&
                        c.to.side === to.side
                )
                return dup ? prev : [...prev, connector]
            })
            undoRedoManager.addAction({
                type: "CONNECTOR_ADD",
                timestamp: Date.now(),
                connector,
            })
        },
        [undoRedoManager]
    )

    const deleteConnector = useCallback(
        (id: string) => {
            const connector = connectors.find((c) => c.id === id)
            if (!connector) return
            setConnectors((prev) => prev.filter((c) => c.id !== id))
            setSelectedConnectorId(null)
            undoRedoManager.addAction({
                type: "CONNECTOR_DELETE",
                timestamp: Date.now(),
                connector,
            })
        },
        [connectors, undoRedoManager]
    )

    // Handle right-click context menu
    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault()

            const rect = containerRef.current?.getBoundingClientRect()
            if (!rect) return

            setState((prev) => ({
                ...prev,
                contextMenu: {
                    isOpen: true,
                    position: {
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                    },
                },
            }))
        },
        [containerRef]
    )

    // Handle context menu from external event
    useEffect(() => {
        if (contextMenuEvent) {
            handleContextMenu(contextMenuEvent)
        }
    }, [contextMenuEvent, handleContextMenu])

    // Last pointer position (viewport coords), for hotkeys that act "at the cursor"
    const pointerRef = useRef<{ x: number; y: number } | null>(null)
    useEffect(() => {
        const track = (e: MouseEvent) => {
            pointerRef.current = { x: e.clientX, y: e.clientY }
        }
        window.addEventListener("mousemove", track)
        return () => window.removeEventListener("mousemove", track)
    }, [])

    /** Pointer in container coords, or the board centre if it's elsewhere */
    const pointerInContainer = useCallback((): Point => {
        const container = containerRef.current
        if (!container) return { x: 0, y: 0 }
        const rect = container.getBoundingClientRect()
        const p = pointerRef.current
        if (
            p &&
            p.x >= rect.left &&
            p.x <= rect.right &&
            p.y >= rect.top &&
            p.y <= rect.bottom
        ) {
            return { x: p.x - rect.left, y: p.y - rect.top }
        }
        return { x: rect.width / 2, y: rect.height / 2 }
    }, [containerRef])

    // Show modal for humbug creation
    const showHumbugModal = useCallback(
        (type: HumbugType, containerPosition: Point) => {
            // The context menu reports container-relative coordinates
            const worldPosition = containerToWorld(
                containerPosition.x,
                containerPosition.y
            )
            const finalPosition = snapToGridEnabled
                ? snapToGrid(worldPosition, 32)
                : worldPosition

            setModalState({
                isOpen: true,
                type,
                position: finalPosition,
            })

            // Reset editing state for new humbug creation
            setEditingHumbugId(null)

            // Close context menu
            setState((prev) => ({
                ...prev,
                contextMenu: { isOpen: false, position: { x: 0, y: 0 } },
            }))
        },
        [containerToWorld, snapToGridEnabled]
    )

    // Create new Humbug from modal data or update existing one
    const createHumbugFromModal = useCallback(
        (humbugData: Record<string, unknown>) => {
            setState((prev) => {
                if (editingHumbugId) {
                    // Update existing humbug
                    const oldHumbug = prev.humbugs.find(
                        (h) => h.id === editingHumbugId
                    )
                    const newHumbug = {
                        ...oldHumbug,
                        ...humbugData,
                        updatedAt: Date.now(),
                    } as Humbug

                    if (oldHumbug) {
                        // Record edit action for undo
                        undoRedoManager.addAction({
                            type: "EDIT_HUMBUG",
                            timestamp: Date.now(),
                            humbugId: editingHumbugId,
                            oldHumbug,
                            newHumbug,
                        })
                    }

                    return {
                        ...prev,
                        humbugs: prev.humbugs.map((humbug) =>
                            humbug.id === editingHumbugId ? newHumbug : humbug
                        ),
                    }
                } else {
                    // Create new humbug
                    const maxZ =
                        prev.humbugs.length > 0
                            ? Math.max(...prev.humbugs.map((h) => h.zIndex))
                            : 99

                    const baseHumbug = {
                        id: generateId(),
                        position: modalState.position,
                        rotation: 0,
                        locked: false,
                        zIndex: maxZ + 1,
                        opacity: humbugData.opacity || 1.0,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        type: modalState.type!,
                        ...humbugData,
                    } as Humbug

                    // Record creation for undo
                    undoRedoManager.addAction({
                        type: "CREATE_HUMBUG",
                        timestamp: Date.now(),
                        humbug: baseHumbug,
                    })

                    return {
                        ...prev,
                        humbugs: [...prev.humbugs, baseHumbug],
                        selectedHumbugId: baseHumbug.id,
                    }
                }
            })

            // Close modal and reset editing state
            setModalState({
                isOpen: false,
                type: null,
                position: { x: 0, y: 0 },
            })
            setEditingHumbugId(null)
        },
        [modalState.position, modalState.type, editingHumbugId, undoRedoManager]
    )

    // Toggle snap to grid
    const toggleSnapToGrid = useCallback(() => {
        setSnapToGridEnabled((prev) => !prev)
    }, [])

    // Close modal
    const closeModal = useCallback(() => {
        setModalState({
            isOpen: false,
            type: null,
            position: { x: 0, y: 0 },
        })
        setEditingHumbugId(null)

        // Notify parent about modal state change
        if (onModalStateChange) {
            onModalStateChange(false)
        }
    }, [onModalStateChange])

    // Start dragging a humbug
    const startDragging = useCallback(
        (id: string, offset: Point) => {
            setIsDragging(true)
            draggedHumbugRef.current = id
            setDragOffset(offset)

            // Dragging any member of the area selection drags the whole group
            groupDragRef.current =
                multiSelectedIds.length > 1 && multiSelectedIds.includes(id)
                    ? new Map(
                          state.humbugs
                              .filter((h) => multiSelectedIds.includes(h.id))
                              .map((h) => [h.id, { ...h.position }])
                      )
                    : null

            // Store initial position for undo
            const humbug = state.humbugs.find((h) => h.id === id)
            if (humbug) {
                initialDragPositionRef.current = { ...humbug.position }
            }

            // Create drag tail if enabled
            if (showDragTails) {
                const humbug = state.humbugs.find((h) => h.id === id)
                if (humbug) {
                    const centerPoint = {
                        x:
                            humbug.position.x +
                            (humbug.type === "map-pin"
                                ? 16
                                : "size" in humbug
                                ? humbug.size.width / 2
                                : 0),
                        y:
                            humbug.position.y +
                            (humbug.type === "map-pin"
                                ? 20
                                : "size" in humbug
                                ? humbug.size.height / 2
                                : 0),
                    }

                    setState((prev) => ({
                        ...prev,
                        dragTail: {
                            humbugId: id,
                            startPoint: centerPoint,
                            currentPoint: centerPoint,
                            markers: [],
                            distance: 0,
                        },
                    }))
                }
            }
        },
        [showDragTails, state.humbugs, multiSelectedIds]
    )

    // Select Humbug (clicking outside the area selection ends it)
    const selectHumbug = useCallback((id: string) => {
        setMultiSelectedIds((prev) => (prev.includes(id) ? prev : []))
        setSelectedConnectorId(null)
        setState((prev) => ({
            ...prev,
            selectedHumbugId: id,
        }))
    }, [])

    // Move Humbug
    const moveHumbug = useCallback(
        (id: string, newPosition: Point) => {
            // Don't snap to grid while actively dragging to prevent jumping
            // Only snap when drag is complete
            const finalPosition =
                snapToGridEnabled && !isDragging
                    ? snapToGrid(newPosition, 32)
                    : newPosition

            setState((prev) => {
                const updatedHumbugs = prev.humbugs.map((humbug) =>
                    humbug.id === id
                        ? {
                              ...humbug,
                              position: finalPosition,
                              updatedAt: Date.now(),
                          }
                        : humbug
                )

                // Update drag tail if dragging and enabled
                let updatedDragTail = prev.dragTail
                if (
                    prev.dragTail &&
                    prev.dragTail.humbugId === id &&
                    showDragTails
                ) {
                    const updatedHumbug = updatedHumbugs.find(
                        (h) => h.id === id
                    )
                    if (updatedHumbug) {
                        const centerPoint = {
                            x:
                                updatedHumbug.position.x +
                                (updatedHumbug.type === "map-pin"
                                    ? 16
                                    : "size" in updatedHumbug
                                    ? updatedHumbug.size.width / 2
                                    : 0),
                            y:
                                updatedHumbug.position.y +
                                (updatedHumbug.type === "map-pin"
                                    ? 20
                                    : "size" in updatedHumbug
                                    ? updatedHumbug.size.height / 2
                                    : 0),
                        }

                        const distance =
                            Math.sqrt(
                                Math.pow(
                                    centerPoint.x - prev.dragTail.startPoint.x,
                                    2
                                ) +
                                    Math.pow(
                                        centerPoint.y -
                                            prev.dragTail.startPoint.y,
                                        2
                                    )
                            ) / 32 // Convert to grid units

                        // Generate markers every grid unit along the path
                        const markers: Point[] = []
                        const totalDistance = Math.sqrt(
                            Math.pow(
                                centerPoint.x - prev.dragTail.startPoint.x,
                                2
                            ) +
                                Math.pow(
                                    centerPoint.y - prev.dragTail.startPoint.y,
                                    2
                                )
                        )

                        if (totalDistance > 32) {
                            // Only show markers if distance > 1 grid unit
                            const stepCount = Math.floor(totalDistance / 32)
                            for (let i = 1; i <= stepCount; i++) {
                                const ratio = (i * 32) / totalDistance
                                markers.push({
                                    x:
                                        prev.dragTail.startPoint.x +
                                        (centerPoint.x -
                                            prev.dragTail.startPoint.x) *
                                            ratio,
                                    y:
                                        prev.dragTail.startPoint.y +
                                        (centerPoint.y -
                                            prev.dragTail.startPoint.y) *
                                            ratio,
                                })
                            }
                        }

                        updatedDragTail = {
                            ...prev.dragTail,
                            currentPoint: centerPoint,
                            markers,
                            distance,
                        }
                    }
                }

                return {
                    ...prev,
                    humbugs: updatedHumbugs,
                    dragTail: updatedDragTail,
                }
            })
        },
        [snapToGridEnabled, showDragTails, isDragging]
    )

    // Rotate Humbug
    const rotateHumbug = useCallback(
        (id: string, rotation: number) => {
            setState((prev) => {
                const humbug = prev.humbugs.find((h) => h.id === id)
                if (humbug && humbug.rotation !== rotation) {
                    // Record rotation action for undo
                    undoRedoManager.addAction({
                        type: "ROTATE_HUMBUG",
                        timestamp: Date.now(),
                        humbugId: id,
                        oldRotation: humbug.rotation,
                        newRotation: rotation,
                    })
                }

                return {
                    ...prev,
                    humbugs: prev.humbugs.map((h) =>
                        h.id === id
                            ? { ...h, rotation, updatedAt: Date.now() }
                            : h
                    ),
                }
            })
        },
        [undoRedoManager]
    )

    // Resize Humbug
    const resizeHumbug = useCallback(
        (
            id: string,
            newSize: { width: number; height: number },
            isResizeComplete?: boolean
        ) => {
            setState((prev) => {
                const humbugIndex = prev.humbugs.findIndex((h) => h.id === id)
                if (humbugIndex === -1) return prev

                const humbug = prev.humbugs[humbugIndex]

                // Only resize humbugs that have a size property (not map-pin)
                if (humbug.type === "map-pin") return prev

                // Start of resize - store initial state
                if (isResizingRef.current !== id) {
                    isResizingRef.current = id
                    initialResizeSizeRef.current = humbug.size as {
                        width: number
                        height: number
                    }
                }

                // Only record undo action when resize is complete
                if (isResizeComplete) {
                    undoRedoManager.addAction({
                        type: "RESIZE_HUMBUG",
                        timestamp: Date.now(),
                        humbugId: id,
                        oldSize: initialResizeSizeRef.current,
                        newSize,
                    })

                    // Reset resize tracking
                    isResizingRef.current = null
                }

                return {
                    ...prev,
                    humbugs: prev.humbugs.map((h) =>
                        h.id === id
                            ? ({
                                  ...h,
                                  size: newSize,
                                  updatedAt: Date.now(),
                              } as Humbug)
                            : h
                    ),
                }
            })
        },
        [undoRedoManager]
    )

    // Delete Humbug
    const deleteHumbug = useCallback(
        (id: string) => {
            setState((prev) => {
                const humbug = prev.humbugs.find((h) => h.id === id)
                if (humbug) {
                    // Record deletion for undo
                    undoRedoManager.addAction({
                        type: "DELETE_HUMBUG",
                        timestamp: Date.now(),
                        humbug,
                    })
                }

                return {
                    ...prev,
                    humbugs: prev.humbugs.filter((h) => h.id !== id),
                    selectedHumbugId:
                        prev.selectedHumbugId === id
                            ? null
                            : prev.selectedHumbugId,
                }
            })
        },
        [undoRedoManager]
    )

    // Hotkeys: add at cursor, drop a spot at cursor, delete the selection
    useEffect(() => {
        const onCreate = (e: Event) =>
            showHumbugModal(
                (e as CustomEvent<HumbugType>).detail,
                pointerInContainer()
            )
        const onSpot = () => {
            const p = pointerInContainer()
            requestAddSpot(containerToWorld(p.x, p.y))
        }
        const onDelete = () => {
            if (selectedConnectorId) {
                deleteConnector(selectedConnectorId)
            } else if (multiSelectedIds.length) {
                const ids = new Set(multiSelectedIds)
                const removed = state.humbugs.filter((h) => ids.has(h.id))
                setState((prev) => ({
                    ...prev,
                    humbugs: prev.humbugs.filter((h) => !ids.has(h.id)),
                    selectedHumbugId: null,
                }))
                undoRedoManager.addAction({
                    type: "BATCH_ACTION",
                    timestamp: Date.now(),
                    actions: removed.map((humbug) => ({
                        type: "DELETE_HUMBUG" as const,
                        timestamp: Date.now(),
                        humbug,
                    })),
                })
                setMultiSelectedIds([])
            } else if (state.selectedHumbugId) {
                deleteHumbug(state.selectedHumbugId)
            }
        }
        window.addEventListener(CREATE_AT_CURSOR_EVENT, onCreate)
        window.addEventListener(SPOT_AT_CURSOR_EVENT, onSpot)
        window.addEventListener(DELETE_SELECTION_EVENT, onDelete)
        return () => {
            window.removeEventListener(CREATE_AT_CURSOR_EVENT, onCreate)
            window.removeEventListener(SPOT_AT_CURSOR_EVENT, onSpot)
            window.removeEventListener(DELETE_SELECTION_EVENT, onDelete)
        }
    }, [
        showHumbugModal,
        pointerInContainer,
        containerToWorld,
        deleteHumbug,
        state.selectedHumbugId,
        state.humbugs,
        multiSelectedIds,
        undoRedoManager,
        selectedConnectorId,
        deleteConnector,
    ])

    // Area selection: marquee results, select-all, and ways to clear it
    useEffect(() => {
        const boxOf = (h: Humbug) => {
            const w = h.type === "map-pin" ? h.size : h.size.width
            const hgt = h.type === "map-pin" ? h.size : h.size.height
            return { x1: h.position.x, y1: h.position.y, x2: h.position.x + w, y2: h.position.y + hgt }
        }
        const onArea = (e: Event) => {
            const r = (e as CustomEvent<AreaSelectDetail>).detail
            const hits = state.humbugs
                .filter((h) => {
                    if (h.locked) return false
                    const b = boxOf(h)
                    return b.x1 < r.x2 && b.x2 > r.x1 && b.y1 < r.y2 && b.y2 > r.y1
                })
                .map((h) => h.id)
            setMultiSelectedIds((prev) =>
                r.additive ? [...new Set([...prev, ...hits])] : hits
            )
            setState((prev) => ({ ...prev, selectedHumbugId: null }))
        }
        const onSelectAll = () => {
            setMultiSelectedIds(state.humbugs.filter((h) => !h.locked).map((h) => h.id))
            setState((prev) => ({ ...prev, selectedHumbugId: null }))
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setMultiSelectedIds([])
                setSelectedConnectorId(null)
                // Escape also closes the right-click menus
                setState((prev) =>
                    prev.contextMenu.isOpen || prev.humbugContextMenu.isOpen
                        ? {
                              ...prev,
                              contextMenu: { isOpen: false, position: { x: 0, y: 0 } },
                              humbugContextMenu: {
                                  isOpen: false,
                                  position: { x: 0, y: 0 },
                                  humbugId: null,
                              },
                          }
                        : prev
                )
            }
        }
        const onDown = (e: MouseEvent) => {
            const t = e.target as HTMLElement
            if (e.button === 0 && t.classList?.contains("infinite-whiteboard-canvas")) {
                setMultiSelectedIds([])
                setSelectedConnectorId(null)
            }
        }
        window.addEventListener(AREA_SELECT_EVENT, onArea)
        window.addEventListener(SELECT_ALL_EVENT, onSelectAll)
        window.addEventListener("keydown", onKey)
        window.addEventListener("mousedown", onDown)
        return () => {
            window.removeEventListener(AREA_SELECT_EVENT, onArea)
            window.removeEventListener(SELECT_ALL_EVENT, onSelectAll)
            window.removeEventListener("keydown", onKey)
            window.removeEventListener("mousedown", onDown)
        }
    }, [state.humbugs])

    // Edit Humbug - open modal with existing data
    const editHumbug = useCallback(
        (id: string) => {
            const humbug = state.humbugs.find((h) => h.id === id)
            if (!humbug) return

            setModalState({
                isOpen: true,
                type: humbug.type,
                position: humbug.position,
            })

            // Store the ID of the humbug being edited
            setEditingHumbugId(id)
        },
        [state.humbugs]
    )

    // Z-index management functions
    const bringToFront = useCallback((id: string) => {
        setState((prev) => {
            const maxZ = Math.max(...prev.humbugs.map((h) => h.zIndex))
            return {
                ...prev,
                humbugs: prev.humbugs.map((humbug) =>
                    humbug.id === id
                        ? { ...humbug, zIndex: maxZ + 1, updatedAt: Date.now() }
                        : humbug
                ),
            }
        })
    }, [])

    const sendToBack = useCallback((id: string) => {
        setState((prev) => {
            const minZ = Math.min(...prev.humbugs.map((h) => h.zIndex))
            return {
                ...prev,
                humbugs: prev.humbugs.map((humbug) =>
                    humbug.id === id
                        ? { ...humbug, zIndex: minZ - 1, updatedAt: Date.now() }
                        : humbug
                ),
            }
        })
    }, [])

    const bringForward = useCallback((id: string) => {
        setState((prev) => {
            const currentHumbug = prev.humbugs.find((h) => h.id === id)
            if (!currentHumbug) return prev

            const higherZ = prev.humbugs
                .filter((h) => h.zIndex > currentHumbug.zIndex)
                .sort((a, b) => a.zIndex - b.zIndex)[0]

            if (!higherZ) return prev

            return {
                ...prev,
                humbugs: prev.humbugs.map((humbug) => {
                    if (humbug.id === id) {
                        return {
                            ...humbug,
                            zIndex: higherZ.zIndex + 1,
                            updatedAt: Date.now(),
                        }
                    }
                    return humbug
                }),
            }
        })
    }, [])

    const sendBackward = useCallback((id: string) => {
        setState((prev) => {
            const currentHumbug = prev.humbugs.find((h) => h.id === id)
            if (!currentHumbug) return prev

            const lowerZ = prev.humbugs
                .filter((h) => h.zIndex < currentHumbug.zIndex)
                .sort((a, b) => b.zIndex - a.zIndex)[0]

            if (!lowerZ) return prev

            return {
                ...prev,
                humbugs: prev.humbugs.map((humbug) => {
                    if (humbug.id === id) {
                        return {
                            ...humbug,
                            zIndex: lowerZ.zIndex - 1,
                            updatedAt: Date.now(),
                        }
                    }
                    return humbug
                }),
            }
        })
    }, [])

    // Toggle lock state
    const toggleLock = useCallback((id: string) => {
        setState((prev) => ({
            ...prev,
            humbugs: prev.humbugs.map((humbug) =>
                humbug.id === id
                    ? {
                          ...humbug,
                          locked: !humbug.locked,
                          updatedAt: Date.now(),
                      }
                    : humbug
            ),
        }))
    }, [])

    // Show humbug context menu
    const showHumbugContextMenu = useCallback(
        (e: React.MouseEvent, humbugId: string) => {
            e.preventDefault()
            e.stopPropagation()

            const rect = containerRef.current?.getBoundingClientRect()
            if (!rect) return

            setState((prev) => ({
                ...prev,
                humbugContextMenu: {
                    isOpen: true,
                    position: {
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                    },
                    humbugId,
                },
                // Close regular context menu if open
                contextMenu: { isOpen: false, position: { x: 0, y: 0 } },
            }))
        },
        [containerRef]
    )

    // Close humbug context menu
    const closeHumbugContextMenu = useCallback(() => {
        setState((prev) => ({
            ...prev,
            humbugContextMenu: {
                isOpen: false,
                position: { x: 0, y: 0 },
                humbugId: null,
            },
        }))
    }, [])

    // Handle humbug context menu actions
    const handleHumbugContextAction = useCallback(
        (action: string, humbugId: string) => {
            switch (action) {
                case "edit":
                    editHumbug(humbugId)
                    break
                case "lock":
                case "unlock":
                    toggleLock(humbugId)
                    break
                case "bringToFront":
                    bringToFront(humbugId)
                    break
                case "sendToBack":
                    sendToBack(humbugId)
                    break
                case "bringForward":
                    bringForward(humbugId)
                    break
                case "sendBackward":
                    sendBackward(humbugId)
                    break
                case "delete":
                    deleteHumbug(humbugId)
                    break
            }
        },
        [
            editHumbug,
            toggleLock,
            bringToFront,
            sendToBack,
            bringForward,
            sendBackward,
            deleteHumbug,
        ]
    )

    // Close context menu
    const closeContextMenu = useCallback(() => {
        setState((prev) => ({
            ...prev,
            contextMenu: { isOpen: false, position: { x: 0, y: 0 } },
        }))
    }, [])

    // Mouse move handler for dragging
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !draggedHumbugRef.current) return

            const rect = containerRef.current?.getBoundingClientRect()
            if (!rect) return

            // Convert client coordinates to container coordinates
            const containerX = e.clientX - rect.left
            const containerY = e.clientY - rect.top

            // Calculate the world position where the humbug should be placed
            // by subtracting the drag offset from the current mouse position
            const targetScreenX = containerX - dragOffset.x
            const targetScreenY = containerY - dragOffset.y
            const worldPos = containerToWorld(targetScreenX, targetScreenY)

            moveHumbug(draggedHumbugRef.current, worldPos)

            // Carry the rest of the area selection along by the same delta
            const group = groupDragRef.current
            const start = group?.get(draggedHumbugRef.current)
            if (group && start) {
                const dx = worldPos.x - start.x
                const dy = worldPos.y - start.y
                const dragged = draggedHumbugRef.current
                setState((prev) => ({
                    ...prev,
                    humbugs: prev.humbugs.map((h) => {
                        const from = group.get(h.id)
                        return from && h.id !== dragged
                            ? { ...h, position: { x: from.x + dx, y: from.y + dy } }
                            : h
                    }),
                }))
            }
        }

        const handleMouseUp = () => {
            const group = groupDragRef.current
            if (isDragging && draggedHumbugRef.current && group) {
                // Finish a group drag: settle everyone (snapped if enabled)
                // and record a single undo step for the whole move
                const dragged = state.humbugs.find(
                    (h) => h.id === draggedHumbugRef.current
                )
                const start = dragged && group.get(dragged.id)
                if (dragged && start) {
                    const end = snapToGridEnabled
                        ? snapToGrid(dragged.position, 32)
                        : dragged.position
                    const dx = end.x - start.x
                    const dy = end.y - start.y
                    setState((prev) => ({
                        ...prev,
                        humbugs: prev.humbugs.map((h) => {
                            const from = group.get(h.id)
                            return from
                                ? { ...h, position: { x: from.x + dx, y: from.y + dy } }
                                : h
                        }),
                    }))
                    if (dx || dy) {
                        undoRedoManager.addAction({
                            type: "BATCH_ACTION",
                            timestamp: Date.now(),
                            actions: [...group].map(([humbugId, from]) => ({
                                type: "MOVE_HUMBUG" as const,
                                timestamp: Date.now(),
                                humbugId,
                                oldPosition: from,
                                newPosition: { x: from.x + dx, y: from.y + dy },
                            })),
                        })
                    }
                }
                groupDragRef.current = null
                setIsDragging(false)
                draggedHumbugRef.current = null
                setDragOffset({ x: 0, y: 0 })
                setState((prev) => ({ ...prev, dragTail: null }))
                return
            }
            if (isDragging && draggedHumbugRef.current) {
                // Apply snap-to-grid on drag end if enabled
                if (snapToGridEnabled) {
                    const humbug = state.humbugs.find(
                        (h) => h.id === draggedHumbugRef.current
                    )
                    if (humbug) {
                        const snappedPosition = snapToGrid(humbug.position, 32)
                        moveHumbug(draggedHumbugRef.current, snappedPosition)
                    }
                }

                // Record move action for undo
                const humbug = state.humbugs.find(
                    (h) => h.id === draggedHumbugRef.current
                )
                if (
                    humbug &&
                    (humbug.position.x !== initialDragPositionRef.current.x ||
                        humbug.position.y !== initialDragPositionRef.current.y)
                ) {
                    undoRedoManager.addAction({
                        type: "MOVE_HUMBUG",
                        timestamp: Date.now(),
                        humbugId: draggedHumbugRef.current,
                        oldPosition: initialDragPositionRef.current,
                        newPosition: humbug.position,
                    })
                }

                setIsDragging(false)
                draggedHumbugRef.current = null
                setDragOffset({ x: 0, y: 0 })

                // Clear drag tail
                setState((prev) => ({
                    ...prev,
                    dragTail: null,
                }))
            }
        }

        // Add global event listeners for more reliable drag handling
        document.addEventListener("mousemove", handleMouseMove)
        document.addEventListener("mouseup", handleMouseUp)

        // Also listen for mouse leave events to cancel dragging
        const handleMouseLeave = () => {
            if (isDragging) {
                setIsDragging(false)
                draggedHumbugRef.current = null
                setDragOffset({ x: 0, y: 0 })

                // Clear drag tail
                setState((prev) => ({
                    ...prev,
                    dragTail: null,
                }))
            }
        }

        document.addEventListener("mouseleave", handleMouseLeave)

        return () => {
            document.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("mouseup", handleMouseUp)
            document.removeEventListener("mouseleave", handleMouseLeave)
        }
    }, [
        isDragging,
        containerRef,
        containerToWorld,
        moveHumbug,
        dragOffset,
        state.humbugs,
        undoRedoManager,
        snapToGridEnabled,
    ])

    // Export humbugs as JSON
    const exportHumbugs = useCallback(() => {
        const data = {
            version: "1.0",
            humbugs: state.humbugs,
            exportedAt: new Date().toISOString(),
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `jewel-vtt-board-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
    }, [state.humbugs])

    // Export for PNG functionality
    const exportHumbugData = useCallback(() => {
        if (onExportRequest) {
            onExportRequest(state.humbugs, { x: 0, y: 0, zoom: 1 }) // viewport will be provided by InfiniteWhiteboard
        }
    }, [state.humbugs, onExportRequest])

    // Import humbugs from JSON
    const importHumbugs = useCallback((jsonData: string) => {
        try {
            const data = JSON.parse(jsonData)
            if (data.humbugs && Array.isArray(data.humbugs)) {
                setState((prev) => ({
                    ...prev,
                    humbugs: data.humbugs,
                    selectedHumbugId: null,
                }))
                console.log("Imported", data.humbugs.length, "humbugs")
            }
        } catch (error) {
            console.error("Failed to import humbugs:", error)
        }
    }, [])

    // Import for PNG functionality
    const importHumbugData = useCallback(
        (humbugs: Humbug[]) => {
            setState((prev) => ({
                ...prev,
                humbugs,
                selectedHumbugId: null,
            }))
            if (onImportRequest) {
                onImportRequest(humbugs)
            }
        },
        [onImportRequest]
    )

    // Expose export/import functions globally for the sidebar buttons and PNG export
    useEffect(() => {
        const windowGlobal = window as unknown as {
            exportHumbugs?: () => void
            importHumbugs?: (data: string) => void
            exportHumbugData?: () => void
            importHumbugData?: (humbugs: Humbug[]) => void
            clearAllHumbugs?: () => void
        }

        windowGlobal.exportHumbugs = exportHumbugs
        windowGlobal.importHumbugs = importHumbugs
        windowGlobal.exportHumbugData = exportHumbugData
        windowGlobal.importHumbugData = importHumbugData
        // Called by InfiniteWhiteboard when the user starts a New Board
        windowGlobal.clearAllHumbugs = () => {
            setState((prev) => ({
                ...prev,
                humbugs: [],
                selectedHumbugId: null,
            }))
            setConnectors([])
            setSelectedConnectorId(null)
            setMultiSelectedIds([])
        }

        return () => {
            delete windowGlobal.exportHumbugs
            delete windowGlobal.importHumbugs
            delete windowGlobal.exportHumbugData
            delete windowGlobal.importHumbugData
            delete windowGlobal.clearAllHumbugs
        }
    }, [exportHumbugs, importHumbugs, exportHumbugData, importHumbugData])

    // Undo/Redo functions
    const performUndoAction = useCallback((action: Action) => {
        switch (action.type) {
            case "CONNECTOR_ADD":
                setConnectors((prev) => prev.filter((c) => c.id !== action.connector.id))
                break
            case "CONNECTOR_DELETE":
                setConnectors((prev) => [...prev, action.connector])
                break
            case "CREATE_HUMBUG":
                setState((prev) => ({
                    ...prev,
                    humbugs: prev.humbugs.filter(
                        (h) => h.id !== action.humbug.id
                    ),
                }))
                break

            case "DELETE_HUMBUG":
                setState((prev) => ({
                    ...prev,
                    humbugs: [...prev.humbugs, action.humbug],
                }))
                break

            case "MOVE_HUMBUG":
                setState((prev) => ({
                    ...prev,
                    humbugs: prev.humbugs.map((h) =>
                        h.id === action.humbugId
                            ? { ...h, position: action.oldPosition }
                            : h
                    ),
                }))
                break

            case "RESIZE_HUMBUG":
                setState((prev) => ({
                    ...prev,
                    humbugs: prev.humbugs.map((h) => {
                        if (h.id === action.humbugId) {
                            if (h.type === "map-pin") {
                                return { ...h, size: action.oldSize as number }
                            } else {
                                return {
                                    ...h,
                                    size: action.oldSize as {
                                        width: number
                                        height: number
                                    },
                                }
                            }
                        }
                        return h
                    }),
                }))
                break

            case "ROTATE_HUMBUG":
                setState((prev) => ({
                    ...prev,
                    humbugs: prev.humbugs.map((h) =>
                        h.id === action.humbugId
                            ? { ...h, rotation: action.oldRotation }
                            : h
                    ),
                }))
                break

            case "EDIT_HUMBUG":
                setState((prev) => ({
                    ...prev,
                    humbugs: prev.humbugs.map((h) =>
                        h.id === action.humbugId ? action.oldHumbug : h
                    ),
                }))
                break
        }
    }, [])

    const performRedoAction = useCallback((action: Action) => {
        switch (action.type) {
            case "CONNECTOR_ADD":
                setConnectors((prev) => [...prev, action.connector])
                break
            case "CONNECTOR_DELETE":
                setConnectors((prev) => prev.filter((c) => c.id !== action.connector.id))
                break
            case "CREATE_HUMBUG":
                setState((prev) => ({
                    ...prev,
                    humbugs: [...prev.humbugs, action.humbug],
                }))
                break

            case "DELETE_HUMBUG":
                setState((prev) => ({
                    ...prev,
                    humbugs: prev.humbugs.filter(
                        (h) => h.id !== action.humbug.id
                    ),
                }))
                break

            case "MOVE_HUMBUG":
                setState((prev) => ({
                    ...prev,
                    humbugs: prev.humbugs.map((h) =>
                        h.id === action.humbugId
                            ? { ...h, position: action.newPosition }
                            : h
                    ),
                }))
                break

            case "RESIZE_HUMBUG":
                setState((prev) => ({
                    ...prev,
                    humbugs: prev.humbugs.map((h) => {
                        if (h.id === action.humbugId) {
                            if (h.type === "map-pin") {
                                return { ...h, size: action.newSize as number }
                            } else {
                                return {
                                    ...h,
                                    size: action.newSize as {
                                        width: number
                                        height: number
                                    },
                                }
                            }
                        }
                        return h
                    }),
                }))
                break

            case "ROTATE_HUMBUG":
                setState((prev) => ({
                    ...prev,
                    humbugs: prev.humbugs.map((h) =>
                        h.id === action.humbugId
                            ? { ...h, rotation: action.newRotation }
                            : h
                    ),
                }))
                break

            case "EDIT_HUMBUG":
                setState((prev) => ({
                    ...prev,
                    humbugs: prev.humbugs.map((h) =>
                        h.id === action.humbugId ? action.newHumbug : h
                    ),
                }))
                break
        }
    }, [])

    // Batches (group moves / deletes) undo and redo as a single step
    const undoAny = useCallback(
        (action: Action) => {
            const run = (a: Action): void => {
                if (a.type === "BATCH_ACTION") [...a.actions].reverse().forEach(run)
                else performUndoAction(a)
            }
            run(action)
        },
        [performUndoAction]
    )
    const redoAny = useCallback(
        (action: Action) => {
            const run = (a: Action): void => {
                if (a.type === "BATCH_ACTION") a.actions.forEach(run)
                else performRedoAction(a)
            }
            run(action)
        },
        [performRedoAction]
    )

    const performUndo = useCallback(() => {
        const action = undoRedoManager.getUndoAction()
        if (!action) return
        undoAny(action)
    }, [undoRedoManager, undoAny])

    const performRedo = useCallback(() => {
        const action = undoRedoManager.getRedoAction()
        if (!action) return
        redoAny(action)
    }, [undoRedoManager, redoAny])

    // Copy/Cut/Paste functions
    const copySelectedHumbugs = useCallback(() => {
        const selectedHumbugs = multiSelectedIds.length
            ? state.humbugs.filter((h) => multiSelectedIds.includes(h.id))
            : state.selectedHumbugId
            ? state.humbugs.filter((h) => h.id === state.selectedHumbugId)
            : []

        console.log("Copy attempt:", {
            selectedHumbugId: state.selectedHumbugId,
            totalHumbugs: state.humbugs.length,
            selectedHumbugs: selectedHumbugs.length,
        })

        if (selectedHumbugs.length > 0) {
            clipboardManager.copy(selectedHumbugs)
            console.log(
                "Copied",
                selectedHumbugs.length,
                "humbugs to clipboard"
            )
        } else {
            console.log("No humbugs selected for copy")
        }
    }, [state.selectedHumbugId, state.humbugs, clipboardManager, multiSelectedIds])

    const cutSelectedHumbugs = useCallback(() => {
        const selectedHumbugs = multiSelectedIds.length
            ? state.humbugs.filter((h) => multiSelectedIds.includes(h.id))
            : state.selectedHumbugId
            ? state.humbugs.filter((h) => h.id === state.selectedHumbugId)
            : []

        if (selectedHumbugs.length > 0) {
            clipboardManager.cut(selectedHumbugs)

            // Record deletion action for undo
            selectedHumbugs.forEach((humbug) => {
                undoRedoManager.addAction({
                    type: "DELETE_HUMBUG",
                    timestamp: Date.now(),
                    humbug,
                })
            })

            // Remove selected humbugs
            const cutIds = new Set(selectedHumbugs.map((h) => h.id))
            setState((prev) => ({
                ...prev,
                humbugs: prev.humbugs.filter((h) => !cutIds.has(h.id)),
                selectedHumbugId: null,
            }))
            setMultiSelectedIds([])
        }
    }, [
        multiSelectedIds,
        state.selectedHumbugId,
        state.humbugs,
        clipboardManager,
        undoRedoManager,
    ])

    const pasteHumbugs = useCallback(() => {
        console.log("Paste attempt:", {
            hasContent: clipboardManager.hasContent(),
            wasCut: clipboardManager.wasCutOperation(),
        })

        const pastedHumbugs = clipboardManager.paste()

        console.log("Pasted humbugs:", pastedHumbugs.length)

        if (pastedHumbugs.length > 0) {
            // Record creation actions for undo
            pastedHumbugs.forEach((humbug) => {
                undoRedoManager.addAction({
                    type: "CREATE_HUMBUG",
                    timestamp: Date.now(),
                    humbug,
                })
            })

            setState((prev) => ({
                ...prev,
                humbugs: [...prev.humbugs, ...pastedHumbugs],
                selectedHumbugId: pastedHumbugs[0]?.id || null,
            }))
            console.log(
                "Successfully pasted and added",
                pastedHumbugs.length,
                "humbugs"
            )
        } else {
            console.log("No humbugs to paste from clipboard")
        }
    }, [clipboardManager, undoRedoManager])

    // Listen for undo/redo events from App level (when external undo manager is provided)
    useEffect(() => {
        if (!externalUndoRedoManager) return // Only listen when using external manager

        const handleExternalUndo = (event: CustomEvent) => {
            const action = event.detail
            // Only handle humbug-related actions
            if (
                [
                    "CREATE_HUMBUG",
                    "DELETE_HUMBUG",
                    "MOVE_HUMBUG",
                    "RESIZE_HUMBUG",
                    "ROTATE_HUMBUG",
                    "EDIT_HUMBUG",
                    "BATCH_ACTION",
                    "CONNECTOR_ADD",
                    "CONNECTOR_DELETE",
                ].includes(action.type)
            ) {
                // Use the existing performUndo logic but skip the manager call
                undoAny(action)
            }
        }

        const handleExternalRedo = (event: CustomEvent) => {
            const action = event.detail
            // Only handle humbug-related actions
            if (
                [
                    "CREATE_HUMBUG",
                    "DELETE_HUMBUG",
                    "MOVE_HUMBUG",
                    "RESIZE_HUMBUG",
                    "ROTATE_HUMBUG",
                    "EDIT_HUMBUG",
                    "BATCH_ACTION",
                    "CONNECTOR_ADD",
                    "CONNECTOR_DELETE",
                ].includes(action.type)
            ) {
                // Use the existing performRedo logic but skip the manager call
                redoAny(action)
            }
        }

        window.addEventListener(
            "performUndo",
            handleExternalUndo as EventListener
        )
        window.addEventListener(
            "performRedo",
            handleExternalRedo as EventListener
        )

        return () => {
            window.removeEventListener(
                "performUndo",
                handleExternalUndo as EventListener
            )
            window.removeEventListener(
                "performRedo",
                handleExternalRedo as EventListener
            )
        }
    }, [externalUndoRedoManager, undoAny, redoAny])

    // Keyboard event handler - only when not using external undo manager
    useEffect(() => {
        if (externalUndoRedoManager) return // Skip undo/redo keyboard handling when App manages it

        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if we're in an input field
            const target = e.target as HTMLElement
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.contentEditable === "true"
            ) {
                return
            }

            const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
            const cmdKey = isMac ? e.metaKey : e.ctrlKey

            if (cmdKey && e.key === "z" && !e.shiftKey) {
                e.preventDefault()
                performUndo()
            } else if (cmdKey && e.key === "z" && e.shiftKey) {
                e.preventDefault()
                performRedo()
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [externalUndoRedoManager, performUndo, performRedo])

    // Copy/paste keyboard handler - always active regardless of undo manager
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if we're in an input field
            const target = e.target as HTMLElement
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.contentEditable === "true"
            ) {
                return
            }

            const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
            const cmdKey = isMac ? e.metaKey : e.ctrlKey

            if (cmdKey && e.key === "c") {
                e.preventDefault()
                copySelectedHumbugs()
            } else if (cmdKey && e.key === "x") {
                e.preventDefault()
                cutSelectedHumbugs()
            } else if (cmdKey && e.key === "v") {
                e.preventDefault()
                pasteHumbugs()
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [copySelectedHumbugs, cutSelectedHumbugs, pasteHumbugs])

    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: state.contextMenu.isOpen ? "auto" : "none", // Enable pointer events when context menu is open
            }}
            onClick={(e) => {
                // Close context menu when clicking outside of it
                if (state.contextMenu.isOpen && e.target === e.currentTarget) {
                    closeContextMenu()
                }
            }}
        >
            {/* Humbugs live in their own stacking context so their ever-growing
                z-indexes can't climb over board overlays (scribbles, connectors,
                spot flags) or the menus below */}
            <div className='humbug-layer'>
            {state.humbugs.map((humbug) => (
                <HumbugRenderer
                    key={humbug.id}
                    humbug={humbug}
                    isSelected={state.selectedHumbugId === humbug.id}
                    isMultiSelected={multiSelectedIds.includes(humbug.id)}
                    isDragging={
                        isDragging && draggedHumbugRef.current === humbug.id
                    }
                    onSelect={selectHumbug}
                    onMove={moveHumbug}
                    onRotate={rotateHumbug}
                    onResize={resizeHumbug}
                    onDelete={deleteHumbug}
                    onEdit={editHumbug}
                    onStartDrag={startDragging}
                    scale={scale}
                    worldToScreen={worldToScreen}
                    containerRef={containerRef}
                    onContextMenu={showHumbugContextMenu} // Add context menu handler
                    snapToGridEnabled={snapToGridEnabled}
                    isShiftHeld={isShiftHeld}
                />
            ))}

            {/* Render drag tail if active */}
            {state.dragTail && showDragTails && (
                <DragTailRenderer
                    dragTail={state.dragTail}
                    worldToScreen={worldToScreen}
                />
            )}
            </div>

            <ConnectorLayer
                humbugs={state.humbugs}
                connectors={connectors}
                selectedHumbugId={state.selectedHumbugId}
                selectedConnectorId={selectedConnectorId}
                busy={isDragging}
                worldToScreen={worldToScreen}
                containerRef={containerRef}
                onCreate={createConnector}
                onSelect={(id) => {
                    setSelectedConnectorId(id)
                    setState((prev) => ({ ...prev, selectedHumbugId: null }))
                }}
                onDelete={deleteConnector}
            />

            {/* Context Menu - highest z-index for interaction */}
            {state.contextMenu.isOpen && (
                <ContextMenu
                    position={state.contextMenu.position}
                    isOpen={state.contextMenu.isOpen}
                    onClose={closeContextMenu}
                    onCreateHumbug={showHumbugModal}
                    snapToGrid={snapToGridEnabled}
                    onToggleSnapToGrid={toggleSnapToGrid}
                    onGoHome={goHome}
                    onAddSpot={(position) =>
                        requestAddSpot(
                            containerToWorld(position.x, position.y)
                        )
                    }
                />
            )}

            {/* Humbug Modal */}
            {modalState.isOpen && modalState.type && (
                <HumbugModal
                    isOpen={modalState.isOpen}
                    type={modalState.type}
                    position={modalState.position}
                    existingHumbug={
                        editingHumbugId
                            ? state.humbugs.find(
                                  (h) => h.id === editingHumbugId
                              ) || null
                            : null
                    }
                    onClose={closeModal}
                    onCreate={createHumbugFromModal}
                />
            )}

            {/* Humbug Context Menu */}
            {state.humbugContextMenu.isOpen &&
                state.humbugContextMenu.humbugId && (
                    <HumbugContextMenu
                        position={state.humbugContextMenu.position}
                        isOpen={state.humbugContextMenu.isOpen}
                        humbug={
                            state.humbugs.find(
                                (h) => h.id === state.humbugContextMenu.humbugId
                            ) || null
                        }
                        onClose={closeHumbugContextMenu}
                        onAction={handleHumbugContextAction}
                    />
                )}
        </div>
    )
}
