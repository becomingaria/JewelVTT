import React, { useEffect } from "react"
import { isTypingTarget } from "../registry"
import { goToSlide, nextSlide, prevSlide, stopPresenting, usePresent, presentStore } from "./state"
import { useAwake } from "./use-awake"

/** Above this many slides the pixel dots give way to the number alone */
const MAX_DOTS = 24

/**
 * While presenting: capture the slide keys before any other hotkey
 * (arrow-nudging, letter hotkeys...) and show a small "3 / 8" indicator
 * that fades after a few idle seconds.
 */
export const PresentHud: React.FC = () => {
    const present = usePresent()
    const active = !!present
    const awake = useAwake(active, 2500, present?.index)

    useEffect(() => {
        if (!active) return
        const onKey = (e: KeyboardEvent) => {
            if (isTypingTarget(e.target)) return
            // Let Tab move focus, and Enter/Space press a focused HUD button
            if (e.key === "Tab") return
            const onButton = (e.target as HTMLElement | null)?.closest?.(".ts-present-hud button")
            if (onButton && (e.key === "Enter" || e.key === " ")) return
            // Nothing else on the board reacts while presenting
            e.stopPropagation()
            e.stopImmediatePropagation()
            if (e.metaKey || e.ctrlKey || e.altKey) return
            const s = presentStore.get()
            if (!s) return
            switch (e.key) {
                case "PageDown":
                case "ArrowRight":
                case "ArrowDown":
                case " ":
                    nextSlide()
                    break
                case "PageUp":
                case "ArrowLeft":
                case "ArrowUp":
                    prevSlide()
                    break
                case "Home":
                    goToSlide(0)
                    break
                case "End":
                    goToSlide(s.targets.length - 1)
                    break
                case "Escape":
                    stopPresenting()
                    break
                case "P":
                case "p":
                    if (!e.shiftKey) return
                    stopPresenting()
                    break
                default:
                    return
            }
            e.preventDefault()
        }
        window.addEventListener("keydown", onKey, true)
        return () => window.removeEventListener("keydown", onKey, true)
    }, [active])

    if (!present) return null
    const { targets, index } = present
    const cur = targets[index]
    const noun = cur.kind === "frame" ? "Frame" : "Spot"

    return (
        <>
            <div
                className={`ts-present-hud ${awake ? "is-awake" : ""}`}
                role='group'
                aria-label='Presentation controls'
            >
                <button
                    type='button'
                    className='ts-hud-btn'
                    onClick={prevSlide}
                    disabled={index === 0}
                    aria-label='Previous (Page Up)'
                    title='Previous (Page Up / ←)'
                >
                    <span aria-hidden='true'>◀</span>
                </button>
                <span className='ts-progress'>
                    <span className='ts-progress-num'>
                        {index + 1} / {targets.length}
                    </span>
                    {targets.length <= MAX_DOTS && (
                        <span className='ts-dots' aria-hidden='true'>
                            {targets.map((t, i) => (
                                <span key={t.id} className={`ts-dot ${i === index ? "is-on" : i < index ? "is-past" : ""}`} />
                            ))}
                        </span>
                    )}
                </span>
                <button
                    type='button'
                    className='ts-hud-btn'
                    onClick={nextSlide}
                    disabled={index === targets.length - 1}
                    aria-label='Next (Page Down)'
                    title='Next (Page Down / → / Space)'
                >
                    <span aria-hidden='true'>▶</span>
                </button>
                <button
                    type='button'
                    className='ts-hud-btn ts-hud-exit'
                    onClick={stopPresenting}
                    aria-label='Stop presenting (Esc)'
                    title='Stop presenting (Esc)'
                >
                    Esc
                </button>
            </div>
            <div className='ts-sr' aria-live='polite'>
                {`${noun} ${index + 1} of ${targets.length}: ${cur.title}`}
            </div>
        </>
    )
}
