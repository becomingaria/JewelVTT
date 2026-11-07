import React, { useState } from "react"
import { Icon } from "./Icon"
import "./Apron.css"

export type PaintTool = "paint" | "eraser" | "dump" | null

/** Paint colour that clears squares back to the bare board */
export const TRANSPARENT = "transparent"

interface ApronProps {
    isVisible: boolean
    onToolChange: (tool: PaintTool) => void
    onColorChange: (color: string) => void
    activeTool: PaintTool
    selectedColor: string
}

export const Apron: React.FC<ApronProps> = ({
    isVisible,
    onToolChange,
    onColorChange,
    activeTool,
    selectedColor,
}) => {
    const [showColorPicker, setShowColorPicker] = useState(false)

    if (!isVisible) return null

    // Dump is a tool like the others: pick it, then click the board to fill
    const handleToolSelect = (tool: PaintTool) => onToolChange(tool)
    const isTransparent = selectedColor === TRANSPARENT

    return (
        <div className='apron'>
            <div className='apron-content'>
                {/* Color Picker */}
                <div className='color-picker-section'>
                    <div
                        className={`current-color ${
                            isTransparent ? "is-transparent" : ""
                        }`}
                        style={
                            isTransparent
                                ? undefined
                                : { backgroundColor: selectedColor }
                        }
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        title={
                            isTransparent
                                ? "Transparent: clears squares (click to change)"
                                : "Click to change color"
                        }
                    />
                    {showColorPicker && (
                        <div className='color-picker-dropdown'>
                            <button
                                type='button'
                                className={`transparent-option ${
                                    isTransparent ? "active" : ""
                                }`}
                                onClick={() => {
                                    onColorChange(TRANSPARENT)
                                    setShowColorPicker(false)
                                }}
                                title='Transparent: paints the board back to bare'
                            >
                                <span className='transparent-swatch' />
                                Transparent
                            </button>
                            <input
                                type='color'
                                value={isTransparent ? "#000000" : selectedColor}
                                onChange={(e) => onColorChange(e.target.value)}
                                className='color-input'
                            />
                            <div className='preset-colors'>
                                {[
                                    // Natural earth tones
                                    "#8B4513", // Saddle Brown
                                    "#A0522D", // Sienna
                                    "#CD853F", // Peru
                                    "#DEB887", // Burlywood
                                    "#F5DEB3", // Wheat
                                    "#D2B48C", // Tan

                                    // Greys
                                    "#000000", // Black
                                    "#2F2F2F", // Dark Grey
                                    "#696969", // Dim Grey
                                    "#808080", // Grey
                                    "#A9A9A9", // Dark Grey
                                    "#D3D3D3", // Light Grey
                                    "#F5F5F5", // White Smoke
                                    "#FFFFFF", // White

                                    // Natural greens
                                    "#556B2F", // Dark Olive Green
                                    "#6B8E23", // Olive Drab
                                    "#808000", // Olive
                                    "#9ACD32", // Yellow Green
                                    "#228B22", // Forest Green
                                    "#32CD32", // Lime Green
                                    "#90EE90", // Light Green

                                    // Additional natural tones
                                    "#8FBC8F", // Dark Sea Green
                                    "#BC8F8F", // Rosy Brown
                                    "#F4A460", // Sandy Brown
                                    "#DAA520", // Goldenrod
                                    "#B8860B", // Dark Goldenrod
                                    "#4682B4", // Steel Blue
                                    "#708090", // Slate Grey
                                    "#2F4F4F", // Dark Slate Grey
                                ].map((color) => (
                                    <div
                                        key={color}
                                        className='preset-color'
                                        style={{ backgroundColor: color }}
                                        onClick={() => {
                                            onColorChange(color)
                                            setShowColorPicker(false)
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Tool Buttons */}
                <div className='tool-buttons'>
                    <button
                        className={`tool-button ${
                            activeTool === "paint" ? "active" : ""
                        }`}
                        onClick={() => handleToolSelect("paint")}
                        title='Paint Tool - Click squares to fill with color'
                    >
                        <Icon name='brush' size={26} />
                    </button>

                    <button
                        className={`tool-button ${
                            activeTool === "eraser" ? "active" : ""
                        }`}
                        onClick={() => handleToolSelect("eraser")}
                        title='Eraser Tool - Click squares to erase color'
                    >
                        <Icon name='eraser' size={26} />
                    </button>

                    <button
                        className={`tool-button ${
                            activeTool === "dump" ? "active" : ""
                        }`}
                        onClick={() => handleToolSelect("dump")}
                        title='Dump Fill - click the board to fill that area'
                    >
                        <Icon name='bucket' size={26} />
                    </button>

                    <button
                        className={`tool-button ${
                            activeTool === null ? "active" : ""
                        }`}
                        onClick={() => handleToolSelect(null)}
                        title='No Tool - Normal interaction mode'
                    >
                        <Icon name='hand' size={26} />
                    </button>
                </div>
            </div>
        </div>
    )
}
