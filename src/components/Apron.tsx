import React, { useState } from 'react'
import './Apron.css'

export type PaintTool = 'paint' | 'eraser' | 'dump' | null

interface ApronProps {
    isVisible: boolean
    onToolChange: (tool: PaintTool) => void
    onColorChange: (color: string) => void
    onDumpFill: () => void
    activeTool: PaintTool
    selectedColor: string
}

export const Apron: React.FC<ApronProps> = ({ 
    isVisible, 
    onToolChange, 
    onColorChange, 
    onDumpFill,
    activeTool,
    selectedColor 
}) => {
    const [showColorPicker, setShowColorPicker] = useState(false)

    if (!isVisible) return null

    const handleToolSelect = (tool: PaintTool) => {
        if (tool === 'dump') {
            onDumpFill()
        } else {
            onToolChange(tool)
        }
    }

    return (
        <div className="apron">
            <div className="apron-content">
                {/* Color Picker */}
                <div className="color-picker-section">
                    <div 
                        className="current-color"
                        style={{ backgroundColor: selectedColor }}
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        title="Click to change color"
                    />
                    {showColorPicker && (
                        <div className="color-picker-dropdown">
                            <input
                                type="color"
                                value={selectedColor}
                                onChange={(e) => onColorChange(e.target.value)}
                                className="color-input"
                            />
                            <div className="preset-colors">
                                {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#000000', '#ffffff'].map(color => (
                                    <div
                                        key={color}
                                        className="preset-color"
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
                <div className="tool-buttons">
                    <button
                        className={`tool-button ${activeTool === 'paint' ? 'active' : ''}`}
                        onClick={() => handleToolSelect('paint')}
                        title="Paint Tool - Click squares to fill with color"
                    >
                        🖌️
                    </button>
                    
                    <button
                        className={`tool-button ${activeTool === 'eraser' ? 'active' : ''}`}
                        onClick={() => handleToolSelect('eraser')}
                        title="Eraser Tool - Click squares to erase color"
                    >
                        🧽
                    </button>
                    
                    <button
                        className="tool-button dump-button"
                        onClick={() => handleToolSelect('dump')}
                        title="Dump Fill - Fill entire board with selected color"
                    >
                        🪣
                    </button>
                    
                    <button
                        className={`tool-button ${activeTool === null ? 'active' : ''}`}
                        onClick={() => handleToolSelect(null)}
                        title="No Tool - Normal interaction mode"
                    >
                        ✋
                    </button>
                </div>
            </div>
        </div>
    )
}
