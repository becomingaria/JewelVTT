import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { InfiniteWhiteboard } from "./components/InfiniteWhiteboard"
import { TopBar } from "./components/TopBar"
import { Sidebar } from "./components/Sidebar"
import { Apron } from "./components/Apron"
import type { PaintTool } from "./components/Apron"
import { UndoRedoManager } from "./utils/undo-redo.utils"
import {
    ADD_SPOT_EVENT,
    DELETE_SELECTION_EVENT,
    SELECT_ALL_EVENT,
    SPOT_AT_CURSOR_EVENT,
    createAtCursor,
    dispatchBoardEvent,
    flyTo,
    goHome,
} from "./utils/view-events"
import type { Point } from "./types/humbug.types"
import type { Spot } from "./types/spot.types"
import type {
    ScribbleLayer,
    ScribbleSettings,
    ScribbleStroke,
} from "./types/scribble.types"
import { SCRIBBLE_COLORS } from "./types/scribble.types"
import { ScribbleToolbar } from "./components/ScribbleToolbar"
import { exportScribbleLayer } from "./utils/scribble-art"
import {
    openBoardFromFile,
    useBoardSlice,
} from "./utils/board-store"
import { ToastHost } from "./components/Toast"
import { BoardFileDialog } from "./components/BoardFileDialog"
import { useLocalBoards } from "./utils/use-local-boards"
import { showToast } from "./utils/toast"
import { HowToDialog } from "./components/HowToDialog"
import { MOD, useHotkeys } from "./utils/hotkeys"
import type { ViewMode } from "./utils/projection"
import {
    loadDragTailStyle,
    saveDragTailStyle,
    type DragTailStyleId,
} from "./utils/drag-tail-styles"
import {
    DEFAULT_BOARD_STYLE,
    BOARD_STYLES,
    getBoardStyleTexture,
    getStyleTileWorld,
    type BoardStyleId,
    type GridShape,
} from "./utils/board-styles"
import "./App.css"

