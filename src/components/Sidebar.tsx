import React from "react"
import "./Sidebar.css"

interface SidebarProps {
    isOpen: boolean
    onClose: () => void
    onToggleGridLines: () => void
    onToggleDragTails: () => void
    onExportBoard: () => void
    onImportBoard: (file: File) => void
    onTextureChange: (textureUrl: string | null) => void
    onTextureScaleChange: (scale: number) => void
    showGridLines: boolean
    showDragTails: boolean
    currentTexture: string | null
    textureScale: number
}

export const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    onClose,
    onToggleGridLines,
    onToggleDragTails,
    onExportBoard,
    onImportBoard,
    onTextureChange,
    onTextureScaleChange,
    showGridLines,
    showDragTails,
    currentTexture,
    textureScale,
}) => {
    const handleImportBoard = () => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = "image/png"
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) {
                onImportBoard(file)
            }
        }
        input.click()
    }

    const handleExportBoard = () => {
        onExportBoard()
    }

    const handleTextureUpload = () => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = "image/*"
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) {
                // Create a blob URL for the texture
                const textureUrl = URL.createObjectURL(file)
                onTextureChange(textureUrl)
            }
        }
        input.click()
    }

    const handleClearTexture = () => {
        onTextureChange(null)
    }

    return (
        <>
            {/* Overlay */}
            {isOpen && <div className='sidebar-overlay' onClick={onClose} />}

            {/* Sidebar */}
            <div className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
                <div className='sidebar-header'>
                    <h3>Menu</h3>
                    <button
                        className='close-button'
                        onClick={onClose}
                        aria-label='Close menu'
                    >
                        ×
                    </button>
                </div>

                <div className='sidebar-content'>
                    <div className='sidebar-section'>
                        <h4>File Operations</h4>
                        <button
                            className='sidebar-button'
                            onClick={handleExportBoard}
                        >
                            <span className='button-icon'>📤</span>
                            <span>Export Board</span>
                        </button>

                        <button
                            className='sidebar-button'
                            onClick={handleImportBoard}
                        >
                            <span className='button-icon'>📥</span>
                            <span>Import Board</span>
                        </button>
                    </div>

                    <div className='sidebar-section'>
                        <h4>View Settings</h4>
                        <button
                            className='sidebar-button sidebar-toggle'
                            onClick={onToggleGridLines}
                        >
                            <span className='toggle-icon'>
                                {showGridLines ? "🟢" : "🔴"}
                            </span>
                            <span>Grid Lines & Axes</span>
                            <span className='toggle-status'>
                                {showGridLines ? "ON" : "OFF"}
                            </span>
                        </button>

                        <button
                            className='sidebar-button sidebar-toggle'
                            onClick={onToggleDragTails}
                        >
                            <span className='toggle-icon'>
                                {showDragTails ? "🟢" : "🔴"}
                            </span>
                            <span>Drag Tails</span>
                            <span className='toggle-status'>
                                {showDragTails ? "ON" : "OFF"}
                            </span>
                        </button>
                    </div>

                    <div className='sidebar-section'>
                        <h4>Background Texture</h4>
                        {!currentTexture ? (
                            <button
                                className='sidebar-button'
                                onClick={handleTextureUpload}
                            >
                                <span className='button-icon'>🖼️</span>
                                <span>Upload Texture</span>
                            </button>
                        ) : (
                            <>
                                <div className='texture-preview'>
                                    <img
                                        src={currentTexture}
                                        alt='Current texture'
                                    />
                                    <span className='texture-info'>
                                        {Math.round(320 * textureScale)}x
                                        {Math.round(320 * textureScale)} tile
                                    </span>
                                </div>

                                <div className='texture-scale-control'>
                                    <label>
                                        Texture Scale:{" "}
                                        {Math.round(textureScale * 100)}%
                                    </label>
                                    <input
                                        type='range'
                                        min='0.1'
                                        max='3.0'
                                        step='0.1'
                                        value={textureScale}
                                        onChange={(e) =>
                                            onTextureScaleChange(
                                                Number(e.target.value)
                                            )
                                        }
                                        className='scale-slider'
                                    />
                                    <div className='scale-presets'>
                                        <button
                                            className='preset-button'
                                            onClick={() =>
                                                onTextureScaleChange(0.5)
                                            }
                                        >
                                            50%
                                        </button>
                                        <button
                                            className='preset-button'
                                            onClick={() =>
                                                onTextureScaleChange(1.0)
                                            }
                                        >
                                            100%
                                        </button>
                                        <button
                                            className='preset-button'
                                            onClick={() =>
                                                onTextureScaleChange(2.0)
                                            }
                                        >
                                            200%
                                        </button>
                                    </div>
                                </div>

                                <button
                                    className='sidebar-button sidebar-button-danger'
                                    onClick={handleClearTexture}
                                >
                                    <span className='button-icon'>🗑️</span>
                                    <span>Clear Texture</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
