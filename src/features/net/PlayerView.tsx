import React, { useEffect, useState } from "react"
import type { Humbug, LightSource } from "../../types/humbug.types"
import { loadParty, MAX_PARTY, onPartyChanged, type PartyMember } from "../../utils/party"
import { flyTo } from "../../utils/view-events"
import { selectHumbugs, updateHumbugs, useHumbugs } from "../board-bridge"
import { LIGHT_PRESETS } from "../fog-light/light-store"
import { VISION_PRESETS, visionFeet } from "../fog-light/vision"
import { useStore } from "../store"
import {
    addCharacter,
    characterPrefsStore,
    forgetCharacter,
    placingFor,
    prefsOf,
    renameCharacter,
    setPrefs,
} from "./characters"
import {
    clientStore,
    followGm,
    leaveGame,
    placingStore,
    removeMyToken,
    renameMyToken,
    rulesStore,
    undoMyMove,
} from "./client"
import { ownerOf } from "./filter"
import { NET_EXT, type NetExt } from "./protocol"

const STATUS_TEXT = {
    connecting: "Looking for the GM…",
    waiting: "Knocking. Waiting for the GM to let you in…",
    connected: "Connected",
    lost: "Lost the GM",
    refused: "Not connected",
    ended: "Not connected",
} as const

const lightIdOf = (h: Humbug) => {
    if (!h.light) return "none"
    const p = LIGHT_PRESETS.find((x) => x.light.bright === h.light!.bright && x.light.dim === h.light!.dim)
    return p?.id ?? "custom"
}

const charOf = (h: Humbug) => (h.ext?.[NET_EXT] as NetExt | undefined)?.char

const LightSelect: React.FC<{ value: string; onChange: (id: string) => void; label: string }> = ({ value, onChange, label }) => (
    <label className='net-field'>
        <span>{label}</span>
        <select className='net-input' value={value} onChange={(e) => onChange(e.currentTarget.value)}>
            <option value='none'>None</option>
            {LIGHT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                    {p.label}
                </option>
            ))}
            {value === "custom" && <option value='custom'>Set by the GM</option>}
        </select>
    </label>
)

const VisionSelect: React.FC<{ value: number; onChange: (feet: number) => void }> = ({ value, onChange }) => (
    <label className='net-field'>
        <span>Vision</span>
        <select className='net-input' value={value} onChange={(e) => onChange(Number(e.currentTarget.value))}>
            {VISION_PRESETS.map((p) => (
                <option key={p.feet} value={p.feet}>
                    {p.label}
                </option>
            ))}
        </select>
    </label>
)

