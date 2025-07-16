import React from "react"
import type { DragTail, Point } from "../types/humbug.types"
import "./DragTailRenderer.css"

interface DragTailRendererProps {
    dragTail: DragTail
    worldToScreen: (worldX: number, worldY: number) => Point
}

export const DragTailRenderer: React.FC<DragTailRendererProps> = ({
    dragTail,
    worldToScreen,
}) => {
    const startScreen = worldToScreen(
        dragTail.startPoint.x,
        dragTail.startPoint.y
    )
    const currentScreen = worldToScreen(
        dragTail.currentPoint.x,
        dragTail.currentPoint.y
    )

    // Calculate the angle for the ruler markings
    const angle = Math.atan2(
        currentScreen.y - startScreen.y,
        currentScreen.x - startScreen.x
    )

    return (
        <div className='drag-tail-container'>
            {/* Main drag line */}
            <svg
                className='drag-tail-svg'
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    zIndex: 50, // Above humbugs but below UI
                }}
            >
                {/* Main line */}
                <line
                    x1={startScreen.x}
                    y1={startScreen.y}
                    x2={currentScreen.x}
                    y2={currentScreen.y}
                    stroke='#ff6b35'
                    strokeWidth='2'
                    strokeDasharray='5,5'
                    opacity='0.8'
                />

                {/* Distance markers (ruler marks) */}
                {dragTail.markers.map((marker, index) => {
                    const markerScreen = worldToScreen(marker.x, marker.y)

                    // Calculate perpendicular line for ruler mark
                    const markLength = 8
                    const perpAngle = angle + Math.PI / 2
                    const markX1 =
                        markerScreen.x - Math.cos(perpAngle) * markLength
                    const markY1 =
                        markerScreen.y - Math.sin(perpAngle) * markLength
                    const markX2 =
                        markerScreen.x + Math.cos(perpAngle) * markLength
                    const markY2 =
                        markerScreen.y + Math.sin(perpAngle) * markLength

                    return (
                        <g key={index}>
                            {/* Ruler mark */}
                            <line
                                x1={markX1}
                                y1={markY1}
                                x2={markX2}
                                y2={markY2}
                                stroke='#ff6b35'
                                strokeWidth='2'
                                opacity='0.9'
                            />

                            {/* Distance label every 5 units or at major intervals */}
                            {(index + 1) % 5 === 0 && (
                                <text
                                    x={markerScreen.x}
                                    y={markerScreen.y - 12}
                                    fill='#ff6b35'
                                    fontSize='12'
                                    fontWeight='bold'
                                    textAnchor='middle'
                                    className='drag-tail-label'
                                >
                                    {index + 1}
                                </text>
                            )}
                        </g>
                    )
                })}

                {/* Start point indicator */}
                <circle
                    cx={startScreen.x}
                    cy={startScreen.y}
                    r='4'
                    fill='#ff6b35'
                    opacity='0.9'
                />

                {/* Current position indicator */}
                <circle
                    cx={currentScreen.x}
                    cy={currentScreen.y}
                    r='3'
                    fill='#ff6b35'
                    opacity='0.7'
                />

                {/* Distance display */}
                <text
                    x={currentScreen.x + 10}
                    y={currentScreen.y - 10}
                    fill='#ff6b35'
                    fontSize='14'
                    fontWeight='bold'
                    className='drag-tail-distance'
                >
                    {dragTail.distance.toFixed(1)} units
                </text>
            </svg>
        </div>
    )
}
