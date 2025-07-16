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
                    stroke='white'
                    strokeWidth='3'
                    strokeDasharray='5,5'
                    opacity='0.9'
                />
                {/* Black outline for main line */}
                <line
                    x1={startScreen.x}
                    y1={startScreen.y}
                    x2={currentScreen.x}
                    y2={currentScreen.y}
                    stroke='black'
                    strokeWidth='5'
                    strokeDasharray='5,5'
                    opacity='0.6'
                    style={{ zIndex: -1 }}
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
                            {/* Black outline for ruler mark */}
                            <line
                                x1={markX1}
                                y1={markY1}
                                x2={markX2}
                                y2={markY2}
                                stroke='black'
                                strokeWidth='4'
                                opacity='0.6'
                            />
                            {/* White ruler mark */}
                            <line
                                x1={markX1}
                                y1={markY1}
                                x2={markX2}
                                y2={markY2}
                                stroke='white'
                                strokeWidth='2'
                                opacity='0.9'
                            />

                            {/* Distance label every 5 units or at major intervals */}
                            {(index + 1) % 5 === 0 && (
                                <>
                                    {/* Black outline for text */}
                                    <text
                                        x={markerScreen.x}
                                        y={markerScreen.y - 12}
                                        fill='black'
                                        fontSize='12'
                                        fontWeight='bold'
                                        textAnchor='middle'
                                        className='drag-tail-label'
                                        stroke='black'
                                        strokeWidth='3'
                                        opacity='0.6'
                                    >
                                        {index + 1}
                                    </text>
                                    {/* White text */}
                                    <text
                                        x={markerScreen.x}
                                        y={markerScreen.y - 12}
                                        fill='white'
                                        fontSize='12'
                                        fontWeight='bold'
                                        textAnchor='middle'
                                        className='drag-tail-label'
                                    >
                                        {index + 1}
                                    </text>
                                </>
                            )}
                        </g>
                    )
                })}

                {/* Start point indicator */}
                <circle
                    cx={startScreen.x}
                    cy={startScreen.y}
                    r='6'
                    fill='black'
                    opacity='0.6'
                />
                <circle
                    cx={startScreen.x}
                    cy={startScreen.y}
                    r='4'
                    fill='white'
                    opacity='0.9'
                />

                {/* Current position indicator */}
                <circle
                    cx={currentScreen.x}
                    cy={currentScreen.y}
                    r='5'
                    fill='black'
                    opacity='0.6'
                />
                <circle
                    cx={currentScreen.x}
                    cy={currentScreen.y}
                    r='3'
                    fill='white'
                    opacity='0.9'
                />

                {/* Distance display */}
                {/* Black outline for distance text */}
                <text
                    x={currentScreen.x + 10}
                    y={currentScreen.y - 10}
                    fill='black'
                    fontSize='14'
                    fontWeight='bold'
                    className='drag-tail-distance'
                    stroke='black'
                    strokeWidth='3'
                    opacity='0.6'
                >
                    {dragTail.distance.toFixed(1)} units
                </text>
                {/* White distance text */}
                <text
                    x={currentScreen.x + 10}
                    y={currentScreen.y - 10}
                    fill='white'
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
