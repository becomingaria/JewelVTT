import React, { useId } from "react"
import { useHumbugs } from "../board-bridge"
import { useStore } from "../store"
import { useMapKind } from "../map-kind"
import { useTableMode, useNetRole } from "../view-state"
import { usePrefs } from "../prefs"
import { REST_EVERY, elapsedLabel, isCheckTurn, isRestTurn, turnsUntilCheck } from "./logic"
import { dungeonStore, uiStore } from "./state"
import { advanceDungeonTurn, resetDungeonTurns, setCheckEvery } from "./actions"
import { HourglassIcon } from "./icons"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/** Compact dungeon-turn tracker (dungeon maps only) */
export const DungeonHud: React.FC = () => {
    const kind = useMapKind()
    const d = useStore(dungeonStore)
    const ui = useStore(uiStore)
    const humbugs = useHumbugs()
    const tableMode = useTableMode()
    const { hints } = usePrefs()
    const titleId = useId()
    const role = useNetRole()

    // The dungeon clock is the GM's (players' apps don't get it)
    if (kind !== "dungeon" || role === "player") return null

    const check = d.lastCheck
    const encounterNow = !!check?.encounter && check.turn === d.turn
    const toggle = () => uiStore.set((u) => ({ ...u, hudOpen: !u.hudOpen }))

    if (!ui.hudOpen) {
        return (
            <button
                type='button'
                className={`tracker-hud-chip tracker-panel ${encounterNow ? "alert" : ""}`}
                onClick={toggle}
                aria-expanded={false}
                aria-label={`Dungeon turn ${d.turn}${encounterNow ? ", wandering monsters" : ""}. Show turn tracker`}
                title='Show the dungeon turn tracker'
            >
                <span className='tracker-btn-icon'>
                    <HourglassIcon />
                </span>
                Turn {d.turn}
                {encounterNow && <span className='tracker-alert-mark'>!</span>}
            </button>
        )
    }

    const until = turnsUntilCheck(d.turn, d.checkEvery)
    const restIn = REST_EVERY - (d.turn % REST_EVERY)
    const lights = humbugs.filter((h) => typeof h.light?.turnsLeft === "number")
    const shortest = lights.length ? Math.min(...lights.map((h) => h.light!.turnsLeft!)) : 0

    return (
        <section className={`tracker-hud tracker-panel ${encounterNow ? "alert" : ""}`} aria-labelledby={titleId}>
            <div className='tracker-hud-head'>
                <span className='tracker-btn-icon' aria-hidden='true'>
                    <HourglassIcon />
                </span>
                <h2 id={titleId} className='tracker-title'>
                    Dungeon turn
                </h2>
                <button
                    type='button'
                    className='tracker-icon-btn tracker-icon-btn--small'
                    onClick={toggle}
                    aria-expanded={true}
                    aria-label='Collapse the turn tracker'
                    title='Collapse'
                >
                    –
                </button>
            </div>

            <p className='tracker-hud-turn' aria-live='polite'>
                <strong>{d.turn}</strong>
                <span>{elapsedLabel(d.turn)}</span>
            </p>

            {encounterNow && (
                <p className='tracker-hud-alert' role='status'>
                    <span className='tracker-alert-mark' aria-hidden='true'>
                        !
                    </span>
                    Wandering monsters! (rolled 1)
                </p>
            )}

            <dl className='tracker-hud-facts'>
                <dt>Monster check</dt>
                <dd>
                    {isCheckTurn(d.turn + 1, d.checkEvery) ? "next turn" : `in ${plural(until, "turn")}`}
                    {check && !encounterNow && (
                        <span className='tracker-muted'>
                            {" "}
                            (last: {check.roll}
                            {check.encounter ? ", encounter" : ", quiet"})
                        </span>
                    )}
                </dd>
                <dt>Rest</dt>
                <dd>{isRestTurn(d.turn) ? <strong>due now</strong> : `in ${plural(restIn, "turn")}`}</dd>
                {lights.length > 0 && (
                    <>
                        <dt>Lights</dt>
                        <dd>
                            {lights.length} lit, shortest {plural(shortest, "turn")}
                        </dd>
                    </>
                )}
            </dl>

            <div className='tracker-hud-actions'>
                <button
                    type='button'
                    className='tracker-btn tracker-btn--primary'
                    onClick={advanceDungeonTurn}
                    aria-keyshortcuts='Shift+N'
                    title='Advance one exploration turn (Shift+N)'
                >
                    + 1 turn {hints && <kbd className='tracker-kbd'>⇧N</kbd>}
                </button>
                {!tableMode && (
                    <button type='button' className='tracker-btn' onClick={resetDungeonTurns} disabled={!d.turn}>
                        Reset
                    </button>
                )}
            </div>
            {!tableMode && (
                <div className='tracker-stepper tracker-hud-every' role='group' aria-label='Check for monsters every'>
                    <span>Check every</span>
                    <button
                        type='button'
                        className='tracker-icon-btn tracker-icon-btn--small'
                        aria-label='Fewer turns between checks'
                        disabled={d.checkEvery <= 1}
                        onClick={() => setCheckEvery(d.checkEvery - 1)}
                    >
                        −
                    </button>
                    <span className='tracker-stepper-val' aria-live='polite'>
                        {d.checkEvery}
                    </span>
                    <button
                        type='button'
                        className='tracker-icon-btn tracker-icon-btn--small'
                        aria-label='More turns between checks'
                        disabled={d.checkEvery >= 12}
                        onClick={() => setCheckEvery(d.checkEvery + 1)}
                    >
                        +
                    </button>
                    <span>turns</span>
                </div>
            )}
        </section>
    )
}