/** A token of mine on the table */
const MyToken: React.FC<{ h: Humbug }> = ({ h }) => {
    const name = (h.type === "token" && h.name) || "My token"
    const setLight = (id: string) => {
        const preset = LIGHT_PRESETS.find((p) => p.id === id)
        const light: LightSource | undefined = preset ? { ...preset.light } : undefined
        updateHumbugs([{ id: h.id, changes: { light } }])
    }
    const setVision = (feet: number) =>
        updateHumbugs([
            { id: h.id, changes: { ext: { ...h.ext, "fog-light": { ...(h.ext?.["fog-light"] as object), vision: feet } } } },
        ])
    return (
        <li className='net-token'>
            <div className='net-player-head'>
                <input
                    key={name}
                    className='net-input net-name'
                    defaultValue={name}
                    maxLength={40}
                    aria-label={`Name of ${name}`}
                    onBlur={(e) => e.currentTarget.value.trim() !== name && renameMyToken(h.id, e.currentTarget.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
                <button
                    type='button'
                    className='jv-button'
                    onClick={() => {
                        flyTo({ x: h.position.x + 16, y: h.position.y + 16 })
                        selectHumbugs([h.id])
                    }}
                >
                    Go to
                </button>
            </div>
            <div className='net-two'>
                <LightSelect label='Light' value={lightIdOf(h)} onChange={setLight} />
                <VisionSelect value={visionFeet(h)} onChange={setVision} />
            </div>
            <button type='button' className='jv-button net-quiet' onClick={() => removeMyToken(h.id)}>
                Take off the table
            </button>
        </li>
    )
}

/** One of my saved characters */
const Character: React.FC<{
    m: PartyMember
    onTable: boolean
    canPlace: boolean
    why: string
}> = ({ m, onTable, canPlace, why }) => {
    useStore(characterPrefsStore)
    const prefs = prefsOf(m.id)
    const placing = useStore(placingStore)
    const [busy, setBusy] = useState(false)
    const [note, setNote] = useState("")
    const isPlacing = placing?.char === m.id

    const place = async () => {
        if (isPlacing) return placingStore.set(null)
        setBusy(true)
        setNote("")
        try {
            placingStore.set(await placingFor(m))
        } catch {
            setNote("Couldn't read this character's picture.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <li className='net-token net-char'>
            <div className='net-char-head'>
                <img className='net-char-img' src={m.imageUrl} alt='' />
                <input
                    key={m.name}
                    className='net-input net-name'
                    defaultValue={m.name}
                    maxLength={40}
                    aria-label={`Name of ${m.name}`}
                    onBlur={(e) => e.currentTarget.value.trim() !== m.name && void renameCharacter(m.id, e.currentTarget.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
                <button
                    type='button'
                    className='jv-button'
                    aria-label={`Forget ${m.name}`}
                    title='Remove from my characters'
                    onClick={() => void forgetCharacter(m.id)}
                >
                    <span aria-hidden='true'>×</span>
                </button>
            </div>
            <div className='net-two'>
                <LightSelect label='Starts with light' value={prefs.light} onChange={(light) => setPrefs(m.id, { light })} />
                <VisionSelect value={prefs.vision} onChange={(vision) => setPrefs(m.id, { vision })} />
            </div>
            {onTable ? (
                <p className='net-hint'>On the table.</p>
            ) : (
                <button
                    type='button'
                    className={`jv-button ${isPlacing ? "" : "jv-button-primary"}`}
                    aria-pressed={isPlacing}
                    disabled={busy || (!canPlace && !isPlacing)}
                    title={canPlace ? "Then click a spot on the map you can see" : why}
                    onClick={() => void place()}
                >
                    {isPlacing ? "Cancel placing" : "Place on map"}
                </button>
            )}
            {note && (
                <p className='net-error' role='alert'>
                    {note}
                </p>
            )}
        </li>
    )
}

const NewCharacter: React.FC<{ defaultName: string; full: boolean }> = ({ defaultName, full }) => {
    const [name, setName] = useState(defaultName)
    const [note, setNote] = useState("")
    const [busy, setBusy] = useState(false)
    if (full) return <p className='net-hint'>You have {MAX_PARTY} characters, the most this app keeps.</p>
    return (
        <details className='net-new-char'>
            <summary>New character…</summary>
            <label className='net-field'>
                <span>Name</span>
                <input className='net-input' value={name} maxLength={40} onChange={(e) => setName(e.currentTarget.value)} />
            </label>
            <label className='jv-button net-upload'>
                {busy ? "Saving…" : "Choose a picture…"}
                <input
                    type='file'
                    accept='image/*'
                    disabled={busy}
                    onChange={(e) => {
                        const f = e.currentTarget.files?.[0]
                        e.currentTarget.value = ""
                        if (!f) return
                        setBusy(true)
                        void addCharacter(name, f).then((err) => {
                            setBusy(false)
                            setNote(err ?? `Saved ${name.trim() || "your character"} in this app.`)
                        })
                    }}
                />
            </label>
            <p className='net-hint' role='status' aria-live='polite'>
                {note}
            </p>
        </details>
    )
}

export const PlayerView: React.FC<{ defaultName: string }> = ({ defaultName }) => {
    const client = useStore(clientStore)
    const rules = useStore(rulesStore)
    const humbugs = useHumbugs()
    const [party, setParty] = useState<PartyMember[]>([])
    useEffect(() => {
        const load = () => void loadParty().then(setParty)
        load()
        return onPartyChanged(load)
    }, [])
    if (!client) return null
    const mine = client.you ? humbugs.filter((h) => ownerOf(h) === client.you) : []
    const placed = new Set(mine.map(charOf).filter(Boolean))
    const room = mine.length < rules.maxTokens
    const why = rules.frozen
        ? "The GM has paused your tokens"
        : room
          ? ""
          : `You have ${rules.maxTokens} token${rules.maxTokens === 1 ? "" : "s"} on the table, the most the GM allows`

    return (
        <div className='net-body'>
            <section aria-labelledby='net-status-title'>
                <h3 id='net-status-title'>Game</h3>
                <p role='status' aria-live='polite' className='net-status'>
                    <strong>{STATUS_TEXT[client.status]}</strong>
                    {client.hostName && client.status === "connected" ? ` to ${client.hostName}'s table` : ""}
                </p>
                {client.message && <p className='net-hint'>{client.message}</p>}
                {client.sharing && (
                    <button
                        type='button'
                        className='jv-button jv-button-primary net-toggle'
                        aria-pressed={client.following}
                        onClick={() => followGm(!client.following)}
                    >
                        {client.following ? "Following the GM's view (stop)" : "Now sharing: look where the GM is looking"}
                    </button>
                )}
            </section>

            {client.status === "connected" && (
                <>
                    {rules.frozen && (
                        <p className='net-notice' role='status'>
                            The GM has paused your tokens. You can still look around and roll.
                        </p>
                    )}
                    <section aria-labelledby='net-mine-title'>
                        <h3 id='net-mine-title'>
                            On the table ({mine.length} of {rules.maxTokens})
                        </h3>
                        {mine.length ? (
                            <ul className='net-players'>
                                {mine.map((h) => (
                                    <MyToken key={h.id} h={h} />
                                ))}
                            </ul>
                        ) : (
                            <p className='net-hint'>Nothing yet. Place one of your characters below.</p>
                        )}
                        {mine.length > 0 && (
                            <>
                                <p className='net-hint'>
                                    Drag your token to move it
                                    {rules.fenced ? ", within what the party can see" : ""}.
                                </p>
                                <button type='button' className='jv-button' onClick={() => undoMyMove()}>
                                    Undo my last move
                                </button>
                            </>
                        )}
                    </section>

                    <section aria-labelledby='net-chars-title'>
                        <h3 id='net-chars-title'>My characters</h3>
                        <p className='net-hint'>
                            Kept in this app for any game. Place one, then click a spot on the map you can see
                            {rules.approve ? " (the GM approves new tokens)" : ""}.
                        </p>
                        {party.length > 0 && (
                            <ul className='net-players'>
                                {party.map((m) => (
                                    <Character
                                        key={m.id}
                                        m={m}
                                        onTable={placed.has(m.id)}
                                        canPlace={room && !rules.frozen}
                                        why={why}
                                    />
                                ))}
                            </ul>
                        )}
                        <NewCharacter defaultName={party.length ? "" : defaultName} full={party.length >= MAX_PARTY} />
                    </section>
                </>
            )}

            <button type='button' className='jv-button net-danger' onClick={() => void leaveGame()}>
                Leave game
            </button>
        </div>
    )
}
