import React from "react"
import type { DragTail, Point } from "../types/humbug.types"
import type { DragTailStyleId } from "../utils/drag-tail-styles"
import { renderTail, tailDefs } from "./drag-tail-art"
import "./DragTailRenderer.css"

interface DragTailRendererProps {
    dragTail: DragTail
    worldToScreen: (worldX: number, worldY: number) => Point
    tailStyle?: DragTailStyleId
}

export const DragTailRenderer: React.FC<DragTailRendererProps> = ({
    dragTail,
    worldToScreen,
    tailStyle = "ruler",
}) => {
    const start = worldToScreen(dragTail.startPoint.x, dragTail.startPoint.y)
    const end = worldToScreen(dragTail.currentPoint.x, dragTail.currentPoint.y)
    const marks = dragTail.markers.map((m) => worldToScreen(m.x, m.y))

    return (
        <div className='drag-tail-container'>
            <svg className='drag-tail-svg'>
                {tailDefs()}
                {renderTail(tailStyle, { start, end, marks, distance: dragTail.distance })}
            </svg>
        </div>
    )
}
