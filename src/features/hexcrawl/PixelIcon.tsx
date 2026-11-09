import React from "react"
import { glyphSize, type Glyph } from "./pixels"

/** A pixel glyph as a crisp inline SVG (decorative: pair it with text) */
export const PixelIcon: React.FC<{
    glyph: Glyph
    palette: Record<string, string>
    size?: number
    className?: string
}> = ({ glyph, palette, size = 24, className }) => {
    const { w, h } = glyphSize(glyph)
    const rects: React.ReactNode[] = []
    glyph.forEach((row, y) => {
        let x = 0
        while (x < row.length) {
            const ch = row[x]
            let run = 1
            while (x + run < row.length && row[x + run] === ch) run++
            if (palette[ch]) rects.push(<rect key={`${x},${y}`} x={x} y={y} width={run} height={1} fill={palette[ch]} />)
            x += run
        }
    })
    const side = Math.max(w, h)
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox={`${(w - side) / 2} ${(h - side) / 2} ${side} ${side}`}
            shapeRendering='crispEdges'
            aria-hidden='true'
            focusable='false'
        >
            {rects}
        </svg>
    )
}
