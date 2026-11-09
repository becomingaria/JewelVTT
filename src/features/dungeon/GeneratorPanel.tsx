import React, { useMemo, useRef } from "react"
import { useStore } from "../store"
import { buildDungeon } from "./build"
import {
    describeDungeon,
    generateDungeon,
    ROOM_COUNT,
    SIZES,
    type CorridorStyle,
    type DungeonSize,
    type GenSettings,
} from "./generator"
import { Minimap } from "./Minimap"
import { requestPanelFocus, usePanelFocus } from "./panel-focus"
import { randomSeed } from "./rng"
import { genSettingsStore, panelStore } from "./state"

const TOGGLES: { key: keyof GenSettings; label: string }[] = [
    { key: "doors", label: "Doors" },
    { key: "secretDoors", label: "Secret doors" },
    { key: "traps", label: "Traps" },
    { key: "stairs", label: "Stairs" },
    { key: "dressing", label: "Dressing" },
    { key: "numbers", label: "Numbered rooms" },
]

const close = () => panelStore.set(null)

/** Shift+W: dungeon generator with a live minimap */
export const GeneratorPanel: React.FC = () => {
    const s = useStore(genSettingsStore)
    const set = (patch: Partial<GenSettings>) => genSettingsStore.set((p) => ({ ...p, ...patch }))
    const dungeon = useMemo(() => generateDungeon(s), [s])
    const summary = describeDungeon(dungeon)
    const ref = useRef<HTMLElement>(null)
    usePanelFocus(ref)

    const fewer = dungeon.counts.rooms < Math.round(s.rooms)

    return (
        <section
            ref={ref}
            className='dgn-panel dgn-side'
            role='dialog'
            aria-labelledby='dgn-gen-title'
            onKeyDown={(e) => {
                if (e.key === "Escape") {
                    e.stopPropagation()
                    close()
                }
            }}
        >
            <header className='dgn-panel-head'>
                <h2 id='dgn-gen-title'>Dungeon generator</h2>
                <button type='button' className='dgn-icon-btn' aria-label='Close generator' onClick={close}>
                    ×
                </button>
            </header>

            <div className='dgn-field'>
                <label htmlFor='dgn-seed'>Seed</label>
                <div className='dgn-row'>
                    <input
                        id='dgn-seed'
                        type='text'
                        value={s.seed}
                        spellCheck={false}
                        autoComplete='off'
                        onChange={(e) => set({ seed: e.target.value })}
                    />
                    <button type='button' className='dgn-icon-btn' aria-label='New random seed' title='New random seed' onClick={() => set({ seed: randomSeed() })}>
                        <svg viewBox='0 0 16 16' width='18' height='18' aria-hidden='true' shapeRendering='crispEdges'>
                            <path fill='currentColor' d='M2 2h12v12H2zM3 3v10h10V3zM5 5h2v2H5zM9 9h2v2H9zM7 7h2v2H7z' />
                        </svg>
                    </button>
                </div>
            </div>

            <fieldset className='dgn-field'>
                <legend>Size</legend>
                <div className='dgn-seg'>
                    {(Object.keys(SIZES) as DungeonSize[]).map((k) => (
                        <button
                            key={k}
                            type='button'
                            aria-pressed={s.size === k}
                            onClick={() => set({ size: k, rooms: SIZES[k].rooms })}
                        >
                            {SIZES[k].label}
                        </button>
                    ))}
                </div>
            </fieldset>

            <div className='dgn-field'>
                <label htmlFor='dgn-rooms'>
                    Rooms: <strong>{s.rooms}</strong>
                </label>
                <input
                    id='dgn-rooms'
                    type='range'
                    min={ROOM_COUNT.min}
                    max={ROOM_COUNT.max}
                    value={s.rooms}
                    onChange={(e) => set({ rooms: Number(e.target.value) })}
                />
            </div>

            <fieldset className='dgn-field'>
                <legend>Corridors</legend>
                <div className='dgn-seg'>
                    {(["straight", "winding"] as CorridorStyle[]).map((k) => (
                        <button key={k} type='button' aria-pressed={s.corridors === k} onClick={() => set({ corridors: k })}>
                            {k === "straight" ? "Straight" : "Winding"}
                        </button>
                    ))}
                </div>
            </fieldset>

            <fieldset className='dgn-field dgn-checks'>
                <legend>Include</legend>
                {TOGGLES.map((t) => (
                    <label key={t.key}>
                        <input type='checkbox' checked={!!s[t.key]} onChange={(e) => set({ [t.key]: e.target.checked })} />
                        {t.label}
                    </label>
                ))}
            </fieldset>

            <Minimap dungeon={dungeon} width={300} height={220} label={`Preview: ${summary}`} />
            <p className='dgn-summary' aria-live='polite'>
                {summary}
                {fewer && <> (only {dungeon.counts.rooms} fit at this size)</>}
            </p>

            <div className='dgn-actions'>
                <button
                    type='button'
                    className='dgn-primary'
                    onClick={() => {
                        buildDungeon(dungeon, `dungeon “${s.seed.trim() || "0"}”`)
                        close()
                    }}
                >
                    Build at view centre
                </button>
                <button
                    type='button'
                    onClick={() => {
                        requestPanelFocus()
                        panelStore.set("starters")
                    }}
                >
                    Starter dungeons…
                </button>
            </div>
        </section>
    )
}
