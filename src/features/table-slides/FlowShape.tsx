import React from "react"
import type { TextHumbug } from "../../types/humbug.types"
import { shapeGeometry, type FlowShape } from "./shapes"

const INK = "var(--jv-ink, var(--jv-panel-fg, #1d1b26))"
const PAPER = "var(--jv-paper, var(--jv-panel-bg, #fffdf4))"

/** Small preview of a shape for buttons (24×24, currentColor) */
export const ShapeGlyph: React.FC<{ shape: FlowShape | null; size?: number }> = ({ shape, size = 24 }) => {
    const g = shape ? shapeGeometry(shape, 20, 14, 1) : null
    return (
        <svg width={size} height={size} viewBox='-2 -5 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinejoin='round' aria-hidden='true'>
            {g ? (
                <>
                    <path d={g.d} />
                    {g.detail && <path d={g.detail} />}
                </>
            ) : (
                <rect x='1' y='1' width='18' height='12' strokeDasharray='3 2' />
            )}
        </svg>
    )
}

/**
 * A text humbug drawn as a flowchart shape: the outline in the humbug's
 * background colour with a crisp 2px ink line, and the text centred inside.
 * Rendered by HumbugRenderer in place of the plain text box.
 */
export const FlowShapeText: React.FC<{ humbug: TextHumbug; shape: FlowShape; scale: number }> = ({
    humbug,
    shape,
    scale,
}) => {
    const w = humbug.size.width * scale
    const h = humbug.size.height * scale
    const g = shapeGeometry(shape, w, h, 1)
    const fill = humbug.backgroundColor && humbug.backgroundColor !== "transparent" ? humbug.backgroundColor : PAPER
    return (
        <div className='ts-flow' data-shape={shape} style={{ width: w, height: h }}>
            <svg className='ts-flow-svg' width={w} height={h} aria-hidden='true'>
                <path d={g.d} fill={fill} stroke={INK} strokeWidth={2} strokeLinejoin='round' />
                {g.detail && <path d={g.detail} fill='none' stroke={INK} strokeWidth={2} strokeLinejoin='round' />}
            </svg>
            <div
                className='ts-flow-text'
                style={{
                    fontSize: humbug.fontSize * scale,
                    fontFamily: humbug.fontFamily,
                    color: humbug.color,
                    textAlign: humbug.textAlign || "center",
                    justifyContent:
                        humbug.textAlign === "left" ? "flex-start" : humbug.textAlign === "right" ? "flex-end" : "center",
                    paddingTop: g.pad.top,
                    paddingRight: g.pad.right,
                    paddingBottom: g.pad.bottom,
                    paddingLeft: g.pad.left,
                }}
            >
                <span>{humbug.content || "Double-click to edit"}</span>
            </div>
        </div>
    )
}
