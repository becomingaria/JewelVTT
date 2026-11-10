import React from "react"
import { tableModeStore } from "../view-state"
import { useStore } from "../store"
import { toggleTableMode, usePresent } from "./state"
import { useAwake, usePointerAutoHide } from "./use-awake"
import { TableModeIcon } from "./icons"

/**
 * Table Mode extras: the pointer hides after 3s idle, and a small "Exit
 * Table Mode" button fades in at the top-right corner on pointer movement
 * or keyboard focus. Esc deliberately doesn't exit (too easy to hit).
 */
export const TableModeChrome: React.FC = () => {
    const tableMode = useStore(tableModeStore)
    const present = usePresent()
    usePointerAutoHide(tableMode || !!present)
    const showExit = tableMode && !present
    const awake = useAwake(showExit, 3000)
    if (!showExit) return null
    return (
        <button
            type='button'
            className={`ts-exit-table ${awake ? "is-awake" : ""}`}
            onClick={toggleTableMode}
            aria-keyshortcuts='Shift+T'
            title='Back to the GM view (Shift+T)'
        >
            <span className='ts-exit-icon' aria-hidden='true'>
                {TableModeIcon}
            </span>
            Exit Table Mode
        </button>
    )
}
