import { useState, useRef, useCallback, useEffect } from "react"
import { InfiniteWhiteboard } from "./components/InfiniteWhiteboard"
import { TopBar } from "./components/TopBar"
import { Sidebar } from "./components/Sidebar"
import { Apron } from "./components/Apron"
import type { PaintTool } from "./components/Apron"
import { UndoRedoManager } from "./utils/undo-redo.utils"
import "./App.css"

function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [showGridLines, setShowGridLines] = useState(true)
    const [showDragTails, setShowDragTails] = useState(true)
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

    const handleDumpFill = () => {
        // Dispatch a custom event that the InfiniteWhiteboard will listen for
        const dumpEvent = new CustomEvent("dumpFill", {
            detail: { color: selectedColor },
        })
        window.dispatchEvent(dumpEvent)
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
        // Reset all state to initial values
        setActivePaintTool(null)
        setSelectedColor("#3498db")
        setBackgroundTexture(null)
        setTextureScale(1.0)
        setPaintGrid(new Map())

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
            <TopBar onSidebarToggle={handleSidebarToggle} />
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={handleSidebarClose}
                onToggleGridLines={handleToggleGridLines}
                onToggleDragTails={handleToggleDragTails}
                onToggleApron={handleToggleApron}
                onExportBoard={handleExportBoard}
                onImportBoard={handleImportBoard}
                onNewBoard={handleNewBoard}
                onTextureChange={handleTextureChange}
                onTextureScaleChange={handleTextureScaleChange}
                showGridLines={showGridLines}
                showDragTails={showDragTails}
                showApron={showApron}
                currentTexture={backgroundTexture}
                textureScale={textureScale}
            />
            <div className='main-content'>
                <InfiniteWhiteboard
                    showGridLines={showGridLines}
                    showDragTails={showDragTails}
                    backgroundTexture={backgroundTexture}
                    textureScale={textureScale}
                    activePaintTool={activePaintTool}
                    selectedColor={selectedColor}
                    paintGrid={paintGrid}
                    setPaintGrid={setPaintGrid}
                    undoRedoManager={undoRedoManager}
                />
            </div>
            <Apron
                isVisible={showApron}
                onToolChange={handlePaintToolChange}
                onColorChange={handleColorChange}
                onDumpFill={handleDumpFill}
                activeTool={activePaintTool}
                selectedColor={selectedColor}
            />
        </div>
    )
}

export default App
