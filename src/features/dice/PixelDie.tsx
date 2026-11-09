import React from "react"
import { DIE_GRID, dieArt, facePath } from "./pixel-art"

/** Diagonal pixel strike-through for dropped dice */
const STRIKE = Array.from({ length: 14 }, (_, i) => `M${2 + i * 2} ${27 - i * 2}h3v3h-3z`).join("")
/** Small pixel star (top-right) */
const STAR = "M27 0h2v2h2v2h-2v2h-2v-2h-2v-2h2z"
/** Small pixel crack (top-right) */
const CRACK = "M28 0h2v3h-2zM26 3h2v2h-2zM28 5h2v2h-2zM26 7h2v2h-2z"

interface PixelDieProps {
    sides: number
    value: number
    size?: number
    dropped?: boolean
    /** Natural max / natural 1 on a d20: adds a star / crack mark */
    mark?: "crit" | "fumble"
    className?: string
    /** Accessible name; omit when the surrounding text already says it */
    title?: string
}

/** One original pixel-art die showing a value */
export const PixelDie: React.FC<PixelDieProps> = ({ sides, value, size = 40, dropped, mark, className, title }) => {
    const art = dieArt(sides)
    return (
        <svg
            className={`jv-die ${dropped ? "jv-die--dropped" : ""} ${mark ? `jv-die--${mark}` : ""} ${className ?? ""}`}
            width={size}
            height={size}
            viewBox={`0 0 ${DIE_GRID} ${DIE_GRID}`}
            shapeRendering='crispEdges'
            role={title ? "img" : undefined}
            aria-label={title}
            aria-hidden={title ? undefined : true}
        >
            <path className='jv-die-body' d={art.body} />
            <path className='jv-die-light' d={art.light} />
            <path className='jv-die-shade' d={art.shade} />
            <path className='jv-die-outline' d={art.outline} />
            <path className='jv-die-ink' d={facePath(sides, value)} />
            {dropped && <path className='jv-die-strike' d={STRIKE} />}
            {mark === "crit" && <path className='jv-die-badge' d={STAR} />}
            {mark === "fumble" && <path className='jv-die-badge' d={CRACK} />}
        </svg>
    )
}
