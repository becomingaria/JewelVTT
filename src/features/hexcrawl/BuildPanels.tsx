import React from "react"
import { viewCentreWorld } from "../board-bridge"
import { cellAt } from "../grid"
import { useStore } from "../store"
import { setActiveTool } from "../view-state"
import { showToast } from "../../utils/toast"
import { placeMarker } from "./actions"
import { MARKERS, markerDataUrl } from "./markers"
import { paintCentreHex } from "./paint"
import { terrainPreviewUrl } from "./render"
import { labelDraft, setUi, uiStore, type Brush } from "./state"
import { TERRAINS, terrainDef, isTerrainId } from "./terrain"
import { hexNumber } from "./travel"

const PATH_BRUSHES: { id: Brush; label: string; glyph: string }[] = [
    { id: "river", label: "River", glyph: "≈" },
    { id: "road", label: "Road", glyph: "┅" },
    { id: "erase", label: "Erase terrain", glyph: "⌫" },
    { id: "erase-paths", label: "Erase roads & rivers", glyph: "✂" },
]

const CoordsToggle: React.FC = () => {
    const { showCoords } = useStore(uiStore)
    return (
        <label className='hx-check'>
            <input type='checkbox' checked={showCoords} onChange={(e) => setUi({ showCoords: e.target.checked })} />
            Show hex numbers
        </label>
    )
}

const CloseTool: React.FC<{ label: string }> = ({ label }) => (
    <button type='button' className='hx-btn hx-btn--icon' aria-label={`Close ${label}`} title='Close (Esc)' onClick={() => setActiveTool(null)}>
        ✕
    </button>
)

/** Bottom strip while the terrain tool (E) is active */
export const TerrainPalette: React.FC = () => {
    const ui = useStore(uiStore)
    const brushName = isTerrainId(ui.brush)
        ? terrainDef(ui.brush).label
        : (PATH_BRUSHES.find((b) => b.id === ui.brush)?.label ?? "")
    return (
        <section className='hx-panel hx-strip' role='dialog' aria-labelledby='hx-terrain-title'>
            <header className='hx-strip-head'>
                <h2 id='hx-terrain-title' className='hx-title'>Terrain</h2>
                <span className='hx-muted' aria-live='polite'>Brush: {brushName}</span>
                <CloseTool label='terrain tool' />
            </header>
            <div className='hx-strip-body'>
                <div className='hx-swatches' role='group' aria-label='Terrain'>
                    {TERRAINS.map((t) => (
                        <button
                            key={t.id}
                            type='button'
                            className='hx-swatch'
                            aria-pressed={ui.brush === t.id}
                            title={`${t.label}: travel ×${t.cost === Infinity ? "–" : t.cost}, encounters ${t.encounter} in 6`}
                            onClick={() => setUi({ brush: t.id })}
                        >
                            <img src={terrainPreviewUrl(t.id)} alt='' width={32} height={38} />
                            <span>{t.label}</span>
                        </button>
                    ))}
                </div>
                <div className='hx-swatches' role='group' aria-label='Paths and erasers'>
                    {PATH_BRUSHES.map((b) => (
                        <button
                            key={b.id}
                            type='button'
                            className='hx-swatch hx-swatch--tool'
                            aria-pressed={ui.brush === b.id}
                            onClick={() => setUi({ brush: b.id })}
                        >
                            <span className='hx-glyph' aria-hidden='true'>{b.glyph}</span>
                            <span>{b.label}</span>
                        </button>
                    ))}
                </div>
                <div className='hx-col'>
                    <div className='hx-row' role='group' aria-label='Brush size'>
                        <span className='hx-muted'>Size</span>
                        {([1, 2, 3] as const).map((n) => (
                            <button
                                key={n}
                                type='button'
                                className='hx-btn hx-btn--square'
                                aria-pressed={ui.size === n}
                                aria-label={`Brush ${n} hex${n > 1 ? "es" : ""} wide`}
                                onClick={() => setUi({ size: n })}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                    <CoordsToggle />
                    <button
                        type='button'
                        className='hx-btn'
                        onClick={() => {
                            const c = paintCentreHex(ui.brush, ui.size)
                            showToast(`Painted hex ${hexNumber(c)}.`)
                        }}
                    >
                        Paint the centre hex
                    </button>
                </div>
            </div>
        </section>
    )
}

/** Bottom strip while the feature tool (Shift+E) is active */
export const FeaturePanel: React.FC = () => {
    const ui = useStore(uiStore)
    const label = useStore(labelDraft)
    return (
        <section className='hx-panel hx-strip' role='dialog' aria-labelledby='hx-feature-title'>
            <header className='hx-strip-head'>
                <h2 id='hx-feature-title' className='hx-title'>Hex features</h2>
                <span className='hx-muted'>Click a hex to place</span>
                <CloseTool label='feature tool' />
            </header>
            <div className='hx-strip-body'>
                <div className='hx-swatches' role='group' aria-label='Marker'>
                    {MARKERS.map((m) => (
                        <button
                            key={m.kind}
                            type='button'
                            className='hx-swatch'
                            aria-pressed={ui.marker === m.kind}
                            onClick={() => setUi({ marker: m.kind })}
                        >
                            <img src={markerDataUrl(m.kind)} alt='' width={32} height={32} />
                            <span>{m.label}</span>
                        </button>
                    ))}
                </div>
                <div className='hx-col'>
                    <label className='hx-field'>
                        <span>Label (optional)</span>
                        <input
                            type='text'
                            value={label}
                            maxLength={40}
                            placeholder='e.g. Thornwick'
                            onChange={(e) => labelDraft.set(e.target.value)}
                        />
                    </label>
                    <label className='hx-check'>
                        <input type='checkbox' checked={ui.autoNumber} onChange={(e) => setUi({ autoNumber: e.target.checked })} />
                        Add hex number (e.g. 0304)
                    </label>
                    <CoordsToggle />
                    <button
                        type='button'
                        className='hx-btn'
                        onClick={() => {
                            const cell = cellAt(viewCentreWorld(), "hex")
                            const what = placeMarker(cell, ui.marker, label, ui.autoNumber)
                            labelDraft.set("")
                            showToast(`${what} placed in hex ${hexNumber(cell)}.`)
                        }}
                    >
                        Place in the centre hex
                    </button>
                </div>
            </div>
        </section>
    )
}
