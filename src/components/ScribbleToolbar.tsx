import React from "react"
import { Icon } from "./Icon"
import {
    SCRIBBLE_COLORS,
    SCRIBBLE_SIZES,
    type ScribbleSettings,
} from "../types/scribble.types"
import "./ScribbleToolbar.css"

interface ScribbleToolbarProps {
    layerName: string
    settings: ScribbleSettings
    onChange: (settings: ScribbleSettings) => void
    onDone: () => void
}

/** Floating controls shown while the scribble pencil is on */
export const ScribbleToolbar: React.FC<ScribbleToolbarProps> = ({
    layerName,
    settings,
    onChange,
    onDone,
}) => (
    <div className='scribble-toolbar' role='toolbar' aria-label='Scribble tools'>
        <span className='scribble-toolbar-layer' title='Drawing on this layer'>
            <Icon name='scribble' size={18} />
            {layerName}
        </span>

        <div className='scribble-toolbar-group' role='radiogroup' aria-label='Tool'>
            <button
                type='button'
                role='radio'
                aria-checked={settings.tool === "pencil"}
                className={settings.tool === "pencil" ? "active" : ""}
                onClick={() => onChange({ ...settings, tool: "pencil" })}
                title='Pencil'
            >
                <Icon name='edit' size={18} />
            </button>
            <button
                type='button'
                role='radio'
                aria-checked={settings.tool === "eraser"}
                className={settings.tool === "eraser" ? "active" : ""}
                onClick={() => onChange({ ...settings, tool: "eraser" })}
                title='Eraser: drag over strokes to remove them'
            >
                <Icon name='eraser' size={18} />
            </button>
        </div>

        <div className='scribble-toolbar-group' role='radiogroup' aria-label='Colour'>
            {SCRIBBLE_COLORS.map((c) => (
                <button
                    key={c.value}
                    type='button'
                    role='radio'
                    aria-checked={settings.color === c.value}
                    aria-label={c.name}
                    title={c.name}
                    className={`scribble-swatch ${settings.color === c.value ? "active" : ""}`}
                    style={{ background: c.value }}
                    onClick={() => onChange({ ...settings, color: c.value, tool: "pencil" })}
                />
            ))}
        </div>

        <div className='scribble-toolbar-group' role='radiogroup' aria-label='Size'>
            {SCRIBBLE_SIZES.map((s) => (
                <button
                    key={s.value}
                    type='button'
                    role='radio'
                    aria-checked={settings.size === s.value}
                    aria-label={s.name}
                    title={s.name}
                    className={settings.size === s.value ? "active" : ""}
                    onClick={() => onChange({ ...settings, size: s.value, tool: "pencil" })}
                >
                    <span
                        className='scribble-size-dot'
                        style={{ width: 3 + s.value, height: 3 + s.value }}
                    />
                </button>
            ))}
        </div>

        <button type='button' className='scribble-toolbar-done' onClick={onDone}>
            Done
        </button>
    </div>
)
