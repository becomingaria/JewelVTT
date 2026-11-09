import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import type { TokenHumbug } from "../../types/humbug.types"
import { useCamera, useHumbugs } from "../board-bridge"
import { useStore } from "../store"
import { useTableMode } from "../view-state"
import { CONDITIONS, HP_BAND_LABEL, hpBand } from "./logic"
import { popoverStore } from "./state"
import {
    changeHp,
    clearConditions,
    clearHp,
    isToken,
    nameOf,
    setHpCurrent,
    setHpMaximum,
    sideOf,
    toggleCondition,
} from "./actions"
import { ConditionGlyph } from "./icons"

const close = () => popoverStore.set(null)

/** Hit points: quick damage/heal, a custom amount, and the maximum */
const HpBody: React.FC<{ token: TokenHumbug; showNumbers: boolean }> = ({ token, showNumbers }) => {
    const hp = token.hp
    const [amount, setAmount] = useState("")
    const [maxText, setMaxText] = useState(String(hp?.max ?? 8))
    const maxId = useId()
    const amountId = useId()

    useEffect(() => setMaxText(String(token.hp?.max ?? 8)), [token.hp?.max])

    const n = Math.abs(Math.round(Number(amount)))
    const amountOk = amount.trim() !== "" && Number.isFinite(n) && n > 0
    const maxN = Math.round(Number(maxText))
    const maxOk = Number.isFinite(maxN) && maxN >= 1 && maxN <= 999

    const setMax = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (maxOk) setHpMaximum(token.id, maxN)
    }

    if (!hp) {
        return (
            <form className='tracker-pop-row' onSubmit={setMax}>
                <p className='tracker-pop-note'>No hit points yet.</p>
                <label htmlFor={maxId}>Max HP</label>
                <input
                    id={maxId}
                    className='tracker-num'
                    type='number'
                    min={1}
                    max={999}
                    value={maxText}
                    onChange={(e) => setMaxText(e.target.value)}
                />
                <button type='submit' className='tracker-btn' disabled={!maxOk}>
                    Set
                </button>
            </form>
        )
    }

    const band = hpBand(hp.current, hp.max)
    const dead = token.conditions?.includes("dead")

    return (
        <>
            <p className={`tracker-pop-readout tracker-hp--${band}`} aria-live='polite'>
                {showNumbers ? (
                    <>
                        <strong>{hp.current}</strong> / {hp.max}
                        <span className='tracker-pop-band'> {HP_BAND_LABEL[band]}</span>
                    </>
                ) : (
                    <strong>{HP_BAND_LABEL[band]}</strong>
                )}
            </p>
            <div className='tracker-pop-row' role='group' aria-label='Quick damage and healing'>
                {[-5, -1, 1, 5].map((d) => (
                    <button
                        key={d}
                        type='button'
                        className={`tracker-btn tracker-btn--${d < 0 ? "harm" : "heal"}`}
                        aria-label={d < 0 ? `Damage ${-d}` : `Heal ${d}`}
                        onClick={() => changeHp(token.id, d)}
                    >
                        {d < 0 ? `−${-d}` : `+${d}`}
                    </button>
                ))}
            </div>
            <form
                className='tracker-pop-row'
                onSubmit={(e) => {
                    e.preventDefault()
                    if (amountOk) changeHp(token.id, -n)
                }}
            >
                <label htmlFor={amountId}>Amount</label>
                <input
                    id={amountId}
                    className='tracker-num'
                    type='number'
                    min={1}
                    inputMode='numeric'
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                />
                <button type='submit' className='tracker-btn tracker-btn--harm' disabled={!amountOk}>
                    Damage
                </button>
                <button
                    type='button'
                    className='tracker-btn tracker-btn--heal'
                    disabled={!amountOk}
                    onClick={() => amountOk && changeHp(token.id, n)}
                >
                    Heal
                </button>
            </form>
            <form className='tracker-pop-row' onSubmit={setMax}>
                <label htmlFor={maxId}>Max HP</label>
                <input
                    id={maxId}
                    className='tracker-num'
                    type='number'
                    min={1}
                    max={999}
                    value={maxText}
                    onChange={(e) => setMaxText(e.target.value)}
                />
                <button type='submit' className='tracker-btn' disabled={!maxOk || maxN === hp.max}>
                    Set max
                </button>
                <button type='button' className='tracker-btn' onClick={() => setHpCurrent(token.id, hp.max)}>
                    Full
                </button>
            </form>
            {hp.current === 0 && !dead && (
                <div className='tracker-pop-suggest' role='status'>
                    <ConditionGlyph id='dead' size={16} />
                    <span>At 0 HP. Mark as dead?</span>
                    <button type='button' className='tracker-btn' onClick={() => toggleCondition(token.id, "dead")}>
                        Mark dead
                    </button>
                </div>
            )}
            <div className='tracker-pop-row tracker-pop-row--end'>
                <button type='button' className='tracker-link' onClick={() => clearHp(token.id)}>
                    Remove HP from this token
                </button>
            </div>
        </>
    )
}

