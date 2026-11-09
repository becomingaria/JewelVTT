import React from "react"
import type { TokenBadgeProps } from "../types"
import { useStore } from "../store"
import { useTableMode } from "../view-state"
import { CONDITIONS, HP_BAND_LABEL, conditionLabel, hpBand } from "./logic"
import { initStore, partyStore } from "./state"
import { sideOf } from "./actions"
import { ConditionGlyph } from "./icons"

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Conditions in the canonical order (unknown ids last) */
const sortConditions = (ids: string[]) => {
    const rank = (id: string) => {
        const i = CONDITIONS.findIndex((c) => c.id === id)
        return i < 0 ? 99 : i
    }
    return [...ids].sort((a, b) => rank(a) - rank(b))
}

/**
 * Drawn on every token: the active-turn ring, a pixel HP bar underneath
 * and condition pips on top. Nothing for other humbugs.
 */
export const TrackerBadge: React.FC<TokenBadgeProps> = ({ humbug, scale }) => {
    const init = useStore(initStore)
    const tableMode = useTableMode()
    useStore(partyStore) // party membership decides whose numbers players see

    if (humbug.type !== "token") return null
    const isActive = init.order[init.active]?.id === humbug.id
    const hp = humbug.hp
    const conditions = sortConditions(humbug.conditions ?? [])
    if (!hp && !conditions.length && !isActive) return null

    const width = Math.max(28, humbug.size.width * scale)
    const barH = clamp(Math.round(6 * scale), 5, 10)
    const pip = clamp(Math.round(14 * scale), 12, 22)
    const showNumbers = !tableMode || sideOf(humbug) === "party"

    let hpEl: React.ReactNode = null
    if (hp && hp.max > 0) {
        const band = hpBand(hp.current, hp.max)
        const pct = clamp(hp.current / hp.max, 0, 1) * 100
        // Segment marks: one per hit point up to 10, else tenths
        const segs = Math.min(hp.max, 10)
        const text = showNumbers
            ? `Hit points ${hp.current} of ${hp.max} (${HP_BAND_LABEL[band].toLowerCase()})`
            : `Hit points: ${HP_BAND_LABEL[band].toLowerCase()}`
        hpEl = (
            <div
                className={`tracker-hp tracker-hp--${band}`}
                style={{ width, top: `calc(100% + ${Math.max(2, 3 * scale)}px)` }}
                role='img'
                aria-label={text}
                title={text}
            >
                <div className='tracker-hp-bar' style={{ height: barH }}>
                    <div className='tracker-hp-fill' style={{ width: `${pct}%` }} />
                    <div
                        className='tracker-hp-segs'
                        style={{ backgroundSize: `${100 / segs}% 100%` }}
                        aria-hidden='true'
                    />
                </div>
                {showNumbers && scale >= 0.55 && (
                    <span className='tracker-hp-num' aria-hidden='true' style={{ fontSize: clamp(10 * scale, 10, 14) }}>
                        {hp.current}/{hp.max}
                    </span>
                )}
            </div>
        )
    }

    return (
        <>
            {isActive && (
                <div className='tracker-ring' role='img' aria-label='Has the turn' title='Has the turn'>
                    <span className='tracker-ring-arrow' aria-hidden='true' />
                </div>
            )}
            {conditions.length > 0 && (
                <div
                    className='tracker-pips'
                    style={{ width: Math.max(width, pip * 2), bottom: `calc(100% + ${Math.max(2, 3 * scale)}px)` }}
                    role='group'
                    aria-label={`Conditions: ${conditions.map(conditionLabel).join(", ")}`}
                >
                    {conditions.map((c) => (
                        <span key={c} className='tracker-pip' role='img' aria-label={conditionLabel(c)} title={conditionLabel(c)}>
                            <ConditionGlyph id={c} size={pip} />
                        </span>
                    ))}
                </div>
            )}
            {hpEl}
        </>
    )
}
