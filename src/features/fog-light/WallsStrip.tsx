import React, { useState } from "react"
import { usePrefs } from "../prefs"
import { useStore } from "../store"
import { setActiveTool, useTableMode } from "../view-state"
import { MOD } from "../../utils/hotkeys"
import { showToast } from "../../utils/toast"
import { WallIcon } from "./icons"
import { commitWalls, useWalls, wallsStore } from "./sight"
import { wallModeStore } from "./walls-mode"

/**
 * Options for the Sight walls tool, beside the dock while it's active.
 */
export const WallsStrip: React.FC = () => {
    const walls = useWalls()
    const mode = useStore(wallModeStore).mode
    const tableMode = useTableMode()
    const { confirmDestructive } = usePrefs()
    const [confirming, setConfirming] = useState(false)

    const clearAll = () => {
        setConfirming(false)
        commitWalls("Clear sight walls", wallsStore.get(), [])
        showToast(`Sight walls cleared. Undo with ${MOD}Z.`)
    }

    return (
        <section className={`fogl-strip ${tableMode ? "is-table" : ""}`} aria-labelledby='fogl-walls-title'>
            <div className='fogl-strip-head'>
                <h2 id='fogl-walls-title' className='fogl-strip-title'>
                    <span className='fogl-strip-icon' aria-hidden='true'>
                        <WallIcon />
                    </span>
                    Sight walls
                </h2>
                <button
                    type='button'
                    className='fogl-btn fogl-close'
                    aria-label='Close sight walls'
                    title='Close (Esc)'
                    onClick={() => setActiveTool(null)}
                >
                    <span aria-hidden='true'>×</span>
                </button>
            </div>

            <div className='fogl-row' role='group' aria-label='Walls tool'>
                <button
                    type='button'
                    className='fogl-btn fogl-wide'
                    aria-pressed={mode === "draw"}
                    onClick={() => wallModeStore.set({ mode: "draw" })}
                >
                    Draw
                </button>
                <button
                    type='button'
                    className='fogl-btn fogl-wide'
                    aria-pressed={mode === "erase"}
                    onClick={() => wallModeStore.set({ mode: "erase" })}
                >
                    Erase
                </button>
            </div>

            <p className='fogl-hint'>
                {mode === "draw"
                    ? "Drag along the walls in your map picture. Ends snap to grid corners; hold Alt to draw freely. Right-drag erases."
                    : "Drag over walls to rub them out."}{" "}
                Tokens and lights can't see through these. Players never see the lines. Esc closes.
            </p>
            <p className='fogl-hint'>
                Dungeon rooms already have walls. Pillars, statues and closed doors block sight too: switch it for any
                object in its Edit dialog or right-click menu.
            </p>

            {confirming ? (
                <div className='fogl-row' role='group' aria-label='Confirm clearing every sight wall'>
                    <button type='button' className='fogl-btn' autoFocus onClick={clearAll}>
                        Clear {walls.length} walls
                    </button>
                    <button type='button' className='fogl-btn' onClick={() => setConfirming(false)}>
                        Keep them
                    </button>
                </div>
            ) : (
                <div className='fogl-row'>
                    <span className='fogl-label' role='status' aria-live='polite'>
                        {walls.length} wall{walls.length === 1 ? "" : "s"}
                    </span>
                    <button
                        type='button'
                        className='fogl-btn'
                        disabled={!walls.length}
                        onClick={() => (confirmDestructive ? setConfirming(true) : clearAll())}
                    >
                        Clear all
                    </button>
                </div>
            )}
        </section>
    )
}