/** Conditions checklist */
const ConditionsBody: React.FC<{ token: TokenHumbug }> = ({ token }) => {
    const on = new Set(token.conditions ?? [])
    return (
        <>
            <fieldset className='tracker-conds'>
                <legend className='tracker-sr'>Conditions</legend>
                {CONDITIONS.map((c) => (
                    <label key={c.id} className={`tracker-cond ${on.has(c.id) ? "on" : ""}`} title={c.hint}>
                        <input type='checkbox' checked={on.has(c.id)} onChange={() => toggleCondition(token.id, c.id)} />
                        <ConditionGlyph id={c.id} size={18} />
                        <span>{c.label}</span>
                    </label>
                ))}
            </fieldset>
            <div className='tracker-pop-row tracker-pop-row--end'>
                <button
                    type='button'
                    className='tracker-btn'
                    disabled={!on.size}
                    onClick={() => clearConditions(token.id)}
                >
                    Clear all
                </button>
            </div>
        </>
    )
}

/** Small panel next to a token, opened from its right-click menu */
export const TokenPopover: React.FC = () => {
    const pop = useStore(popoverStore)
    const humbugs = useHumbugs()
    const camera = useCamera()
    const tableMode = useTableMode()
    const ref = useRef<HTMLDivElement>(null)
    const returnFocus = useRef<HTMLElement | null>(null)
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
    const titleId = useId()

    const token = pop ? humbugs.find((h) => h.id === pop.id) : undefined

    // Follow the token as the board pans and zooms
    useLayoutEffect(() => {
        if (!pop || !ref.current) return
        const el = document.querySelector(`[data-humbug-id="${CSS.escape(pop.id)}"]`)
        const box = ref.current.getBoundingClientRect()
        const vw = window.innerWidth
        const vh = window.innerHeight
        if (!el) {
            setPos({ left: (vw - box.width) / 2, top: 80 })
            return
        }
        const r = el.getBoundingClientRect()
        let left = r.right + 12
        if (left + box.width > vw - 8) left = r.left - box.width - 12
        left = Math.max(8, Math.min(vw - box.width - 8, left))
        const top = Math.max(68, Math.min(vh - box.height - 8, r.top + r.height / 2 - box.height / 2))
        setPos((p) => (p && p.left === left && p.top === top ? p : { left, top }))
    }, [pop, camera, token])

    // Move focus in on open, give it back on close
    useEffect(() => {
        if (!pop) return
        returnFocus.current = document.activeElement as HTMLElement | null
        const t = window.setTimeout(() => {
            ref.current?.querySelector<HTMLElement>("button, input")?.focus()
        }, 0)
        return () => {
            window.clearTimeout(t)
            const back = returnFocus.current
            if (back && back !== document.body && document.contains(back)) back.focus()
        }
    }, [pop?.id, pop?.kind]) // eslint-disable-line react-hooks/exhaustive-deps

    // Click elsewhere closes it (it isn't modal)
    useEffect(() => {
        if (!pop) return
        const onDown = (e: PointerEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) close()
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close()
        }
        window.addEventListener("pointerdown", onDown, true)
        window.addEventListener("keydown", onKey)
        return () => {
            window.removeEventListener("pointerdown", onDown, true)
            window.removeEventListener("keydown", onKey)
        }
    }, [pop])

    // The token went away (deleted, scene switched): close
    useEffect(() => {
        if (pop && !isToken(token)) close()
    }, [pop, token])

    if (!pop || !isToken(token)) return null
    const name = nameOf(token)
    const showNumbers = !tableMode || sideOf(token) === "party"

    return (
        <div
            ref={ref}
            className='tracker-pop'
            role='dialog'
            aria-labelledby={titleId}
            style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}
        >
            <div className='tracker-pop-inner tracker-panel'>
                <div className='tracker-pop-head'>
                    <h2 id={titleId} className='tracker-title'>
                        {pop.kind === "hp" ? "Hit points" : "Conditions"}
                        <span className='tracker-pop-name'>{name}</span>
                    </h2>
                    <button type='button' className='tracker-icon-btn' aria-label='Close' onClick={close}>
                        ×
                    </button>
                </div>
                {pop.kind === "hp" ? (
                    <HpBody key={token.id} token={token} showNumbers={showNumbers} />
                ) : (
                    <ConditionsBody token={token} />
                )}
            </div>
        </div>
    )
}
