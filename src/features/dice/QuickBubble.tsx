import React, { useEffect, useRef, useState } from "react"
import { useStore } from "../store"
import { DiceFaces, RollFlag } from "./RollResult"
import { announceStore, bubbleStore } from "./state"

/*
 * Compact result bubble beside the dock: Shift+R quick rolls, and any roll
 * made while the tray is closed. It never takes focus, pauses while hovered
 * or focused, and goes away on its own (or with its × / Esc).
 */
export const QuickBubble: React.FC = () => {
    const rec = useStore(bubbleStore)
    const [paused, setPaused] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!rec || paused) return
        const ms = rec.table || rec.error ? 9000 : 5500
        const h = setTimeout(() => bubbleStore.set((cur) => (cur === rec ? null : cur)), ms)
        return () => clearTimeout(h)
    }, [rec, paused])

    const dismiss = () => {
        if (ref.current?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur()
        bubbleStore.set(null)
        setPaused(false)
    }

    return (
        <div className='jv-bubble-host' role='status' aria-live='polite' aria-atomic='true'>
            {rec && (
                <div
                    key={rec.id}
                    ref={ref}
                    className={`jv-bubble ${rec.crit ? "jv-bubble--crit" : ""} ${rec.fumble ? "jv-bubble--fumble" : ""}`}
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                    onFocus={() => setPaused(true)}
                    onBlur={() => setPaused(false)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            e.preventDefault()
                            dismiss()
                        }
                    }}
                >
                    {rec.error ? (
                        <p className='jv-bubble-text'>
                            <strong>Couldn't roll</strong> {rec.expression}: {rec.error}
                        </p>
                    ) : rec.table ? (
                        <p className='jv-bubble-text'>
                            <strong>{rec.table.name}:</strong> {rec.table.text}
                        </p>
                    ) : (
                        <>
                            {rec.dice.length <= 4 && <DiceFaces rec={rec} size={32} />}
                            <p className='jv-bubble-text'>
                                <span className='jv-bubble-what'>
                                    {rec.label ? `${rec.label}: ` : ""}
                                    {rec.expression}
                                </span>
                                <span className='jv-bubble-total'>
                                    <span className='jv-sr'> = </span>
                                    {rec.total}
                                </span>
                                <RollFlag rec={rec} />
                            </p>
                        </>
                    )}
                    <button type='button' className='jv-btn jv-btn--icon jv-bubble-close' aria-label='Dismiss roll' onClick={dismiss}>
                        ×
                    </button>
                </div>
            )}
        </div>
    )
}

/** Hidden live region for rolls shown only as dice on the board */
export const Announcer: React.FC = () => {
    const a = useStore(announceStore)
    return (
        <div className='jv-sr' aria-live='polite' aria-atomic='true'>
            {a ? <span key={a.id}>{a.text}</span> : null}
        </div>
    )
}
