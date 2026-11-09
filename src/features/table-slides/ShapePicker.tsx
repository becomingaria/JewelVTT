import React, { useEffect, useRef } from "react"
import { Icon } from "../../components/Icon"
import { addHumbugs, humbugBase, humbugsStore, updateHumbugs, viewCentreWorld } from "../board-bridge"
import { playSfx } from "../sound"
import { useTableMode } from "../view-state"
import type { TextHumbug } from "../../types/humbug.types"
import { FEATURE_ID, FLOW_SHAPES, flowShapeOf, withShape, type FlowShape, type FlowShapeInfo } from "./shapes"
import { ShapeGlyph } from "./FlowShape"
import { pickerStore, usePicker, usePresent } from "./state"

/** A new shaped text humbug centred on the view, selected */
function placeShape(info: FlowShapeInfo) {
    const c = viewCentreWorld()
    const pos = { x: Math.round(c.x - info.size.width / 2), y: Math.round(c.y - info.size.height / 2) }
    // Cascade instead of stacking exactly on a box placed here before
    const taken = humbugsStore.get()
    for (let i = 0; i < 20 && taken.some((o) => o.position.x === pos.x && o.position.y === pos.y); i++) {
        pos.x += 24
        pos.y += 24
    }
    const h: TextHumbug = {
        ...humbugBase(pos),
        type: "text",
        content: info.defaultText,
        fontSize: 18,
        fontFamily: "Arial, sans-serif",
        color: "#1d1b26",
        backgroundColor: "#fffdf4",
        textAlign: "center",
        size: { ...info.size },
        ext: { [FEATURE_ID]: { shape: info.id } },
    }
    addHumbugs([h], { select: true })
    playSfx("place")
}

function changeShape(id: string, shape: FlowShape | null) {
    const h = humbugsStore.get().find((x) => x.id === id)
    if (!h || flowShapeOf(h) === shape) return
    updateHumbugs([{ id, changes: { ext: withShape(h, shape) } }])
}

/**
 * Flowchart shape palette. "place" mode (dock button) adds a new shaped
 * text box at the view centre; "change" mode (right-click › Shape) reshapes
 * an existing one. Esc or a click elsewhere closes it; focus goes back.
 */
export const ShapePicker: React.FC = () => {
    const picker = usePicker()
    const tableMode = useTableMode()
    const present = usePresent()
    const rootRef = useRef<HTMLDivElement>(null)
    const open = !!picker && !tableMode && !present

    useEffect(() => {
        if (!open) return
        const returnTo = document.activeElement as HTMLElement | null
        const root = rootRef.current
        ;(root?.querySelector<HTMLButtonElement>(".ts-shape-btn.is-current") ??
            root?.querySelector<HTMLButtonElement>(".ts-shape-btn"))?.focus()
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return
            e.stopPropagation()
            pickerStore.set(null)
        }
        const onDown = (e: MouseEvent) => {
            const t = e.target as HTMLElement
            // The dock button toggles the palette itself
            if (rootRef.current?.contains(t) || t.closest?.(".tool-dock")) return
            pickerStore.set(null)
        }
        window.addEventListener("keydown", onKey, true)
        window.addEventListener("mousedown", onDown, true)
        return () => {
            window.removeEventListener("keydown", onKey, true)
            window.removeEventListener("mousedown", onDown, true)
            if (returnTo?.isConnected) returnTo.focus()
        }
    }, [open, picker?.mode])

    if (!open || !picker) return null

    const target = picker.mode === "change" ? humbugsStore.get().find((h) => h.id === picker.humbugId) : null
    if (picker.mode === "change" && !target) return null
    const current = target ? flowShapeOf(target) : undefined

    const choose = (shape: FlowShapeInfo | null) => {
        if (picker.mode === "place") {
            if (shape) placeShape(shape)
        } else {
            changeShape(picker.humbugId, shape?.id ?? null)
        }
        pickerStore.set(null)
    }

    // Keep the popover on screen
    const style: React.CSSProperties =
        picker.mode === "change"
            ? {
                  left: Math.max(8, Math.min(picker.at.x, window.innerWidth - 300)),
                  top: Math.max(8, Math.min(picker.at.y, window.innerHeight - 340)),
              }
            : {}

    return (
        <div
            ref={rootRef}
            className={`ts-picker ts-picker--${picker.mode}`}
            style={style}
            role='dialog'
            aria-labelledby='ts-picker-title'
        >
            <div className='ts-picker-inner'>
                <header className='ts-picker-head'>
                    <h2 id='ts-picker-title'>{picker.mode === "place" ? "Add a flowchart shape" : "Shape"}</h2>
                    <button
                        type='button'
                        className='ts-icon-btn'
                        aria-label='Close'
                        onClick={() => pickerStore.set(null)}
                    >
                        <Icon name='close' size={18} />
                    </button>
                </header>
                <div className='ts-shape-grid'>
                    {FLOW_SHAPES.map((s) => (
                        <button
                            key={s.id}
                            type='button'
                            className={`ts-shape-btn ${current === s.id ? "is-current" : ""}`}
                            aria-pressed={picker.mode === "change" ? current === s.id : undefined}
                            title={s.meaning}
                            onClick={() => choose(s)}
                        >
                            <ShapeGlyph shape={s.id} size={30} />
                            <span>{s.label}</span>
                        </button>
                    ))}
                    {picker.mode === "change" && (
                        <button
                            type='button'
                            className={`ts-shape-btn ${current === null ? "is-current" : ""}`}
                            aria-pressed={current === null}
                            title='A plain text box'
                            onClick={() => choose(null)}
                        >
                            <ShapeGlyph shape={null} size={30} />
                            <span>Plain box</span>
                        </button>
                    )}
                </div>
                {picker.mode === "place" && (
                    <p className='ts-picker-tip'>
                        Link shapes by dragging from the dots on their edges. Double-click to edit the text.
                    </p>
                )}
            </div>
        </div>
    )
}
