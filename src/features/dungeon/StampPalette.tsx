import React, { useRef } from "react"
import { useStore } from "../store"
import { setActiveTool, useActiveTool } from "../view-state"
import { PALETTE } from "./humbugs"
import { STAMP_TOOL } from "./model"
import { usePanelFocus } from "./panel-focus"
import { spriteUrl } from "./sprites"
import { paletteOpenStore, pickedStampStore } from "./state"

/** Docked palette of pixel stamps. Pick one, then click the map. */
export const StampPalette: React.FC = () => {
    const picked = useStore(pickedStampStore)
    const tool = useActiveTool()
    const ref = useRef<HTMLElement>(null)
    usePanelFocus(ref, ".dgn-stamp")
    const placing = tool === STAMP_TOOL

    const pick = (id: string) => {
        if (placing && picked === id) {
            setActiveTool(null)
            return
        }
        pickedStampStore.set(id)
        setActiveTool(STAMP_TOOL)
    }

    const current = PALETTE.find((p) => p.id === picked)

    return (
        <section
            ref={ref}
            className='dgn-panel dgn-palette'
            role='dialog'
            aria-labelledby='dgn-palette-title'
            onKeyDown={(e) => {
                // Esc ends placing first (the host does that); then closes
                if (e.key === "Escape" && !placing) {
                    e.stopPropagation()
                    paletteOpenStore.set(false)
                }
            }}
        >
            <header className='dgn-panel-head'>
                <h2 id='dgn-palette-title'>Stamps</h2>
                <button
                    type='button'
                    className='dgn-icon-btn'
                    aria-label='Close stamps'
                    title='Close (S)'
                    onClick={() => {
                        if (placing) setActiveTool(null)
                        paletteOpenStore.set(false)
                    }}
                >
                    ×
                </button>
            </header>
            <p className='dgn-hint' aria-live='polite'>
                {placing && current
                    ? `Placing ${current.label}: click squares on the map. Esc to stop.`
                    : "Pick a stamp, then click the map."}
            </p>
            <div className='dgn-stamp-grid' role='group' aria-label='Stamps'>
                {PALETTE.map((p) => (
                    <button
                        key={p.id}
                        type='button'
                        className='dgn-stamp'
                        aria-pressed={placing && picked === p.id}
                        onClick={() => pick(p.id)}
                    >
                        <img src={spriteUrl(p.stamp, p.state)} alt='' width={32} height={32} />
                        <span>{p.label}</span>
                    </button>
                ))}
            </div>
            <p className='dgn-hint dgn-hint--small'>
                Secret doors and traps go on the GM-only layer. Right-click one on the map to reveal it.
            </p>
        </section>
    )
}
