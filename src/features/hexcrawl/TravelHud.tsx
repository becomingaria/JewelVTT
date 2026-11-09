import React, { useRef } from "react"
import { humbugsStore, useHumbugs, useSelection } from "../board-bridge"
import { cellKey } from "../grid"
import { useStore } from "../store"
import { setActiveTool, useActiveTool } from "../view-state"
import { showToast } from "../../utils/toast"
import {
    fmtMiles,
    humbugCell,
    makeCamp,
    moveParty,
    partyName,
    rollTodaysWeather,
    setParty,
    todaysProgress,
} from "./actions"
import { usePanelDrag } from "./hooks"
import { hasPath } from "./map-data"
import { PixelIcon } from "./PixelIcon"
import { changeTravel, mapStore, setUi, TOOL_TRAVEL, travelResultStore, travelStore, uiStore } from "./state"
import { isWater, terrainDef } from "./terrain"
import {
    dayBudget,
    DIRECTION_NAMES,
    hexNumber,
    milesCovered,
    MILES_PER_HEX,
    moveCostMiles,
    neighboursByDirection,
    watchFor,
    type Direction,
} from "./travel"
import {
    CLIMATES,
    SEASONS,
    WEATHER_ICON_PALETTE,
    WEATHER_ICONS,
    WEATHER_KINDS,
    type Climate,
    type Season,
} from "./weather"

const DIR_ARROW: Record<Direction, string> = { NE: "↗", E: "→", SE: "↘", SW: "↙", W: "←", NW: "↖" }

