import React, { useId, useRef, useState } from "react"
import { selectHumbugs, useHumbugs } from "../board-bridge"
import { useStore } from "../store"
import { isHumbugHidden, useLayerState, useTableMode } from "../view-state"
import { usePrefs } from "../prefs"
import { formatMod } from "./logic"
import { announceStore, initStore, partyStore, stripOpenStore, stripPickStore, uiStore } from "./state"
import {
    addAllToInitiative,
    addSelectedToInitiative,
    clearInitiative,
    flyToActive,
    flyToHumbug,
    isToken,
    moveInInitiative,
    nameOf,
    nextTurn,
    removeFromInitiative,
    rollInitiative,
    setCombatantMod,
    setInitOptions,
    setSide,
    setStripOpen,
    sideOf,
} from "./actions"
import {
    AddInitiativeIcon,
    ConditionGlyph,
    DiceIcon,
    FangIcon,
    FlyToIcon,
    InitiativeIcon,
    NextIcon,
    ShieldIcon,
} from "./icons"

const Key: React.FC<{ k: string }> = ({ k }) => {
    const { hints } = usePrefs()
    return hints ? <kbd className='tracker-kbd'>{k}</kbd> : null
}

/** Slim turn-order strip along the top of the board */
export const InitiativeStrip: React.FC = () => {
    const open = useStore(stripOpenStore)
    const s = useStore(initStore)
    const ui = useStore(uiStore)
    const pick = useStore(stripPickStore)
    const message = useStore(announceStore)
    const humbugs = useHumbugs()
    const layers = useLayerState()
    const tableMode = useTableMode()
    useStore(partyStore)
    const titleId = useId()
    const dragFrom = useRef<number | null>(null)
    const [dropAt, setDropAt] = useState<number | null>(null)

    if (!open) return null

    const byId = new Map(humbugs.map((h) => [h.id, h]))
    const rows = s.order
        .map((c, i) => ({ c, i, h: byId.get(c.id) }))
        .filter((r) => isToken(r.h) && !isHumbugHidden(r.h, layers, tableMode))
    const picked = rows.find((r) => r.c.id === pick)
    const editing = !tableMode

    const endDrag = () => {
        dragFrom.current = null
        setDropAt(null)
    }

    return (
        <section className='tracker-strip tracker-panel' aria-labelledby={titleId}>
            <div className='tracker-strip-main'>
                <div className='tracker-round'>
                    <span id={titleId} className='tracker-title'>
                        Round
                    </span>
                    <strong className='tracker-round-num'>{s.round}</strong>
                </div>
                <button
                    type='button'
                    className='tracker-btn tracker-btn--primary'
                    onClick={nextTurn}
                    aria-keyshortcuts='N'
                    title='Next turn (N)'
                >
                    <span className='tracker-btn-icon'>
                        <NextIcon />
                    </span>
                    Next <Key k='N' />
                </button>
                <button
                    type='button'
                    className='tracker-icon-btn'
                    onClick={flyToActive}
                    aria-label='Fly to whoever has the turn'
                    title='Fly to whoever has the turn'
                >
                    <FlyToIcon />
                </button>

                <ol className='tracker-order' aria-label='Turn order'>
                    {rows.length === 0 && (
                        <li className='tracker-empty'>
                            {editing ? "Select tokens and press Shift+U, or use Add all." : "No one in the fight yet."}
                        </li>
                    )}
                    {rows.map(({ c, i, h }) => {
                        if (!isToken(h)) return null
                        const active = i === s.active
                        const side = sideOf(h)
                        const name = nameOf(h)
                        const dead = h.conditions?.includes("dead")
                        const label = [
                            name,
                            side === "party" ? "party" : "foe",
                            c.init != null ? `initiative ${c.init}` : null,
                            dead ? "dead" : null,
                            active ? "has the turn" : null,
                        ]
                            .filter(Boolean)
                            .join(", ")
                        return (
                            <li
                                key={c.id}
                                className={`tracker-item ${active ? "active" : ""} ${pick === c.id ? "picked" : ""} ${
                                    dead ? "dead" : ""
                                } ${dropAt === i ? "drop" : ""} side-${side}`}
                                aria-current={active ? "step" : undefined}
                                draggable={editing}
                                onDragStart={(e) => {
                                    dragFrom.current = i
                                    e.dataTransfer.effectAllowed = "move"
                                    e.dataTransfer.setData("text/plain", c.id)
                                }}
                                onDragOver={(e) => {
                                    if (dragFrom.current === null) return
                                    e.preventDefault()
                                    if (dropAt !== i) setDropAt(i)
                                }}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    if (dragFrom.current !== null) moveInInitiative(dragFrom.current, i)
                                    endDrag()
                                }}
                                onDragEnd={endDrag}
                            >
                                <button
                                    type='button'
                                    className='tracker-portrait'
                                    aria-label={label}
                                    aria-pressed={editing ? pick === c.id : undefined}
                                    title={`${label}${editing ? ". Click to pick, double-click to fly there" : ""}`}
                                    onClick={() => {
                                        if (!editing) return flyToHumbug(c.id)
                                        stripPickStore.set(pick === c.id ? null : c.id)
                                        selectHumbugs([c.id])
                                    }}
                                    onDoubleClick={() => flyToHumbug(c.id)}
                                >
                                    <img src={h.imageUrl} alt='' draggable={false} />
                                    <span className='tracker-side-mark' aria-hidden='true'>
                                        {side === "party" ? <ShieldIcon /> : <FangIcon />}
                                    </span>
                                    {c.init != null && (
                                        <span className='tracker-init-num' aria-hidden='true'>
                                            {c.init}
                                        </span>
                                    )}
                                    {dead && (
                                        <span className='tracker-dead-mark' aria-hidden='true'>
                                            <ConditionGlyph id='dead' size={14} />
                                        </span>
                                    )}
                                </button>
                                <span className='tracker-name' aria-hidden='true'>
                                    {active && <span className='tracker-turn-arrow'>▶</span>}
                                    {name}
                                </span>
                            </li>
                        )
                    })}
                </ol>

                {editing && (
                    <div className='tracker-strip-actions'>
                        <button
                            type='button'
                            className='tracker-icon-btn'
                            onClick={addSelectedToInitiative}
                            aria-label='Add selected tokens'
                            aria-keyshortcuts='Shift+U'
                            title='Add selected tokens (Shift+U)'
                        >
                            <AddInitiativeIcon />
                        </button>
                        <button type='button' className='tracker-btn' onClick={addAllToInitiative}>
                            Add all
                        </button>
                        <button type='button' className='tracker-btn' onClick={rollInitiative}>
                            <span className='tracker-btn-icon'>
                                <DiceIcon />
                            </span>
                            Roll
                        </button>
                        <button
                            type='button'
                            className='tracker-icon-btn'
                            aria-label='Initiative options'
                            aria-pressed={ui.stripTools}
                            aria-expanded={ui.stripTools}
                            title='Initiative options'
                            onClick={() => uiStore.set((u) => ({ ...u, stripTools: !u.stripTools }))}
                        >
                            <InitiativeIcon />
                        </button>
                        <button
                            type='button'
                            className='tracker-icon-btn'
                            aria-label='Hide initiative (U)'
                            title='Hide initiative (U)'
                            onClick={() => setStripOpen(false)}
                        >
                            ×
                        </button>
                    </div>
                )}
            </div>

            {editing && ui.stripTools && (
                <div className='tracker-strip-tools'>
                    <div className='tracker-seg' role='radiogroup' aria-label='Initiative method'>
                        {(
                            [
                                ["side", "Sides (d6)"],
                                ["individual", "Individual"],
                            ] as const
                        ).map(([mode, text]) => (
                            <button
                                key={mode}
                                type='button'
                                role='radio'
                                aria-checked={s.mode === mode}
                                className={`tracker-btn ${s.mode === mode ? "on" : ""}`}
                                onClick={() => s.mode !== mode && setInitOptions({ mode })}
                            >
                                {text}
                            </button>
                        ))}
                    </div>
                    {s.mode === "individual" ? (
                        <div className='tracker-seg' role='radiogroup' aria-label='Initiative die'>
                            {([20, 6] as const).map((die) => (
                                <button
                                    key={die}
                                    type='button'
                                    role='radio'
                                    aria-checked={s.die === die}
                                    className={`tracker-btn ${s.die === die ? "on" : ""}`}
                                    onClick={() => s.die !== die && setInitOptions({ die })}
                                >
                                    d{die}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <label className='tracker-check'>
                            <input
                                type='checkbox'
                                checked={s.rerollEachRound}
                                onChange={(e) => setInitOptions({ rerollEachRound: e.target.checked })}
                            />
                            Re-roll each round
                        </label>
                    )}
                    {s.sideRolls && s.mode === "side" && (
                        <span className='tracker-side-rolls'>
                            Party {s.sideRolls.party} · Monsters {s.sideRolls.foe}
                        </span>
                    )}

                    <span className='tracker-divider' aria-hidden='true' />

                    {picked && isToken(picked.h) ? (
                        <div className='tracker-picked' role='group' aria-label={`Change ${nameOf(picked.h)}`}>
                            <span className='tracker-picked-name'>{nameOf(picked.h)}</span>
                            <button
                                type='button'
                                className='tracker-icon-btn'
                                aria-label='Move earlier'
                                title='Move earlier'
                                disabled={picked.i === 0}
                                onClick={() => moveInInitiative(picked.i, picked.i - 1)}
                            >
                                ◀
                            </button>
                            <button
                                type='button'
                                className='tracker-icon-btn'
                                aria-label='Move later'
                                title='Move later'
                                disabled={picked.i === s.order.length - 1}
                                onClick={() => moveInInitiative(picked.i, picked.i + 1)}
                            >
                                ▶
                            </button>
                            <div className='tracker-seg' role='radiogroup' aria-label='Side'>
                                {(["party", "foe"] as const).map((side) => (
                                    <button
                                        key={side}
                                        type='button'
                                        role='radio'
                                        aria-checked={sideOf(picked.h!) === side}
                                        className={`tracker-btn ${sideOf(picked.h!) === side ? "on" : ""}`}
                                        onClick={() => sideOf(picked.h!) !== side && setSide(picked.c.id, side)}
                                    >
                                        <span className='tracker-btn-icon'>
                                            {side === "party" ? <ShieldIcon /> : <FangIcon />}
                                        </span>
                                        {side === "party" ? "Party" : "Foe"}
                                    </button>
                                ))}
                            </div>
                            {s.mode === "individual" && (
                                <div className='tracker-stepper' role='group' aria-label='Initiative modifier'>
                                    <button
                                        type='button'
                                        className='tracker-icon-btn'
                                        aria-label='Lower modifier'
                                        disabled={picked.c.mod <= -5}
                                        onClick={() => setCombatantMod(picked.c.id, picked.c.mod - 1)}
                                    >
                                        −
                                    </button>
                                    <span className='tracker-stepper-val' aria-live='polite'>
                                        {formatMod(picked.c.mod)}
                                    </span>
                                    <button
                                        type='button'
                                        className='tracker-icon-btn'
                                        aria-label='Raise modifier'
                                        disabled={picked.c.mod >= 5}
                                        onClick={() => setCombatantMod(picked.c.id, picked.c.mod + 1)}
                                    >
                                        +
                                    </button>
                                </div>
                            )}
                            <button
                                type='button'
                                className='tracker-btn tracker-btn--harm'
                                onClick={() => {
                                    removeFromInitiative(picked.c.id)
                                    stripPickStore.set(null)
                                }}
                            >
                                Remove
                            </button>
                        </div>
                    ) : (
                        <span className='tracker-hint'>Pick a portrait to move or remove it, or drag to reorder.</span>
                    )}

                    <button
                        type='button'
                        className='tracker-btn tracker-push-end'
                        disabled={!s.order.length}
                        onClick={clearInitiative}
                    >
                        Clear
                    </button>
                </div>
            )}

            <div className='tracker-sr' aria-live='polite' role='status'>
                {message}
            </div>
        </section>
    )
}
