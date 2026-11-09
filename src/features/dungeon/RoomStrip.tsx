import React from "react"
import { useStore } from "../store"
import { setActiveTool } from "../view-state"
import { requestPanelFocus } from "./panel-focus"
import { panelStore, roomModeStore, type RoomMode } from "./state"

const MODES: { id: RoomMode; label: string; glyph: string }[] = [
    { id: "room", label: "Room", glyph: "▭" },
    { id: "corridor", label: "Corridor", glyph: "⌐" },
    { id: "erase", label: "Erase", glyph: "⌫" },
]

/** Options strip shown while the floor tool (W) is active */
export const RoomStrip: React.FC = () => {
    const { mode } = useStore(roomModeStore)
    return (
        <div className='dgn-panel dgn-strip' role='group' aria-label='Floor tool options'>
            <span className='dgn-strip-title'>Floor</span>
            <div className='dgn-seg' role='group' aria-label='Shape'>
                {MODES.map((m) => (
                    <button
                        key={m.id}
                        type='button'
                        aria-pressed={mode === m.id}
                        onClick={() => roomModeStore.set({ mode: m.id })}
                    >
                        <span aria-hidden='true' className='dgn-glyph'>
                            {m.glyph}
                        </span>
                        {m.label}
                    </button>
                ))}
            </div>
            <span className='dgn-hint'>Drag on the grid · hold Alt to erase · Esc to finish</span>
            <button
                type='button'
                onClick={() => document.querySelector<HTMLElement>(".dgn-input")?.focus()}
                title='Draw with the arrow keys and Enter'
            >
                Use keys
            </button>
            <button
                type='button'
                onClick={() => {
                    requestPanelFocus()
                    panelStore.set("generator")
                }}
            >
                Generate…
            </button>
            <button type='button' onClick={() => setActiveTool(null)}>
                Done
            </button>
        </div>
    )
}
