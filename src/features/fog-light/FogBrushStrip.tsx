import React, { useEffect } from "react"
import { useStore } from "../store"
import { setActiveTool, useTableMode } from "../view-state"
import {
    brushStore,
    coverBoard,
    fogNoticeStore,
    fogStore,
    revealEverything,
    toggleFog,
    type BrushSettings,
} from "./fog-store"
import { EyeIcon, FogIcon } from "./icons"
import {
    addRevealLayer,
    brushTargetStore,
    deleteRevealLayer,
    renameRevealLayer,
    revealLayersStore,
    setRevealVisible,
} from "./reveal-store"

const SIZES = [1, 2, 3, 4, 5]

const setBrush = (patch: Partial<BrushSettings>) => brushStore.set((b) => ({ ...b, ...patch }))

/**
 * Options for the fog brush, docked beside the tool dock while the brush
 * is active. Plain buttons in tab order; Esc (handled by the host) closes.
 */
export const FogBrushStrip: React.FC = () => {
    const fog = useStore(fogStore)
    const brush = useStore(brushStore)
    const notice = useStore(fogNoticeStore)
    const tableMode = useTableMode()
    const layers = useStore(revealLayersStore)
    const target = useStore(brushTargetStore)

    useEffect(() => {
        if (fog.enabled && notice) fogNoticeStore.set("")
    }, [fog.enabled, notice])

    // Don't leave a stale notice for next time
    useEffect(() => () => fogNoticeStore.set(""), [])

    const hide = brush.mode === "hide"

    return (
        <section
            className={`fogl-strip ${tableMode ? "is-table" : ""}`}
            aria-labelledby='fogl-strip-title'
        >
            <div className='fogl-strip-head'>
                <h2 id='fogl-strip-title' className='fogl-strip-title'>
                    <span className='fogl-strip-icon' aria-hidden='true'>
                        <FogIcon />
                    </span>
                    Fog brush
                </h2>
                <button
                    type='button'
                    className='fogl-btn fogl-close'
                    aria-label='Close fog brush'
                    title='Close (Esc)'
                    onClick={() => setActiveTool(null)}
                >
                    <span aria-hidden='true'>×</span>
                </button>
            </div>

            <div className='fogl-row' role='group' aria-label='Brush paints'>
                <button
                    type='button'
                    className='fogl-btn fogl-wide'
                    aria-pressed={!hide}
                    onClick={() => setBrush({ mode: "reveal" })}
                >
                    <span className='fogl-btn-icon' aria-hidden='true'>
                        <EyeIcon open />
                    </span>
                    Reveal
                </button>
                <button
                    type='button'
                    className='fogl-btn fogl-wide'
                    aria-pressed={hide}
                    onClick={() => setBrush({ mode: "hide" })}
                >
                    <span className='fogl-btn-icon' aria-hidden='true'>
                        <EyeIcon open={false} />
                    </span>
                    Hide
                </button>
            </div>

            {/* Reveal layers: paint reveals ahead of time, switch them on later */}
            <div className='fogl-reveals' role='group' aria-labelledby='fogl-paint-into'>
                <span id='fogl-paint-into' className='fogl-label'>
                    Paint into
                </span>
                <button
                    type='button'
                    className='fogl-btn fogl-wide'
                    aria-pressed={!target}
                    onClick={() => brushTargetStore.set(null)}
                >
                    Board fog
                </button>
                {layers.map((l) => (
                    <div key={l.id} className='fogl-reveal-row'>
                        <button
                            type='button'
                            className='fogl-btn fogl-reveal-pick'
                            aria-pressed={target === l.id}
                            aria-label={`Paint into ${l.name}`}
                            onClick={() => brushTargetStore.set(l.id)}
                            title='Paint this reveal layer'
                        >
                            <span aria-hidden='true'>✎</span>
                        </button>
                        <input
                            className='fogl-reveal-name'
                            defaultValue={l.name}
                            aria-label='Reveal layer name'
                            onFocus={() => brushTargetStore.set(l.id)}
                            onBlur={(e) => renameRevealLayer(l.id, e.currentTarget.value)}
                            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        />
                        <button
                            type='button'
                            className='fogl-btn'
                            aria-pressed={l.visible}
                            aria-label={`${l.visible ? "Hide" : "Show"} reveal layer ${l.name}`}
                            title={l.visible ? "Revealed: click to cover again" : "Hidden: click to reveal to everyone"}
                            onClick={() => setRevealVisible(l.id, !l.visible)}
                        >
                            <span className='fogl-btn-icon' aria-hidden='true'>
                                <EyeIcon open={l.visible} />
                            </span>
                            {l.visible ? "On" : "Off"}
                        </button>
                        <button
                            type='button'
                            className='fogl-btn'
                            aria-label={`Delete reveal layer ${l.name}`}
                            title='Delete (undoable)'
                            onClick={() => deleteRevealLayer(l.id)}
                        >
                            <span aria-hidden='true'>×</span>
                        </button>
                    </div>
                ))}
                <button type='button' className='fogl-btn fogl-wide' onClick={() => addRevealLayer()}>
                    + New reveal layer
                </button>
            </div>

            <div className='fogl-row' role='group' aria-labelledby='fogl-size-label'>
                <span id='fogl-size-label' className='fogl-label'>
                    Size
                </span>
                {SIZES.map((n) => (
                    <button
                        key={n}
                        type='button'
                        className='fogl-btn fogl-size'
                        aria-pressed={brush.size === n}
                        aria-label={`Brush size ${n}`}
                        onClick={() => setBrush({ size: n })}
                    >
                        {n}
                    </button>
                ))}
            </div>

            <div className='fogl-row' role='group' aria-label='Whole board'>
                <button type='button' className='fogl-btn' onClick={coverBoard} title='Fog over everything'>
                    Cover
                </button>
                <button type='button' className='fogl-btn' onClick={revealEverything} title='Clear all fog'>
                    Reveal all
                </button>
                <button
                    type='button'
                    className='fogl-btn'
                    aria-pressed={fog.enabled}
                    onClick={toggleFog}
                    title='Show or hide fog on this board (Shift+G)'
                >
                    <span className='fogl-check' aria-hidden='true'>
                        {fog.enabled ? "■" : "□"}
                    </span>
                    Fog
                </button>
            </div>

            <p className='fogl-hint'>
                Drag on the board to {target ? (hide ? "erase from the layer" : "paint the layer") : hide ? "hide" : "reveal"}.{" "}
                {hide ? "" : "Hold Alt or right-drag to hide. "}Esc closes.
            </p>
            <p className='fogl-notice' role='status' aria-live='polite'>
                {notice}
            </p>
        </section>
    )
}
