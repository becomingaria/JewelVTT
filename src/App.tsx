import { useState } from "react"
import { InfiniteWhiteboard } from "./components/InfiniteWhiteboard"
import { TopBar } from "./components/TopBar"
import { Sidebar } from "./components/Sidebar"
import { Apron } from "./components/Apron"
import type { PaintTool } from "./components/Apron"
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

        // Dispatch events to clear board content
        const clearBoardEvent = new CustomEvent("clearBoard")
        window.dispatchEvent(clearBoardEvent)
    }

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
