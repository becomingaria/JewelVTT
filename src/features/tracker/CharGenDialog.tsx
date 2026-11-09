import React, { useEffect, useId, useRef, useState } from "react"
import type { TokenHumbug } from "../../types/humbug.types"
import { GRID_SIZE, addHumbugs, cameraStore, humbugBase, viewCentreWorld } from "../board-bridge"
import { cellAt, cellCenter } from "../grid"
import { logEvent, rollDice } from "../services"
import { playSfx } from "../sound"
import { useStore } from "../store"
import { TokenLibraryDrawer } from "../../components/TokenLibraryDrawer"
import {
    addToParty,
    loadParty,
    notifyPartyChanged,
    saveParty,
    type PartyMember,
} from "../../utils/party"
import { showToast } from "../../utils/toast"
import {
    CLASSES,
    STATS,
    STAT_NAMES,
    abilityMod,
    dropLowest,
    firstLevelHp,
    formatMod,
    type CharacterSheet,
    type RollMethod,
    type StatKey,
} from "./logic"
import { chargenOpenStore } from "./state"
import { defaultPortrait } from "./portrait"
import { DiceIcon } from "./icons"

interface StatRoll {
    total: number
    dice: number[]
    /** Index of the dropped die (4d6 drop lowest), else -1 */
    dropped: number
}

const METHOD_LABEL: Record<RollMethod, string> = {
    "3d6": "3d6 in order",
    "4d6dl": "4d6, drop the lowest",
}

function rollStat(key: StatKey, method: RollMethod): StatRoll {
    const expr = method === "3d6" ? "3d6" : "4d6"
    // The dialog shows every die; the log gets one exact line per stat
    const r = rollDice(expr, { label: `${STAT_NAMES[key]} (${METHOD_LABEL[method]})`, show: false, log: false })
    const dice = r.rolls.length ? r.rolls.map((d) => d.value) : [r.total]
    const { total, dropped } = method === "4d6dl" && dice.length === 4 ? dropLowest(dice) : { total: r.total, dropped: -1 }
    const shown = dice.map((d, i) => (i === dropped ? `(${d})` : String(d))).join(" ")
    logEvent({
        kind: "roll",
        text: `New character ${key}: ${expr}${method === "4d6dl" ? " drop lowest" : ""} [${shown}] = ${total}`,
    })
    return { total, dice, dropped }
}

/** Place the new character as a token in the middle of the view */
function placeToken(name: string, imageUrl: string, hp: number, sheet: CharacterSheet): string {
    const shape = cameraStore.get()?.gridShape ?? "square"
    const c = cellCenter(cellAt(viewCentreWorld(), shape), shape)
    const base = humbugBase({ x: c.x - GRID_SIZE / 2, y: c.y - GRID_SIZE / 2 })
    const token: TokenHumbug = {
        ...base,
        type: "token",
        imageUrl,
        size: { width: GRID_SIZE, height: GRID_SIZE },
        originalSize: { width: GRID_SIZE, height: GRID_SIZE },
        borderColor: "#6c2fcf",
        borderWidth: 2,
        name,
        hp: { current: hp, max: hp },
        ext: { tracker: { side: "party", sheet } },
    }
    addHumbugs([token], { select: true })
    return base.id
}

async function joinParty(imageUrl: string, name: string) {
    const res = await addToParty(imageUrl)
    if (res === "added") {
        // addToParty names members after the file; use the character's name
        const party = await loadParty()
        await saveParty(party.map((m) => (m.imageUrl === imageUrl ? { ...m, name } : m)))
        notifyPartyChanged()
        showToast(`${name} joined My Party.`)
    } else if (res === "full") {
        showToast("My Party is full (8). The token is on the board but not in the party.")
    } else {
        showToast("That portrait is already in My Party.")
    }
}

const close = () => chargenOpenStore.set(false)

/** The character generator ("New character…") */
export const CharGenDialog: React.FC = () => {
    const open = useStore(chargenOpenStore)
    return open ? <CharGenBody /> : null
}

