import React, { useMemo, useRef } from "react"
import { buildDungeon } from "./build"
import { describeDungeon, generateDungeon } from "./generator"
import { Minimap } from "./Minimap"
import { requestPanelFocus, usePanelFocus } from "./panel-focus"
import { STARTERS } from "./presets"
import { genSettingsStore, panelStore } from "./state"

const close = () => panelStore.set(null)

/** Shift+S: named starter dungeons with fixed seeds */
export const StarterPanel: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    usePanelFocus(ref)
    const built = useMemo(() => STARTERS.map((p) => ({ ...p, dungeon: generateDungeon(p.settings) })), [])

    return (
        <section
            ref={ref}
            className='dgn-panel dgn-side'
            role='dialog'
            aria-labelledby='dgn-starters-title'
            onKeyDown={(e) => {
                if (e.key === "Escape") {
                    e.stopPropagation()
                    close()
                }
            }}
        >
            <header className='dgn-panel-head'>
                <h2 id='dgn-starters-title'>Starter dungeons</h2>
                <button type='button' className='dgn-icon-btn' aria-label='Close starter dungeons' onClick={close}>
                    ×
                </button>
            </header>
            <ul className='dgn-starters'>
                {built.map((p) => {
                    const summary = describeDungeon(p.dungeon)
                    return (
                        <li key={p.id} className='dgn-starter'>
                            <Minimap dungeon={p.dungeon} width={132} height={100} label={`${p.name} preview: ${summary}`} />
                            <div className='dgn-starter-text'>
                                <h3>{p.name}</h3>
                                <p>{p.description}</p>
                                <p className='dgn-hint dgn-hint--small'>{summary}</p>
                                <div className='dgn-row'>
                                    <button
                                        type='button'
                                        className='dgn-primary'
                                        aria-label={`Build ${p.name}`}
                                        onClick={() => {
                                            buildDungeon(p.dungeon, p.name)
                                            close()
                                        }}
                                    >
                                        Build
                                    </button>
                                    <button
                                        type='button'
                                        aria-label={`Customise ${p.name} in the generator`}
                                        onClick={() => {
                                            genSettingsStore.set(p.settings)
                                            requestPanelFocus()
                                            panelStore.set("generator")
                                        }}
                                    >
                                        Customise
                                    </button>
                                </div>
                            </div>
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}
