import React, { useState } from "react"
import { useStore } from "../store"
import { rollDice } from "../services"
import { DockPanel } from "./DockPanel"
import { PixelDie } from "./PixelDie"
import { RollFlag, RollResult } from "./RollResult"
import { DiceTrayIcon } from "./icons"
import { diceSettings, trayStore, type RollRecord } from "./state"
import { tablesStore } from "./tables-store"
import { rollTableAndShow } from "./roller"

const QUICK: { expr: string; label: string; sides?: number }[] = [
    { expr: "1d4", label: "d4", sides: 4 },
    { expr: "1d6", label: "d6", sides: 6 },
    { expr: "1d8", label: "d8", sides: 8 },
    { expr: "1d10", label: "d10", sides: 10 },
    { expr: "1d12", label: "d12", sides: 12 },
    { expr: "1d20", label: "d20", sides: 20 },
    { expr: "1d100", label: "d100", sides: 100 },
    { expr: "3d6", label: "3d6" },
    { expr: "adv", label: "Adv" },
    { expr: "dis", label: "Dis" },
]

const QUICK_HINT: Record<string, string> = {
    adv: "Advantage: roll two d20s, keep the higher",
    dis: "Disadvantage: roll two d20s, keep the lower",
}

function reroll(rec: RollRecord) {
    if (rec.table) {
        const t = tablesStore.get()?.find((x) => x.id === rec.table!.id)
        if (t) rollTableAndShow(t)
        return
    }
    rollDice(rec.expression, { label: rec.label })
}

export const DiceTray: React.FC = () => {
    const { last, history } = useStore(trayStore)
    const { boardDice } = useStore(diceSettings)
    const [expr, setExpr] = useState("")
    const [cursor, setCursor] = useState(-1)

    const roll = (e?: React.FormEvent) => {
        e?.preventDefault()
        const text = expr.trim()
        if (!text) return
        rollDice(text)
        setCursor(-1)
    }

    // Up/Down in the input steps through earlier expressions
    const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const exprs = history.filter((h) => !h.table).map((h) => h.expression)
        if (!exprs.length || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return
        e.preventDefault()
        const next = e.key === "ArrowUp" ? Math.min(cursor + 1, exprs.length - 1) : Math.max(cursor - 1, -1)
        setCursor(next)
        setExpr(next < 0 ? "" : exprs[next])
    }

    return (
        <DockPanel id='tray' title='Dice tray' icon={<DiceTrayIcon />}>
            <form className='jv-row' onSubmit={roll}>
                <label className='jv-sr' htmlFor='jv-dice-expr'>
                    Dice to roll
                </label>
                <input
                    id='jv-dice-expr'
                    data-autofocus
                    className='jv-input jv-mono'
                    value={expr}
                    onChange={(e) => setExpr(e.target.value)}
                    onKeyDown={onInputKey}
                    placeholder='e.g. 4d6kh3, adv+5'
                    autoComplete='off'
                    spellCheck={false}
                    aria-describedby='jv-dice-expr-hint'
                />
                <button type='submit' className='jv-btn jv-btn--primary' disabled={!expr.trim()}>
                    Roll
                </button>
            </form>
            <p id='jv-dice-expr-hint' className='jv-hint'>
                Enter rolls. ↑ ↓ recall earlier rolls.
            </p>

            <div className='jv-quick' role='group' aria-label='Quick rolls'>
                {QUICK.map((q) => (
                    <button
                        key={q.expr}
                        type='button'
                        className='jv-btn jv-quick-btn'
                        onClick={() => rollDice(q.expr)}
                        title={QUICK_HINT[q.expr] ?? `Roll ${q.label}`}
                        aria-label={QUICK_HINT[q.expr] ? undefined : `Roll ${q.label}`}
                    >
                        {q.sides ? <PixelDie sides={q.sides} value={q.sides} size={22} /> : null}
                        <span>{q.label}</span>
                    </button>
                ))}
            </div>

            <button
                type='button'
                className='jv-btn jv-toggle'
                aria-pressed={boardDice}
                onClick={() => diceSettings.set((s) => ({ ...s, boardDice: !s.boardDice }))}
            >
                <span className='jv-check' aria-hidden='true'>
                    {boardDice ? "✓" : ""}
                </span>
                Roll onto the board
            </button>

            <div className='jv-result-area' aria-live='polite' aria-atomic='true'>
                {last ? (
                    <RollResult key={last.id} rec={last} />
                ) : (
                    <p className='jv-hint'>Pick a die or type an expression. Results appear here.</p>
                )}
            </div>

            {history.length > 1 && (
                <section className='jv-history' aria-label='Recent rolls'>
                    <h3 className='jv-subhead'>Recent</h3>
                    <ol>
                        {history.slice(1, 9).map((h) => (
                            <li key={h.id}>
                                <button
                                    type='button'
                                    className='jv-history-btn'
                                    onClick={() => reroll(h)}
                                    title='Roll this again'
                                >
                                    <span className='jv-history-what'>
                                        {h.table ? h.table.name : `${h.label ? h.label + ": " : ""}${h.expression}`}
                                    </span>
                                    <span className='jv-history-total'>
                                        {h.table ? h.table.text : h.total}
                                    </span>
                                    <RollFlag rec={h} />
                                    <span className='jv-sr'>. Roll again.</span>
                                </button>
                            </li>
                        ))}
                    </ol>
                </section>
            )}
        </DockPanel>
    )
}