function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [showGridLines, setShowGridLines] = useState(true)
    const [showDragTails, setShowDragTails] = useState(true)
    const [dragTailStyle, setDragTailStyle] = useState<DragTailStyleId>(loadDragTailStyle)
    const changeDragTailStyle = (id: DragTailStyleId) => {
        setDragTailStyle(id)
        saveDragTailStyle(id)
        setShowDragTails(true)
    }
    const [showApron, setShowApron] = useState(false)
    const [activePaintTool, setActivePaintTool] = useState<PaintTool>(null)
    const [selectedColor, setSelectedColor] = useState("#3498db")
    const [backgroundTexture, setBackgroundTexture] = useState<string | null>(
        null
    )
    const [textureScale, setTextureScale] = useState(1.0)
    const [paintGrid, setPaintGrid] = useState<Map<string, string>>(new Map())

    // Undo/Redo manager
    const undoRedoManager = useRef(new UndoRedoManager()).current
    const [boardStyle, setBoardStyle] =
        useState<BoardStyleId>(DEFAULT_BOARD_STYLE)
    const [gridShape, setGridShape] = useState<GridShape>("square")
    const [viewMode, setViewMode] = useState<ViewMode>("2d")
    // A custom uploaded texture overrides the style's generated one
    const effectiveTexture = useMemo(
        () => backgroundTexture ?? getBoardStyleTexture(boardStyle),
        [backgroundTexture, boardStyle]
    )
    // Warm the style texture cache in idle time so the picker opens instantly
    useEffect(() => {
        const ids = BOARD_STYLES.map((s) => s.id)
        let handle = 0
        const next = () => {
            const id = ids.shift()
            if (!id) return
            getBoardStyleTexture(id)
            handle = window.setTimeout(next, 50)
        }
        handle = window.setTimeout(next, 500)
        return () => window.clearTimeout(handle)
    }, [])

    const [spots, setSpots] = useState<Spot[]>([])
    const [editingSpotId, setEditingSpotId] = useState<string | null>(null)

    // ---- Scribble layers
    const [scribbleLayers, setScribbleLayers] = useState<ScribbleLayer[]>([])
    const [activeScribbleId, setActiveScribbleId] = useState<string | null>(null)
    const [scribbleDrawing, setScribbleDrawing] = useState(false)
    const [scribbleSettings, setScribbleSettings] = useState<ScribbleSettings>({
        tool: "pencil",
        color: SCRIBBLE_COLORS[0].value,
        size: 4,
    })
    const activeScribble = scribbleLayers.find((l) => l.id === activeScribbleId)

    const addScribbleLayer = useCallback(() => {
        const id = `scribble_${Date.now().toString(36)}`
        setScribbleLayers((prev) => {
            const used = new Set(prev.map((l) => l.name))
            let n = 1
            while (used.has(`Scribble ${n}`)) n++
            return [...prev, { id, name: `Scribble ${n}`, visible: true, strokes: [] }]
        })
        setActiveScribbleId(id)
        setScribbleDrawing(true)
        setScribbleSettings((s) => ({ ...s, tool: "pencil" }))
    }, [])

    const selectScribbleLayer = (id: string) => {
        if (id === activeScribbleId && scribbleDrawing) {
            setScribbleDrawing(false)
            return
        }
        setActiveScribbleId(id)
        setScribbleDrawing(true)
        // Drawing on a hidden layer would be confusing: show it
        setScribbleLayers((prev) =>
            prev.map((l) => (l.id === id ? { ...l, visible: true } : l))
        )
    }

    const toggleScribbleVisible = (id: string) =>
        setScribbleLayers((prev) =>
            prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
        )

    // No confirm dialog: removing a layer can be undone instead
    const deleteScribbleLayer = (id: string) => {
        const index = scribbleLayers.findIndex((l) => l.id === id)
        if (index === -1) return
        const layer = scribbleLayers[index]
        setScribbleLayers((prev) => prev.filter((l) => l.id !== id))
        undoRedoManager.addAction({
            type: "SCRIBBLE_LAYER_DELETE",
            timestamp: Date.now(),
            layer,
            index,
        })
        showToast(`Removed “${layer.name}”. Press ${MOD}Z to undo.`)
        if (id === activeScribbleId) {
            setActiveScribbleId(null)
            setScribbleDrawing(false)
        }
    }

    const updateLayerStrokes = (
        layerId: string,
        fn: (strokes: ScribbleStroke[]) => ScribbleStroke[]
    ) =>
        setScribbleLayers((prev) =>
            prev.map((l) => (l.id === layerId ? { ...l, strokes: fn(l.strokes) } : l))
        )

    const handleStrokeComplete = (layerId: string, stroke: ScribbleStroke) => {
        updateLayerStrokes(layerId, (strokes) => [...strokes, stroke])
        undoRedoManager.addAction({
            type: "SCRIBBLE_ADD",
            timestamp: Date.now(),
            layerId,
            stroke,
        })
    }

    const handleScribbleErase = (
        layerId: string,
        removed: { stroke: ScribbleStroke; index: number }[]
    ) => {
        const ids = new Set(removed.map((r) => r.stroke.id))
        updateLayerStrokes(layerId, (strokes) => strokes.filter((s) => !ids.has(s.id)))
        undoRedoManager.addAction({
            type: "SCRIBBLE_ERASE",
            timestamp: Date.now(),
            layerId,
            removed,
        })
    }

    // Escape puts the pencil down (but first closes any open menu)
    useEffect(() => {
        if (!scribbleDrawing) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return
            if (document.querySelector(".context-menu, .humbug-context-menu")) return
            setScribbleDrawing(false)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [scribbleDrawing])

    // ---- Board persistence: each slice is saved in files and autosave
    useBoardSlice<Map<string, string>, Record<string, string>>(
        "paintGrid",
        paintGrid,
        (grid) => setPaintGrid(grid ?? new Map()),
        {
            serialize: (grid) => Object.fromEntries(grid),
            deserialize: (obj) => new Map(Object.entries(obj)),
        }
    )
    useBoardSlice("boardStyle", boardStyle, (s) =>
        setBoardStyle(s ?? DEFAULT_BOARD_STYLE)
    )
    useBoardSlice("gridShape", gridShape, (g) => setGridShape(g ?? "square"))
    useBoardSlice("viewMode", viewMode, (v) => setViewMode(v ?? "2d"))
    useBoardSlice("customTexture", backgroundTexture, (t) =>
        setBackgroundTexture(t ?? null)
    )
    useBoardSlice("textureScale", textureScale, (s) => setTextureScale(s ?? 1))
    useBoardSlice("spots", spots, (s) => setSpots(s ?? []))
    useBoardSlice("scribbles", scribbleLayers, (layers) => {
        setScribbleLayers(layers ?? [])
        setActiveScribbleId(null)
        setScribbleDrawing(false)
    })


    // A loaded board starts a fresh undo history
    useEffect(() => {
        const handleLoaded = () => undoRedoManager.clear()
        window.addEventListener("jewel:boardLoaded", handleLoaded)
        return () => window.removeEventListener("jewel:boardLoaded", handleLoaded)
    }, [undoRedoManager])

    // Local folder, save/open and prepared scenes
    const local = useLocalBoards()

    const handleSaveBoard = useCallback(() => {
        void local.saveBoard()
    }, [local])

    const browseForBoard = useCallback(() => {
        openBoardFromFile()
            .then((loaded) => loaded && showToast("Board opened"))
            .catch((error: Error) => showToast(error.message, "error"))
    }, [])

    const handleOpenBoard = useCallback(() => {
        if (local.folder && local.supported) void local.openBoard()
        else browseForBoard()
    }, [local, browseForBoard])

    const [showHowTo, setShowHowTo] = useState(false)
    const closeHowTo = useCallback(() => setShowHowTo(false), [])

    useHotkeys({
        save: handleSaveBoard,
        open: handleOpenBoard,
        export: () => handleExportBoard(),
        help: () => setShowHowTo(true),
        home: goHome,
        view: () => setViewMode((m) => (m === "iso" ? "2d" : "iso")),
        spot: () => dispatchBoardEvent(SPOT_AT_CURSOR_EVENT),
        "add-text": () => createAtCursor("text"),
        "add-image": () => createAtCursor("image"),
        "add-map": () => createAtCursor("map"),
        "add-token": () => createAtCursor("token"),
        "add-pin": () => createAtCursor("map-pin"),
        "add-color": () => createAtCursor("solid-color"),
        "add-document": () => createAtCursor("document"),
        scribble: () => {
            if (scribbleLayers.length === 0) return addScribbleLayer()
            if (scribbleDrawing) return setScribbleDrawing(false)
            const id = activeScribble?.id ?? scribbleLayers[scribbleLayers.length - 1].id
            selectScribbleLayer(id)
        },
        delete: () => dispatchBoardEvent(DELETE_SELECTION_EVENT),
        "select-all": () => dispatchBoardEvent(SELECT_ALL_EVENT),
    })

    // "Snap to Spot" from the right-click menu: add a spot and name it inline
    useEffect(() => {
        const handleAddSpot = (event: Event) => {
            const { x, y } = (event as CustomEvent<Point>).detail
            const id = `spot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
            setSpots((prev) => {
                // Pick the lowest unused "Spot N" for the default name
                const used = new Set(prev.map((s) => s.name))
                let n = 1
                while (used.has(`Spot ${n}`)) n++
                return [...prev, { id, name: `Spot ${n}`, x, y }]
            })
            setEditingSpotId(id)
        }
        window.addEventListener(ADD_SPOT_EVENT, handleAddSpot)
        return () => window.removeEventListener(ADD_SPOT_EVENT, handleAddSpot)
    }, [])

    const handleSpotRename = (id: string, name: string) => {
        setSpots((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
    }

    const handleSpotDelete = (id: string) => {
        setSpots((prev) => prev.filter((s) => s.id !== id))
    }


    const handleSidebarToggle = () => {
        setIsSidebarOpen((prev) => !prev)
    }

    const handleSidebarClose = () => {
        setIsSidebarOpen(false)
    }

    const handleToggleGridLines = () => {
        setShowGridLines((prev) => !prev)
    }

    const handleToggleDragTails = () => {
        setShowDragTails((prev) => !prev)
    }

    const handleToggleApron = () => {
        setShowApron((prev) => {
            const newShowApron = !prev
            // If closing the apron, reset the active tool to null
            if (!newShowApron) {
                setActivePaintTool(null)
            }
            return newShowApron
        })
    }

    const handlePaintToolChange = (tool: PaintTool) => {
        setActivePaintTool(tool)
    }

    const handleColorChange = (color: string) => {
        setSelectedColor(color)
    }

    const handleExportBoard = () => {
        // Export functionality will be implemented in InfiniteWhiteboard
        const exportEvent = new CustomEvent("exportBoard")
        window.dispatchEvent(exportEvent)
    }

    const handleImportBoard = (file: File) => {
        // Import functionality will be implemented in InfiniteWhiteboard
        const importEvent = new CustomEvent("importBoard", { detail: file })
        window.dispatchEvent(importEvent)

        // Listen for texture data from import
        const handleTextureImport = (event: CustomEvent) => {
            if (event.detail) {
                if (event.detail.backgroundTexture !== undefined) {
                    setBackgroundTexture(event.detail.backgroundTexture)
                }
                if (event.detail.textureScale !== undefined) {
                    setTextureScale(event.detail.textureScale)
                }
            }
        }

        window.addEventListener(
            "textureImported",
            handleTextureImport as EventListener,
            { once: true }
        )
    }

    const handleTextureChange = (textureUrl: string | null) => {
        setBackgroundTexture(textureUrl)
    }

    const handleTextureScaleChange = (scale: number) => {
        setTextureScale(scale)
    }

    const handleNewBoard = () => {
        // With scenes open, the new board gets its own tab (keeps the others)
        local.startNewSceneIfNeeded()
        // Reset all state to initial values
        setActivePaintTool(null)
        setSelectedColor("#3498db")
        setBackgroundTexture(null)
        setTextureScale(1.0)
        setPaintGrid(new Map())
        setSpots([])
        setEditingSpotId(null)
        setScribbleLayers([])
        setActiveScribbleId(null)
        setScribbleDrawing(false)

        // Clear undo/redo history
        undoRedoManager.clear()

        // Dispatch events to clear board content
        const clearBoardEvent = new CustomEvent("clearBoard")
        window.dispatchEvent(clearBoardEvent)
    }

    // Undo/Redo functions that handle both humbug and paint actions
    const performUndo = useCallback(() => {
        const action = undoRedoManager.getUndoAction()
        if (!action) return

        switch (action.type) {
            case "PAINT_SQUARE":
                setPaintGrid((prev) => {
                    const newGrid = new Map(prev)
                    if (action.previousColor) {
                        newGrid.set(action.gridKey, action.previousColor)
                    } else {
                        newGrid.delete(action.gridKey)
                    }
                    return newGrid
                })
                break

            case "ERASE_SQUARE":
                setPaintGrid((prev) => {
                    const newGrid = new Map(prev)
                    newGrid.set(action.gridKey, action.previousColor)
                    return newGrid
                })
                break

            case "DUMP_FILL":
                setPaintGrid(action.previousGrid)
                break

            case "CLEAR_BOARD":
                setPaintGrid(action.previousGrid)
                // Note: Humbug restoration is handled by HumbugManager
                break

            case "PAINT_STROKE":
                setPaintGrid((prev) => {
                    const newGrid = new Map(prev)
                    // Restore each change in the stroke
                    action.changes.forEach((change, gridKey) => {
                        if (change.oldColor) {
                            newGrid.set(gridKey, change.oldColor)
                        } else {
                            newGrid.delete(gridKey)
                        }
                    })
                    return newGrid
                })
                break

            case "SCRIBBLE_ADD":
                setScribbleLayers((prev) =>
                    prev.map((l) =>
                        l.id === action.layerId
                            ? { ...l, strokes: l.strokes.filter((s) => s.id !== action.stroke.id) }
                            : l
                    )
                )
                break

            case "SCRIBBLE_LAYER_DELETE":
                setScribbleLayers((prev) => {
                    const layers = [...prev]
                    layers.splice(Math.min(action.index, layers.length), 0, action.layer)
                    return layers
                })
                break

            case "SCRIBBLE_ERASE":
                setScribbleLayers((prev) =>
                    prev.map((l) => {
                        if (l.id !== action.layerId) return l
                        const strokes = [...l.strokes]
                        // Put strokes back where they were, lowest index first
                        ;[...action.removed]
                            .sort((a, b) => a.index - b.index)
                            .forEach((r) => strokes.splice(r.index, 0, r.stroke))
                        return { ...l, strokes }
                    })
                )
                break

            // Humbug actions are handled by the HumbugManager
            default: {
                // Forward to HumbugManager via custom event
                const undoEvent = new CustomEvent("performUndo", {
                    detail: action,
                })
                window.dispatchEvent(undoEvent)
                break
            }
        }
    }, [undoRedoManager])

    const performRedo = useCallback(() => {
        const action = undoRedoManager.getRedoAction()
        if (!action) return

        switch (action.type) {
            case "PAINT_SQUARE":
                setPaintGrid((prev) => {
                    const newGrid = new Map(prev)
                    newGrid.set(action.gridKey, action.color)
                    return newGrid
                })
                break

            case "ERASE_SQUARE":
                setPaintGrid((prev) => {
                    const newGrid = new Map(prev)
                    newGrid.delete(action.gridKey)
                    return newGrid
                })
                break

            case "DUMP_FILL": {
                setPaintGrid(new Map()) // Dump fill always starts by clearing
                // Then fill with the color - this is handled in the original action
                const container = document.querySelector(
                    ".infinite-whiteboard-container"
                )
                if (container) {
                    // Recreate the dump fill effect
                    const dumpEvent = new CustomEvent("redoDumpFill", {
                        detail: { color: action.color },
                    })
                    window.dispatchEvent(dumpEvent)
                }
                break
            }

            case "CLEAR_BOARD":
                setPaintGrid(new Map())
                // Note: Humbug clearing is handled by HumbugManager
                break

            case "PAINT_STROKE":
                setPaintGrid((prev) => {
                    const newGrid = new Map(prev)
                    // Apply each change in the stroke
                    action.changes.forEach((change, gridKey) => {
                        if (change.newColor) {
                            newGrid.set(gridKey, change.newColor)
                        } else {
                            newGrid.delete(gridKey)
                        }
                    })
                    return newGrid
                })
                break

            case "SCRIBBLE_ADD":
                setScribbleLayers((prev) =>
                    prev.map((l) =>
                        l.id === action.layerId
                            ? { ...l, strokes: [...l.strokes, action.stroke] }
                            : l
                    )
                )
                break

            case "SCRIBBLE_LAYER_DELETE":
                setScribbleLayers((prev) => prev.filter((l) => l.id !== action.layer.id))
                break

            case "SCRIBBLE_ERASE": {
                const ids = new Set(action.removed.map((r) => r.stroke.id))
                setScribbleLayers((prev) =>
                    prev.map((l) =>
                        l.id === action.layerId
                            ? { ...l, strokes: l.strokes.filter((s) => !ids.has(s.id)) }
                            : l
                    )
                )
                break
            }

            // Humbug actions are handled by the HumbugManager
            default: {
                // Forward to HumbugManager via custom event
                const redoEvent = new CustomEvent("performRedo", {
                    detail: action,
                })
                window.dispatchEvent(redoEvent)
                break
            }
        }
    }, [undoRedoManager])

    // Keyboard event handler for undo/redo
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
    }, [performUndo, performRedo])

    return (
        <div className={`app ${showApron ? "apron-visible" : ""}`}>
            <TopBar
                onSidebarToggle={handleSidebarToggle}
                onGoHome={goHome}
                spots={spots}
                editingSpotId={editingSpotId}
                onEditingSpotChange={setEditingSpotId}
                onSpotSelect={(spot) => flyTo({ x: spot.x, y: spot.y })}
                onSpotRename={handleSpotRename}
                onSpotDelete={handleSpotDelete}
                scribbleLayers={scribbleLayers}
                activeScribbleId={activeScribbleId}
                scribbleDrawing={scribbleDrawing}
                onScribbleSelect={selectScribbleLayer}
                onScribbleToggleVisible={toggleScribbleVisible}
                onScribbleDelete={deleteScribbleLayer}
                onScribbleExport={(id, format) => {
                    const layer = scribbleLayers.find((l) => l.id === id)
                    if (!layer) return
                    exportScribbleLayer(layer, format)
                        .then((file) =>
                            showToast(
                                file
                                    ? `Exported “${layer.name}” as ${file}`
                                    : `Nothing is drawn on “${layer.name}” yet`
                            )
                        )
                        .catch((e: Error) => showToast(e.message, "error"))
                }}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                scenes={local.scenes}
                activeSceneId={local.activeSceneId}
                onSceneSelect={local.switchScene}
                onSceneClose={local.closeScene}
            />
            <BoardFileDialog
                dialog={local.dialog}
                folderName={local.folder?.name ?? ""}
                openFiles={local.scenes.flatMap((s) => (s.fileName ? [s.fileName] : []))}
                onClose={() => local.setDialog(null)}
                onSaveAs={local.saveAs}
                onOpen={(f) => void local.openFromFolder(f)}
                onBrowse={() => {
                    local.setDialog(null)
                    browseForBoard()
                }}
                onAddScenes={(files) => void local.addScenesFromFolder(files)}
            />
            {scribbleDrawing && activeScribble && (
                <ScribbleToolbar
                    layerName={activeScribble.name}
                    settings={scribbleSettings}
                    onChange={setScribbleSettings}
                    onDone={() => setScribbleDrawing(false)}
                />
            )}
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={handleSidebarClose}
                onToggleGridLines={handleToggleGridLines}
                onToggleDragTails={handleToggleDragTails}
                onToggleApron={handleToggleApron}
                onExportBoard={handleExportBoard}
                onImportBoard={handleImportBoard}
                onNewBoard={handleNewBoard}
                onSaveBoard={handleSaveBoard}
                onOpenBoard={handleOpenBoard}
                onAddScribbleLayer={() => {
                    setIsSidebarOpen(false)
                    addScribbleLayer()
                }}
                localFolder={{
                    supported: local.supported,
                    name: local.folder?.name ?? null,
                    needsPermission: !!local.folder && local.permission !== "granted",
                    onChoose: () => void local.pickFolder(),
                    onForget: () => void local.clearFolder(),
                    onPreparedScenes: () => {
                        setIsSidebarOpen(false)
                        void local.showPreparedScenes()
                    },
                }}
                onShowHowTo={() => {
                    setIsSidebarOpen(false)
                    setShowHowTo(true)
                }}
                onTextureChange={handleTextureChange}
                onTextureScaleChange={handleTextureScaleChange}
                showGridLines={showGridLines}
                showDragTails={showDragTails}
                dragTailStyle={dragTailStyle}
                onDragTailStyleChange={changeDragTailStyle}
                gridShape={gridShape}
                onGridShapeChange={(g) => {
                    setGridShape(g)
                    setShowGridLines(true)
                }}
                showApron={showApron}
                currentTexture={backgroundTexture}
                boardStyle={boardStyle}
                onBoardStyleChange={setBoardStyle}
                textureScale={textureScale}
            />
            <div className='main-content'>
                <InfiniteWhiteboard
                    showGridLines={showGridLines}
                    showDragTails={showDragTails}
                    dragTailStyle={dragTailStyle}
                    gridShape={gridShape}
                    viewMode={viewMode}
                    backgroundTexture={effectiveTexture}
                    textureScale={
                        backgroundTexture
                            ? textureScale
                            : getStyleTileWorld(boardStyle) / 320
                    }
                    texturePixelated={!backgroundTexture}
                    boardStyle={boardStyle}
                    activePaintTool={activePaintTool}
                    selectedColor={selectedColor}
                    paintGrid={paintGrid}
                    setPaintGrid={setPaintGrid}
                    undoRedoManager={undoRedoManager}
                    spots={spots}
                    scribbleLayers={scribbleLayers}
                    activeScribbleId={activeScribbleId}
                    scribbleDrawing={scribbleDrawing}
                    scribbleSettings={scribbleSettings}
                    onStrokeComplete={handleStrokeComplete}
                    onScribbleErase={handleScribbleErase}
                />
            </div>
            <ToastHost />
            <HowToDialog isOpen={showHowTo} onClose={closeHowTo} />
            <Apron
                isVisible={showApron}
                onToolChange={handlePaintToolChange}
                onColorChange={handleColorChange}
                activeTool={activePaintTool}
                selectedColor={selectedColor}
            />
        </div>
    )
}

export default App