const CharGenBody: React.FC = () => {
    const [method, setMethod] = useState<RollMethod>("3d6")
    const [allowReroll, setAllowReroll] = useState(false)
    const [stats, setStats] = useState<Partial<Record<StatKey, StatRoll>>>({})
    const [classId, setClassId] = useState<string | null>(null)
    const [hpRoll, setHpRoll] = useState<number | null>(null)
    const [name, setName] = useState("")
    const [portrait, setPortrait] = useState<string | null>(null)
    const [party, setParty] = useState<PartyMember[]>([])
    const [picking, setPicking] = useState(false)
    const [addParty, setAddParty] = useState(true)
    const [status, setStatus] = useState("")
    const ref = useRef<HTMLDivElement>(null)
    const titleId = useId()
    const nameId = useId()
    const pickingRef = useRef(picking)
    useEffect(() => {
        pickingRef.current = picking
    }, [picking])

    useEffect(() => {
        let alive = true
        void loadParty().then((p) => alive && setParty(p))
        return () => {
            alive = false
        }
    }, [])

    // Focus in on open, back on close; Esc closes (unless the library is open)
    useEffect(() => {
        const back = document.activeElement as HTMLElement | null
        ref.current?.querySelector<HTMLElement>("button, input")?.focus()
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !pickingRef.current) {
                e.preventDefault()
                close()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => {
            window.removeEventListener("keydown", onKey)
            if (back && document.contains(back)) back.focus()
        }
    }, [])

    // Keep Tab inside the dialog
    const trapTab = (e: React.KeyboardEvent) => {
        if (e.key !== "Tab" || !ref.current) return
        const items = [
            ...ref.current.querySelectorAll<HTMLElement>(
                "button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex='-1'])"
            ),
        ]
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
        }
    }

    const rolled = STATS.every((k) => stats[k])
    const anyRolled = STATS.some((k) => stats[k])
    const cls = CLASSES.find((c) => c.id === classId) ?? null
    const con = stats.CON?.total
    const hp = hpRoll != null && con != null ? firstLevelHp(hpRoll, con) : null

    const rollAll = () => {
        const next: Partial<Record<StatKey, StatRoll>> = {}
        for (const k of STATS) next[k] = rollStat(k, method)
        setStats(next)
        setHpRoll(null)
        playSfx("dice")
        setStatus(`Rolled: ${STATS.map((k) => `${k} ${next[k]!.total}`).join(", ")}.`)
    }

    const reroll = (k: StatKey) => {
        const r = rollStat(k, method)
        setStats((s) => ({ ...s, [k]: r }))
        if (k === "CON") setHpRoll(null)
        playSfx("dice")
        setStatus(`${STAT_NAMES[k]} re-rolled: ${r.total}.`)
    }

    const rollHp = () => {
        if (!cls || con == null) return
        const r = rollDice(`1d${cls.hitDie}`, { label: `Hit points (${cls.label})`, show: false, log: false })
        const total = firstLevelHp(r.total, con)
        setHpRoll(r.total)
        logEvent({
            kind: "roll",
            text: `New character HP: 1d${cls.hitDie} (${r.total}) ${formatMod(abilityMod(con))} CON = ${total}`,
        })
        playSfx("dice")
        setStatus(`Hit points: ${total}.`)
    }

    const ready = rolled && !!cls && hp != null && name.trim().length > 0
    const missing = !rolled
        ? "Roll the abilities first."
        : !cls
          ? "Pick a class."
          : hp == null
            ? "Roll hit points."
            : !name.trim()
              ? "Give them a name."
              : ""

    const place = () => {
        if (!ready || !cls || hp == null || hpRoll == null) return
        const nm = name.trim()
        const sheet: CharacterSheet = {
            classId: cls.id,
            className: cls.label,
            level: 1,
            stats: Object.fromEntries(STATS.map((k) => [k, stats[k]!.total])) as Record<StatKey, number>,
            method,
            hitDieRoll: hpRoll,
        }
        const imageUrl = portrait ?? defaultPortrait(cls.id, nm, cls.label)
        placeToken(nm, imageUrl, hp, sheet)
        playSfx("place")
        logEvent({
            kind: "note",
            text: `New character: ${nm} the ${cls.label}, HP ${hp} (${STATS.map((k) => `${k} ${sheet.stats[k]}`).join(", ")})`,
        })
        if (addParty) void joinParty(imageUrl, nm)
        showToast(`${nm} the ${cls.label} is on the board.`)
        close()
    }

    return (
        <div className='tracker-modal-backdrop' onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <div
                ref={ref}
                className='tracker-chargen tracker-panel'
                role='dialog'
                aria-modal='true'
                aria-labelledby={titleId}
                onKeyDown={trapTab}
            >
                <div className='tracker-pop-head'>
                    <h2 id={titleId} className='tracker-title tracker-title--big'>
                        New character
                    </h2>
                    <button type='button' className='tracker-icon-btn' aria-label='Close' onClick={close}>
                        ×
                    </button>
                </div>

                {/* 1. Abilities */}
                <section className='tracker-cg-step' aria-labelledby={`${titleId}-a`}>
                    <h3 id={`${titleId}-a`} className='tracker-cg-h'>
                        1. Abilities
                    </h3>
                    <div className='tracker-pop-row'>
                        <div className='tracker-seg' role='radiogroup' aria-label='Rolling method'>
                            {(["3d6", "4d6dl"] as const).map((m) => (
                                <button
                                    key={m}
                                    type='button'
                                    role='radio'
                                    aria-checked={method === m}
                                    className={`tracker-btn ${method === m ? "on" : ""}`}
                                    onClick={() => setMethod(m)}
                                >
                                    {METHOD_LABEL[m]}
                                </button>
                            ))}
                        </div>
                        <label className='tracker-check'>
                            <input
                                type='checkbox'
                                checked={allowReroll}
                                onChange={(e) => setAllowReroll(e.target.checked)}
                            />
                            GM allows re-rolls
                        </label>
                        <button type='button' className='tracker-btn tracker-btn--primary' onClick={rollAll}>
                            <span className='tracker-btn-icon'>
                                <DiceIcon />
                            </span>
                            {anyRolled ? "Roll all again" : "Roll abilities"}
                        </button>
                    </div>
                    <table className='tracker-cg-stats'>
                        <thead>
                            <tr>
                                <th scope='col'>Ability</th>
                                <th scope='col'>Dice</th>
                                <th scope='col'>Score</th>
                                <th scope='col'>Mod</th>
                                {allowReroll && (
                                    <th scope='col'>
                                        <span className='tracker-sr'>Re-roll</span>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {STATS.map((k) => {
                                const r = stats[k]
                                return (
                                    <tr key={k}>
                                        <th scope='row' title={STAT_NAMES[k]}>
                                            <abbr title={STAT_NAMES[k]}>{k}</abbr>
                                        </th>
                                        <td className='tracker-cg-dice'>
                                            {r
                                                ? r.dice.map((d, i) => (
                                                      <span
                                                          key={i}
                                                          className={`tracker-die ${i === r.dropped ? "dropped" : ""}`}
                                                          aria-label={i === r.dropped ? `${d}, dropped` : String(d)}
                                                      >
                                                          {d}
                                                      </span>
                                                  ))
                                                : "—"}
                                        </td>
                                        <td className='tracker-cg-score'>{r ? r.total : "—"}</td>
                                        <td>{r ? formatMod(abilityMod(r.total)) : ""}</td>
                                        {allowReroll && (
                                            <td>
                                                <button
                                                    type='button'
                                                    className='tracker-btn'
                                                    disabled={!r}
                                                    onClick={() => reroll(k)}
                                                    aria-label={`Re-roll ${STAT_NAMES[k]}`}
                                                >
                                                    Re-roll
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </section>

                {/* 2. Class and hit points */}
                <section className='tracker-cg-step' aria-labelledby={`${titleId}-c`}>
                    <h3 id={`${titleId}-c`} className='tracker-cg-h'>
                        2. Class and hit points
                    </h3>
                    <div className='tracker-cg-classes' role='radiogroup' aria-label='Class'>
                        {CLASSES.map((c) => (
                            <button
                                key={c.id}
                                type='button'
                                role='radio'
                                aria-checked={classId === c.id}
                                className={`tracker-cg-class ${classId === c.id ? "on" : ""}`}
                                onClick={() => {
                                    if (classId !== c.id) setHpRoll(null)
                                    setClassId(c.id)
                                }}
                                title={c.blurb}
                            >
                                <strong>{c.label}</strong>
                                <span>d{c.hitDie}</span>
                            </button>
                        ))}
                    </div>
                    <div className='tracker-pop-row'>
                        <button
                            type='button'
                            className='tracker-btn'
                            disabled={!cls || con == null}
                            onClick={rollHp}
                        >
                            <span className='tracker-btn-icon'>
                                <DiceIcon />
                            </span>
                            {hpRoll == null ? "Roll hit points" : "Roll again"}
                        </button>
                        <span className='tracker-cg-hp'>
                            {hp != null && cls && con != null ? (
                                <>
                                    d{cls.hitDie} rolled <strong>{hpRoll}</strong> {formatMod(abilityMod(con))} CON ={" "}
                                    <strong className='tracker-cg-hp-total'>{hp} HP</strong>
                                </>
                            ) : (
                                <span className='tracker-muted'>
                                    {cls ? `${cls.label}: d${cls.hitDie} + CON modifier, at least 1` : "Pick a class"}
                                </span>
                            )}
                        </span>
                    </div>
                </section>

                {/* 3. Name and portrait */}
                <section className='tracker-cg-step' aria-labelledby={`${titleId}-n`}>
                    <h3 id={`${titleId}-n`} className='tracker-cg-h'>
                        3. Name and portrait
                    </h3>
                    <div className='tracker-pop-row'>
                        <label htmlFor={nameId}>Name</label>
                        <input
                            id={nameId}
                            className='tracker-text'
                            type='text'
                            maxLength={40}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder='e.g. Kira'
                            autoComplete='off'
                        />
                    </div>
                    <div className='tracker-cg-portraits' role='radiogroup' aria-label='Portrait'>
                        <button
                            type='button'
                            role='radio'
                            aria-checked={portrait === null}
                            className={`tracker-cg-portrait ${portrait === null ? "on" : ""}`}
                            onClick={() => setPortrait(null)}
                            title='A simple pixel portrait in the class colours'
                        >
                            <img
                                src={defaultPortrait(cls?.id ?? "", name, cls?.label ?? "?")}
                                alt=''
                                draggable={false}
                            />
                            <span>Default</span>
                        </button>
                        {party.map((m) => (
                            <button
                                key={m.id}
                                type='button'
                                role='radio'
                                aria-checked={portrait === m.imageUrl}
                                className={`tracker-cg-portrait ${portrait === m.imageUrl ? "on" : ""}`}
                                onClick={() => setPortrait(m.imageUrl)}
                                title={m.name}
                            >
                                <img src={m.imageUrl} alt='' draggable={false} />
                                <span>{m.name}</span>
                            </button>
                        ))}
                        {portrait && !party.some((m) => m.imageUrl === portrait) && (
                            <button
                                type='button'
                                role='radio'
                                aria-checked={true}
                                className='tracker-cg-portrait on'
                                title='From the token library'
                            >
                                <img src={portrait} alt='' draggable={false} />
                                <span>Library</span>
                            </button>
                        )}
                        <button type='button' className='tracker-btn' onClick={() => setPicking(true)}>
                            Token library…
                        </button>
                    </div>
                    <label className='tracker-check'>
                        <input type='checkbox' checked={addParty} onChange={(e) => setAddParty(e.target.checked)} />
                        Also add to My Party
                    </label>
                </section>

                <div className='tracker-cg-foot'>
                    <span className='tracker-muted' aria-live='polite'>
                        {missing}
                    </span>
                    <button type='button' className='tracker-btn' onClick={close}>
                        Cancel
                    </button>
                    <button
                        type='button'
                        className='tracker-btn tracker-btn--primary'
                        disabled={!ready}
                        onClick={place}
                    >
                        Place on board
                    </button>
                </div>
                <div className='tracker-sr' role='status' aria-live='polite'>
                    {status}
                </div>
            </div>

            <TokenLibraryDrawer
                isOpen={picking}
                onClose={() => setPicking(false)}
                onSelect={(url) => {
                    setPortrait(decodeURI(url))
                    setPicking(false)
                }}
            />
        </div>
    )
}