/** Day, watch, movement and weather for the travelling party */
export const TravelHud: React.FC = () => {
    const travel = useStore(travelStore)
    const ui = useStore(uiStore)
    const map = useStore(mapStore)
    const result = useStore(travelResultStore)
    const humbugs = useHumbugs()
    const selection = useSelection()
    const tool = useActiveTool()
    const panelRef = useRef<HTMLElement>(null)
    const drag = usePanelDrag(panelRef, (p) => setUi({ hudPos: p }))

    const party = travel.partyId ? humbugs.find((h) => h.id === travel.partyId) : undefined
    const weather =
        travel.weather && travel.weather.day === travel.day ? (WEATHER_KINDS[travel.weather.id] ?? null) : null
    const budget = dayBudget(weather?.pace ?? 1)
    const progress = todaysProgress(party)
    const left = budget - progress.used
    const watch = watchFor(progress.used, budget)
    const at = party ? humbugCell(party) : null
    const here = at ? map.cells[cellKey(at)] : undefined

    const adoptSelected = () => {
        const h = humbugsStore.get().find((x) => x.id === selection[0])
        if (!h || selection.length !== 1) {
            showToast("Select the party's token on the board first.", "error")
            return
        }
        setParty(h)
    }

    const style: React.CSSProperties = ui.hudPos
        ? { left: ui.hudPos.x, top: ui.hudPos.y, right: "auto" }
        : {}

    return (
        <section
            ref={panelRef}
            className={`hx-panel hx-hud ${ui.hudCollapsed ? "hx-hud--collapsed" : ""} ${drag.dragging ? "is-dragging" : ""}`}
            style={style}
            role='dialog'
            aria-labelledby='hx-hud-title'
        >
            <header className='hx-hud-head' {...drag.handlers} title='Drag to move'>
                <h2 id='hx-hud-title' className='hx-title'>
                    Day {travel.day}
                    <span className='hx-title-sub'> · {watch}</span>
                </h2>
                {ui.hudCollapsed && weather && (
                    <span className='hx-hud-chip'>
                        <PixelIcon glyph={WEATHER_ICONS[weather.icon]} palette={WEATHER_ICON_PALETTE} size={18} />
                        {weather.label}
                    </span>
                )}
                <button
                    type='button'
                    className='hx-btn hx-btn--icon'
                    aria-expanded={!ui.hudCollapsed}
                    aria-label={ui.hudCollapsed ? "Expand travel panel" : "Collapse travel panel"}
                    onClick={() => setUi({ hudCollapsed: !ui.hudCollapsed })}
                >
                    {ui.hudCollapsed ? "▾" : "▴"}
                </button>
                <button
                    type='button'
                    className='hx-btn hx-btn--icon'
                    aria-label='Hide travel panel'
                    title='Hide (the travel tool brings it back)'
                    onClick={() => {
                        setUi({ hudHidden: true })
                        if (tool === TOOL_TRAVEL) setActiveTool(null)
                    }}
                >
                    ✕
                </button>
            </header>

            {!ui.hudCollapsed && (
                <div className='hx-hud-body'>
                    <div className='hx-row hx-row--between'>
                        <span>
                            <strong>{party ? partyName(party) : "No party chosen"}</strong>
                            {at && (
                                <span className='hx-muted'>
                                    {" "}
                                    in {here ? terrainDef(here).label.toLowerCase() : "open ground"}, hex {hexNumber(at)}
                                </span>
                            )}
                        </span>
                        <button type='button' className='hx-btn hx-btn--small' onClick={adoptSelected}>
                            Use selected token
                        </button>
                    </div>
                    {!party && (
                        <p className='hx-hint'>
                            Select the party's token and press <em>Use selected token</em>, or pick the travel tool (X)
                            and click the token.
                        </p>
                    )}

                    <div className='hx-weather'>
                        {weather ? (
                            <>
                                <PixelIcon glyph={WEATHER_ICONS[weather.icon]} palette={WEATHER_ICON_PALETTE} size={32} />
                                <div>
                                    <strong>{weather.label}</strong>
                                    <div className='hx-muted'>{weather.detail}</div>
                                </div>
                            </>
                        ) : (
                            <span className='hx-muted'>Today's weather hasn't been rolled.</span>
                        )}
                        <button type='button' className='hx-btn hx-btn--small' onClick={rollTodaysWeather}>
                            {weather ? "Reroll" : "Roll weather"}
                        </button>
                    </div>
                    <div className='hx-row'>
                        <label className='hx-field hx-field--inline'>
                            <span>Season</span>
                            <select
                                value={travel.season}
                                onChange={(e) => changeTravel({ season: e.target.value as Season }, "Change season")}
                            >
                                {SEASONS.map((s) => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                            </select>
                        </label>
                        <label className='hx-field hx-field--inline'>
                            <span>Climate</span>
                            <select
                                value={travel.climate}
                                onChange={(e) => changeTravel({ climate: e.target.value as Climate }, "Change climate")}
                            >
                                {CLIMATES.map((c) => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <dl className='hx-stats'>
                        <div>
                            <dt>Hexes today</dt>
                            <dd>{progress.hexes}</dd>
                        </div>
                        <div>
                            <dt>Miles today</dt>
                            <dd>{milesCovered(progress)}</dd>
                        </div>
                        <div>
                            <dt>Movement left</dt>
                            <dd>
                                {left > 0 ? `${fmtMiles(left)} mi` : "none"}
                                {left > 0 && (
                                    <span className='hx-muted'> ≈ {fmtMiles(left / MILES_PER_HEX)} clear hexes</span>
                                )}
                            </dd>
                        </div>
                    </dl>
                    <div
                        className='hx-meter'
                        role='meter'
                        aria-label='Movement used today'
                        aria-valuemin={0}
                        aria-valuemax={budget}
                        aria-valuenow={Math.min(budget, progress.used)}
                        aria-valuetext={`${fmtMiles(progress.used)} of ${fmtMiles(budget)} miles`}
                    >
                        <span style={{ width: `${Math.min(100, (progress.used / budget) * 100)}%` }} />
                    </div>
                    <p className='hx-meter-text' aria-hidden='true'>
                        {fmtMiles(progress.used)} / {fmtMiles(budget)} mi used
                        {weather && weather.pace < 1 ? ` (weather ×${weather.pace})` : ""}
                    </p>
                    {left < 0 && (
                        <p className='hx-warn'>
                            <span aria-hidden='true'>⚠ </span>Forced march: {fmtMiles(-left)} miles past the day's
                            movement.
                        </p>
                    )}

                    {party && at && (
                        <div className='hx-dirs' role='group' aria-label='Move the party one hex'>
                            {neighboursByDirection(at).map(({ dir, cell }) => {
                                const t = map.cells[cellKey(cell)]
                                const blocked = isWater(t)
                                const cost = moveCostMiles(t, hasPath(map, "road", at, cell))
                                return (
                                    <button
                                        key={dir}
                                        type='button'
                                        className={`hx-btn hx-dir hx-dir--${dir.toLowerCase()}`}
                                        disabled={blocked}
                                        aria-label={`Travel ${DIRECTION_NAMES[dir]}${blocked ? " (water)" : `, ${fmtMiles(cost)} miles of movement`}`}
                                        title={blocked ? "Water: not on foot" : `${fmtMiles(cost)} mi`}
                                        onClick={() => moveParty(cell)}
                                    >
                                        <span aria-hidden='true'>{DIR_ARROW[dir]}</span>
                                        <small aria-hidden='true'>{dir}</small>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    <label className='hx-check'>
                        <input
                            type='checkbox'
                            checked={travel.checks}
                            onChange={(e) => changeTravel({ checks: e.target.checked }, "Toggle encounter checks")}
                        />
                        Roll an encounter check on each hex
                    </label>

                    <p className={`hx-result ${result?.encounter ? "hx-result--alert" : ""}`} aria-live='polite'>
                        {result && (
                            <>
                                {result.encounter && <span aria-hidden='true'>⚔ </span>}
                                {result.text}
                            </>
                        )}
                    </p>

                    <button type='button' className='hx-btn hx-btn--primary hx-btn--wide' onClick={makeCamp}>
                        End day / make camp
                    </button>
                </div>
            )}
        </section>
    )
}
