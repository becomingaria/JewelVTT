import React, { useEffect, useId, useState } from "react"
import type { GridShape } from "../../utils/board-styles"
import { viewCentreWorld } from "../board-bridge"
import { useStore } from "../store"
import { TEMPLATE_SHAPES, canRotate, type TemplateShape } from "./geometry"
import type { MeasureReadout, Scale } from "./describe"
import {
    clearAllTemplates,
    clearMeasurement,
    deleteSelected,
    finishMeasurement,
    placeTemplateAt,
    rotateSelected,
    selectNextTemplate,
} from "./actions"
import {
    BurstIcon,
    ConeIcon,
    LineIcon,
    RotateLeftIcon,
    RotateRightIcon,
    RulerIcon,
    SquareIcon,
    TemplateIcon,
} from "./icons"
import {
    measurePrefsStore,
    measureStore,
    nextSize,
    selectedTemplateStore,
    setNextSize,
    templatesStore,
} from "./state"

/*
 * The small strip along the bottom edge of the board while a measure tool
 * is active. Plain buttons and one number field: fully keyboard operable.
 */

const SHAPE_ICONS: Record<TemplateShape, React.ReactElement> = {
    cone: ConeIcon,
    line: LineIcon,
    burst: BurstIcon,
    square: SquareIcon,
}

const Glyph: React.FC<{ icon: React.ReactElement }> = ({ icon }) => (
    <span className='measure-glyph' aria-hidden='true'>
        {icon}
    </span>
)

export const RulerStrip: React.FC<{ shape: GridShape; readout: MeasureReadout | null }> = ({
    shape,
    readout,
}) => {
    const prefs = useStore(measurePrefsStore)
    const m = useStore(measureStore)
    const titleId = useId()
    const setRule = (rule: "alternate" | "simple") => measurePrefsStore.set((p) => ({ ...p, rule }))
    return (
        <div className='measure-strip' role='group' aria-labelledby={titleId} data-measure-ui>
            <Glyph icon={RulerIcon} />
            <span className='measure-strip-title' id={titleId}>
                Measure
            </span>
            {shape === "square" ? (
                <div className='measure-seg' role='group' aria-label='Diagonal rule'>
                    <button
                        type='button'
                        aria-pressed={prefs.rule === "alternate"}
                        onClick={() => setRule("alternate")}
                        title='Every second diagonal step counts double (1, 2, 1, 2...)'
                    >
                        1-2-1 diagonals
                    </button>
                    <button
                        type='button'
                        aria-pressed={prefs.rule === "simple"}
                        onClick={() => setRule("simple")}
                        title='Every step counts one, diagonals too'
                    >
                        Simple
                    </button>
                </div>
            ) : (
                <span className='measure-strip-note'>Counting hexes</span>
            )}
            <span className='measure-strip-readout'>
                {readout
                    ? `${readout.unitsText} · ${readout.cellsText}${readout.speedText ? ` · ${readout.speedText}` : ""}`
                    : "Drag to measure. Click to add waypoints."}
            </span>
            <button type='button' onClick={finishMeasurement} disabled={!m || m.done} title='Finish (Enter or double-click)'>
                Finish
            </button>
            <button type='button' onClick={clearMeasurement} disabled={!m}>
                Clear
            </button>
        </div>
    )
}

const SizeField: React.FC<{ shape: TemplateShape; scale: Scale }> = ({ shape, scale }) => {
    useStore(measurePrefsStore) // re-render when sizes change
    const size = nextSize(shape, scale.unit)
    const [draft, setDraft] = useState(String(size))
    const id = useId()
    // Follow outside changes (shape switch, +/- buttons, other unit)
    useEffect(() => setDraft(String(size)), [size])
    const info = TEMPLATE_SHAPES.find((s) => s.id === shape)!
    const step = scale.perCell
    const set = (n: number) => {
        if (Number.isFinite(n) && n > 0) setNextSize(shape, scale.unit, Math.min(n, 9999))
    }
    return (
        <div className='measure-size'>
            <button type='button' aria-label={`Smaller ${info.sizeLabel}`} onClick={() => set(Math.max(step, size - step))}>
                −
            </button>
            <label htmlFor={id} className='measure-size-label'>
                {info.sizeLabel[0].toUpperCase() + info.sizeLabel.slice(1)}
            </label>
            <input
                id={id}
                type='number'
                inputMode='numeric'
                min={1}
                step={step}
                value={draft}
                onChange={(e) => {
                    setDraft(e.target.value)
                    set(Number(e.target.value))
                }}
                onBlur={() => setDraft(String(nextSize(shape, scale.unit)))}
            />
            <span className='measure-size-unit'>{scale.unit}</span>
            <button type='button' aria-label={`Bigger ${info.sizeLabel}`} onClick={() => set(size + step)}>
                +
            </button>
        </div>
    )
}

export const TemplateStrip: React.FC<{ scale: Scale }> = ({ scale }) => {
    const prefs = useStore(measurePrefsStore)
    const templates = useStore(templatesStore)
    const selectedId = useStore(selectedTemplateStore)
    const selected = templates.find((t) => t.id === selectedId)
    const titleId = useId()
    return (
        <div className='measure-strip' role='group' aria-labelledby={titleId} data-measure-ui>
            <Glyph icon={TemplateIcon} />
            <span className='measure-strip-title' id={titleId}>
                Templates
            </span>
            <div className='measure-seg' role='group' aria-label='Shape'>
                {TEMPLATE_SHAPES.map((s) => (
                    <button
                        key={s.id}
                        type='button'
                        aria-pressed={prefs.shape === s.id}
                        onClick={() => measurePrefsStore.set((p) => ({ ...p, shape: s.id }))}
                    >
                        <Glyph icon={SHAPE_ICONS[s.id]} />
                        {s.label}
                    </button>
                ))}
            </div>
            <SizeField shape={prefs.shape} scale={scale} />
            <button type='button' onClick={() => placeTemplateAt(viewCentreWorld())} title='Place one in the middle of the view'>
                Place
            </button>
            <span className='measure-strip-sep' aria-hidden='true' />
            {selected && canRotate(selected.shape) && (
                <>
                    <button type='button' className='measure-icon-btn' aria-label='Turn left 15°' title='Turn left 15°' onClick={() => rotateSelected(-15)}>
                        <Glyph icon={RotateLeftIcon} />
                    </button>
                    <button type='button' className='measure-icon-btn' aria-label='Turn right 15°' title='Turn right 15°' onClick={() => rotateSelected(15)}>
                        <Glyph icon={RotateRightIcon} />
                    </button>
                </>
            )}
            {selected && (
                <button type='button' onClick={deleteSelected} title='Delete the selected template (Delete)'>
                    Delete
                </button>
            )}
            <button type='button' onClick={selectNextTemplate} disabled={!templates.length} title='Select the next template; arrows then move it'>
                Next
            </button>
            <button type='button' onClick={clearAllTemplates} disabled={!templates.length} title='Remove every template (Q)'>
                Clear all
            </button>
        </div>
    )
}
