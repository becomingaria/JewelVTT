import React from "react"
import type { BoardOverlayProps } from "../types"
import type { BoardCamera } from "../board-bridge"
import { useTableMode } from "../view-state"
import { frameQuad, useFrames, usePresent, type Frame } from "./state"

/** A frame's title tab: number + title, sitting on its top-left corner */
export const FrameTab: React.FC<{
    frame: Frame
    index: number
    camera: BoardCamera
    className?: string
    onMouseDown?: (e: React.MouseEvent) => void
    onDoubleClick?: () => void
    title?: string
}> = ({ frame, index, camera, className = "", ...rest }) => {
    const p = camera.worldToScreen(frame.x, frame.y)
    return (
        <div className={`ts-frame-tab ${className}`} style={{ left: Math.round(p.x), top: Math.round(p.y) }} {...rest}>
            <span className='ts-frame-num'>{index + 1}</span>
            <span className='ts-frame-title'>{frame.title}</span>
        </div>
    )
}

/** The dashed outlines of frames, as one SVG */
export const FrameOutlines: React.FC<{ frames: Frame[]; camera: BoardCamera; className?: string }> = ({
    frames,
    camera,
    className = "",
}) => (
    <svg className={`ts-frames-svg ${className}`} width='100%' height='100%' aria-hidden='true'>
        {frames.map((f) => {
            const pts = frameQuad(camera, f)
                .map((p) => `${Math.round(p.x) + 0.5},${Math.round(p.y) + 0.5}`)
                .join(" ")
            return (
                <g key={f.id}>
                    <polygon className='ts-frame-halo' points={pts} />
                    <polygon className='ts-frame-line' points={pts} />
                </g>
            )
        })}
    </svg>
)

/**
 * Slide frames drawn below the humbugs: a dashed pixel border with a title
 * tab and number. Hidden while presenting and in Table Mode.
 */
export const FramesUnderlay: React.FC<BoardOverlayProps> = ({ camera }) => {
    const frames = useFrames()
    const tableMode = useTableMode()
    const present = usePresent()
    if (tableMode || present || !frames.length) return null

    return (
        <div className='ts-underlay' aria-hidden='true'>
            <FrameOutlines frames={frames} camera={camera} />
            {frames.map((f, i) => (
                <FrameTab key={f.id} frame={f} index={i} camera={camera} />
            ))}
        </div>
    )
}
