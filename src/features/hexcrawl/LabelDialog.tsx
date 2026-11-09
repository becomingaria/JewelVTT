import React, { useCallback, useRef, useState } from "react"
import { updateHumbugs, useHumbugs } from "../board-bridge"
import { useStore } from "../store"
import { hexExt, humbugCell } from "./actions"
import { useDialogFocus } from "./hooks"
import { markerInfo } from "./markers"
import { labelEditStore } from "./state"
import { hexNumber } from "./travel"

/** Edit a hex marker's label and number (from its right-click menu) */
export const LabelDialog: React.FC = () => {
    const id = useStore(labelEditStore)
    const humbugs = useHumbugs()
    const h = id ? humbugs.find((x) => x.id === id) : undefined
    const close = useCallback(() => labelEditStore.set(null), [])
    if (!h || !hexExt(h)?.marker) return null
    return <LabelForm key={h.id} id={h.id} close={close} />
}

const LabelForm: React.FC<{ id: string; close: () => void }> = ({ id, close }) => {
    const h = useHumbugs().find((x) => x.id === id)!
    const ext = hexExt(h)!
    const [label, setLabel] = useState(ext.label ?? "")
    const [number, setNumber] = useState(ext.number ?? "")
    const ref = useRef<HTMLFormElement>(null)
    useDialogFocus(true, ref, close)
    const here = hexNumber(humbugCell(h))

    const save = (e: React.FormEvent) => {
        e.preventDefault()
        updateHumbugs([
            {
                id,
                changes: {
                    ext: {
                        ...h.ext,
                        hexcrawl: { ...ext, label: label.trim() || undefined, number: number.trim() || undefined },
                    },
                },
            },
        ])
        close()
    }

    return (
        <div className='hx-backdrop' onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <form
                ref={ref}
                className='hx-panel hx-dialog hx-dialog--small'
                role='dialog'
                aria-modal='true'
                aria-labelledby='hx-label-title'
                onSubmit={save}
            >
                <header className='hx-dialog-head'>
                    <h2 id='hx-label-title' className='hx-title'>{markerInfo(ext.marker!).label} label</h2>
                    <button type='button' className='hx-btn hx-btn--icon' aria-label='Close' onClick={close}>✕</button>
                </header>
                <div className='hx-dialog-body hx-col'>
                    <label className='hx-field'>
                        <span>Label</span>
                        <input data-autofocus type='text' maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} />
                    </label>
                    <div className='hx-row'>
                        <label className='hx-field hx-grow'>
                            <span>Hex number</span>
                            <input type='text' maxLength={8} value={number} onChange={(e) => setNumber(e.target.value)} />
                        </label>
                        <button type='button' className='hx-btn' onClick={() => setNumber(here)}>
                            Use {here}
                        </button>
                    </div>
                </div>
                <footer className='hx-dialog-foot'>
                    <button type='button' className='hx-btn' onClick={close}>Cancel</button>
                    <button type='submit' className='hx-btn hx-btn--primary'>Save</button>
                </footer>
            </form>
        </div>
    )
}
