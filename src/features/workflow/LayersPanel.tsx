import React, { useEffect, useId, useMemo, useRef } from "react"
import { Icon } from "../../components/Icon"
import { useHumbugs } from "../board-bridge"
import { MAP_KINDS, useMapKind, type MapKind } from "../map-kind"
import { useStore } from "../store"
import { LAYERS, layerOf, useLayerState, type LayerId } from "../view-state"
import { applyMapDefaults, changeMapKind, mapKindLabel, toggleLayer } from "./actions"
import {
    closeLayersPanel,
    consumeLayersFocusRequest,
    defaultsOfferStore,
    layersOpenStore,
    setWorkflowPref,
    useWorkflowPrefs,
} from "./state"

/*
 * Docked Layers panel (#22): per-layer visibility and lock, object counts,
 * the board's map type, and the right-click menu style.
 */

export const LayersPanel: React.FC = () => {
    const open = useStore(layersOpenStore)
    const prefs = useWorkflowPrefs()
    const layers = useLayerState()
    const humbugs = useHumbugs()
    const kind = useMapKind()
    const offer = useStore(defaultsOfferStore)
    const titleId = useId()
    const kindId = useId()
    const panelRef = useRef<HTMLElement>(null)

    const counts = useMemo(() => {
        const c: Record<LayerId, number> = { map: 0, objects: 0, tokens: 0, gm: 0 }
        for (const h of humbugs) c[layerOf(h)]++
        return c
    }, [humbugs])

    useEffect(() => {
        if (!open || !consumeLayersFocusRequest()) return
        panelRef.current?.querySelector<HTMLElement>("select, button")?.focus()
    }, [open])

    if (!open) return null

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== "Escape") return
        // Esc here closes the panel only (not the selection or active tool)
        e.stopPropagation()
        closeLayersPanel()
    }

    return (
        <section
            ref={panelRef}
            className={`wf-window wf-layers wf-layers--${prefs.layersSide}`}
            role='dialog'
            aria-labelledby={titleId}
            onKeyDown={onKeyDown}
        >
            <header className='wf-layers-head'>
                <h2 className='wf-title' id={titleId}>
                    Layers
                </h2>
                <div className='wf-row-buttons'>
                    <button
                        type='button'
                        className='wf-btn wf-icon-btn'
                        aria-label={`Dock panel on the ${prefs.layersSide === "left" ? "right" : "left"}`}
                        title={`Dock on the ${prefs.layersSide === "left" ? "right" : "left"}`}
                        onClick={() =>
                            setWorkflowPref("layersSide", prefs.layersSide === "left" ? "right" : "left")
                        }
                    >
                        <span aria-hidden='true'>{prefs.layersSide === "left" ? "⇥" : "⇤"}</span>
                    </button>
                    <button
                        type='button'
                        className='wf-btn wf-icon-btn'
                        aria-label='Close layers panel'
                        title='Close (Esc)'
                        onClick={closeLayersPanel}
                    >
                        <Icon name='close' size={18} />
                    </button>
                </div>
            </header>

            <div className='wf-section'>
                <label className='wf-label' htmlFor={kindId}>
                    Map type
                </label>
                <select
                    id={kindId}
                    className='wf-select'
                    value={kind}
                    onChange={(e) => changeMapKind(e.target.value as MapKind, { offer: true })}
                >
                    {MAP_KINDS.map((k) => (
                        <option key={k.id} value={k.id}>
                            {k.label}
                        </option>
                    ))}
                </select>
                {offer && (
                    <div className='wf-offer' role='status'>
                        <p>Use the {mapKindLabel(offer)} grid and board style too?</p>
                        <div className='wf-row-buttons'>
                            <button
                                type='button'
                                className='wf-btn'
                                onClick={() => {
                                    applyMapDefaults(offer)
                                    defaultsOfferStore.set(null)
                                }}
                            >
                                Apply
                            </button>
                            <button
                                type='button'
                                className='wf-btn'
                                onClick={() => defaultsOfferStore.set(null)}
                            >
                                Keep current
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className='wf-section'>
                <ul className='wf-layer-list' aria-label='Board layers'>
                    {LAYERS.map((l) => {
                        const s = layers[l.id]
                        const n = counts[l.id]
                        const status = [!s.visible && "hidden", s.locked && "locked"]
                            .filter(Boolean)
                            .join(", ")
                        return (
                            <li
                                key={l.id}
                                className={`wf-layer-row ${s.visible ? "" : "wf-layer-row--hidden"}`}
                                title={l.description}
                            >
                                <span>
                                    <span className='wf-layer-name'>{l.label}</span>
                                    <span className='wf-count' aria-label={`${n} object${n === 1 ? "" : "s"}`}>
                                        {n}
                                    </span>
                                    <span className='wf-layer-meta'>
                                        {status ? `${status[0].toUpperCase()}${status.slice(1)}` : l.description}
                                    </span>
                                </span>
                                <button
                                    type='button'
                                    className='wf-btn wf-icon-btn'
                                    aria-pressed={s.visible}
                                    aria-label={`Show ${l.label} layer`}
                                    title={s.visible ? `Hide ${l.label}` : `Show ${l.label}`}
                                    onClick={() => toggleLayer(l.id, "visible")}
                                >
                                    <Icon name={s.visible ? "eye" : "eye-off"} size={18} />
                                </button>
                                <button
                                    type='button'
                                    className='wf-btn wf-icon-btn'
                                    aria-pressed={s.locked}
                                    aria-label={`Lock ${l.label} layer`}
                                    title={s.locked ? `Unlock ${l.label}` : `Lock ${l.label}`}
                                    onClick={() => toggleLayer(l.id, "locked")}
                                >
                                    <Icon name={s.locked ? "lock" : "unlock"} size={18} />
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </div>

            <div className='wf-section'>
                <span className='wf-foot-label' id={`${titleId}-menu`}>
                    Right-click menu
                </span>
                <div className='wf-row-buttons' role='group' aria-labelledby={`${titleId}-menu`}>
                    <button
                        type='button'
                        className='wf-btn'
                        aria-pressed={prefs.menuStyle === "radial"}
                        onClick={() => setWorkflowPref("menuStyle", "radial")}
                    >
                        Radial
                    </button>
                    <button
                        type='button'
                        className='wf-btn'
                        aria-pressed={prefs.menuStyle === "list"}
                        onClick={() => setWorkflowPref("menuStyle", "list")}
                    >
                        List
                    </button>
                </div>
            </div>
        </section>
    )
}
