import React, { useState } from "react"
import { Icon } from "./Icon"
import { MOD } from "../utils/hotkeys"
import {
    BOARD_STYLES,
    getBoardStyleTexture,
    type BoardStyleId,
} from "../utils/board-styles"
import "./Sidebar.css"

interface SidebarProps {
    isOpen: boolean
    onClose: () => void
    onToggleGridLines: () => void
    onToggleDragTails: () => void
    onToggleApron: () => void
    onExportBoard: () => void
    onImportBoard: (file: File) => void
    onNewBoard: () => void
    onSaveBoard: () => void
    onOpenBoard: () => void
    onShowHowTo: () => void
    onAddScribbleLayer: () => void
    onTextureChange: (textureUrl: string | null) => void
    onTextureScaleChange: (scale: number) => void
    showGridLines: boolean
    showDragTails: boolean
    showApron: boolean
    currentTexture: string | null
    textureScale: number
    boardStyle: BoardStyleId
    onBoardStyleChange: (style: BoardStyleId) => void
}

export const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    onClose,
    onToggleGridLines,
    onToggleDragTails,
    onToggleApron,
    onExportBoard,
    onImportBoard,
    onNewBoard,
    onSaveBoard,
    onOpenBoard,
    onShowHowTo,
    onAddScribbleLayer,
    onTextureChange,
    onTextureScaleChange,
    showGridLines,
    showDragTails,
    showApron,
    currentTexture,
    textureScale,
    boardStyle,
    onBoardStyleChange,
}) => {
    const [showNewBoardConfirm, setShowNewBoardConfirm] = useState(false)
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

    const handleNewBoard = () => {
        setShowNewBoardConfirm(true)
    }

    const handleConfirmNewBoard = () => {
        onNewBoard()
        setShowNewBoardConfirm(false)
    }

    const handleCancelNewBoard = () => {
        setShowNewBoardConfirm(false)
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
                        <Icon name='close' size={20} />
                    </button>
                </div>

                <div className='sidebar-content'>
                    <button
                        className='sidebar-button sidebar-how-to'
                        onClick={onShowHowTo}
                    >
                        <span className='button-icon'>
                            <Icon name='help' />
                        </span>
                        <span>How to use Jewel VTT</span>
                        <kbd className='sidebar-kbd'>?</kbd>
                    </button>

                    <div className='sidebar-section'>
                        <h4>Board</h4>
                        <button
                            className='sidebar-button'
                            onClick={handleNewBoard}
                        >
                            <span className='button-icon'>
                                <Icon name='new-board' />
                            </span>
                            <span>New Board</span>
                        </button>

                        <button
                            className='sidebar-button'
                            onClick={onSaveBoard}
                        >
                            <span className='button-icon'>
                                <Icon name='save' />
                            </span>
                            <span>Save Board</span>
                            <kbd className='sidebar-kbd'>{MOD}S</kbd>
                        </button>

                        <button
                            className='sidebar-button'
                            onClick={onOpenBoard}
                        >
                            <span className='button-icon'>
                                <Icon name='open' />
                            </span>
                            <span>Open Board</span>
                            <kbd className='sidebar-kbd'>{MOD}O</kbd>
                        </button>

                        <button
                            className='sidebar-button'
                            onClick={handleExportBoard}
                        >
                            <span className='button-icon'>
                                <Icon name='export' />
                            </span>
                            <span>Export as PNG</span>
                            <kbd className='sidebar-kbd'>{MOD}E</kbd>
                        </button>

                        <button
                            className='sidebar-button'
                            onClick={handleImportBoard}
                        >
                            <span className='button-icon'>
                                <Icon name='import' />
                            </span>
                            <span>Import from PNG</span>
                        </button>
                    </div>

                    <div className='sidebar-section'>
                        <h4>Draw</h4>
                        <button
                            className='sidebar-button'
                            onClick={onAddScribbleLayer}
                        >
                            <span className='button-icon'>
                                <Icon name='scribble' />
                            </span>
                            <span>Add Scribble Layer</span>
                            <kbd className='sidebar-kbd'>B</kbd>
                        </button>
                    </div>

                    <div className='sidebar-section'>
                        <h4>View Settings</h4>
                        <button
                            className='sidebar-button sidebar-toggle'
                            onClick={onToggleGridLines}
                        >
                            <span className='toggle-icon'>
                                <Icon name='grid' />
                            </span>
                            <span>Grid Lines & Axes</span>
                            <span
                                className={`toggle-switch ${
                                    showGridLines ? "on" : ""
                                }`}
                                role='switch'
                                aria-checked={showGridLines}
                            />
                        </button>

                        <button
                            className='sidebar-button sidebar-toggle'
                            onClick={onToggleDragTails}
                        >
                            <span className='toggle-icon'>
                                <Icon name='trail' />
                            </span>
                            <span>Drag Tails</span>
                            <span
                                className={`toggle-switch ${
                                    showDragTails ? "on" : ""
                                }`}
                                role='switch'
                                aria-checked={showDragTails}
                            />
                        </button>

                        <button
                            className='sidebar-button sidebar-toggle'
                            onClick={onToggleApron}
                        >
                            <span className='toggle-icon'>
                                <Icon name='brush' />
                            </span>
                            <span>Tool Apron</span>
                            <span
                                className={`toggle-switch ${
                                    showApron ? "on" : ""
                                }`}
                                role='switch'
                                aria-checked={showApron}
                            />
                        </button>
                    </div>

                    <div className='sidebar-section'>
                        <h4>Board Style</h4>
                        <div
                            className='board-style-grid'
                            role='radiogroup'
                            aria-label='Board style'
                        >
                            {BOARD_STYLES.map((style) => {
                                const texture = isOpen
                                    ? getBoardStyleTexture(style.id)
                                    : null
                                return (
                                    <button
                                        key={style.id}
                                        type='button'
                                        role='radio'
                                        aria-checked={boardStyle === style.id}
                                        className={`board-style-option ${
                                            boardStyle === style.id
                                                ? "selected"
                                                : ""
                                        }`}
                                        onClick={() =>
                                            onBoardStyleChange(style.id)
                                        }
                                    >
                                        <span
                                            className='board-style-swatch'
                                            style={{
                                                backgroundColor: style.base,
                                                backgroundImage: texture
                                                    ? `url(${texture})`
                                                    : undefined,
                                            }}
                                        />
                                        <span className='board-style-label'>
                                            {style.label}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                        {currentTexture && (
                            <p className='board-style-note'>
                                A custom texture is covering the style. Clear
                                it below to see the style.
                            </p>
                        )}
                    </div>

                    <div className='sidebar-section'>
                        <h4>Custom Texture</h4>
                        {!currentTexture ? (
                            <button
                                className='sidebar-button'
                                onClick={handleTextureUpload}
                            >
                                <span className='button-icon'>
                                    <Icon name='image' />
                                </span>
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
                                    <span className='button-icon'>
                                        <Icon name='trash' />
                                    </span>
                                    <span>Clear Texture</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* New Board Confirmation Modal */}
            {showNewBoardConfirm && (
                <>
                    <div
                        className='modal-overlay'
                        onClick={handleCancelNewBoard}
                    />
                    <div className='confirmation-modal'>
                        <div className='modal-header'>
                            <h3>Create New Board</h3>
                        </div>
                        <div className='modal-content'>
                            <p>Are you sure you want to create a new board?</p>
                            <p>
                                <strong>
                                    This will clear all current content
                                    including:
                                </strong>
                            </p>
                            <ul>
                                <li>All objects and tokens</li>
                                <li>All painted areas</li>
                                <li>Background texture</li>
                                <li>Viewport position</li>
                                <li>Saved spots</li>
                            </ul>
                        </div>
                        <div className='modal-actions'>
                            <button
                                className='modal-button modal-button-cancel'
                                onClick={handleCancelNewBoard}
                            >
                                Cancel
                            </button>
                            <button
                                className='modal-button modal-button-confirm'
                                onClick={handleConfirmNewBoard}
                            >
                                Create New Board
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}
