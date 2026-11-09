import React from "react"
import type { TokenBadgeProps } from "../types"
import { CYCLES, canCycle, cycleOf } from "./cycle"
import "./cycle.css"

/**
 * Colour-cycling overlay on a solid colour or map humbug. A tiled, dithered
 * band pattern slides in coarse steps (a transform only, so it stays on the
 * compositor). Under reduced motion it is a still pattern.
 */
export const CycleBadge: React.FC<TokenBadgeProps> = ({ humbug }) => {
    if (!canCycle(humbug)) return null
    const cycle = cycleOf(humbug)
    if (!cycle) return null
    const label = CYCLES.find((c) => c.id === cycle)?.label
    return (
        <div className={`jv-cycle jv-cycle--${cycle} jv-cycle--on-${humbug.type}`} aria-hidden='true'>
            <div className='jv-cycle-bands' />
            {/* Shown only in colour-blind-safe mode, so the effect has a name */}
            <span className='jv-cycle-tag'>{label}</span>
        </div>
    )
}
