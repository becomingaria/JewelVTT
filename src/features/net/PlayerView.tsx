import React, { useEffect, useState } from "react"
import type { Humbug, LightSource } from "../../types/humbug.types"
import { loadParty, type PartyMember } from "../../utils/party"
import { flyTo } from "../../utils/view-events"
import { selectHumbugs, updateHumbugs, useHumbugs } from "../board-bridge"
import { LIGHT_PRESETS } from "../fog-light/light-store"
import { VISION_PRESETS, visionFeet } from "../fog-light/vision"
import { useStore } from "../store"
import { clientStore, followGm, leaveGame, requestAddToken, undoMyMove } from "./client"
import { ownerOf } from "./filter"
import { MAX_TOKENS_PER_PLAYER } from "./protocol"

const STATUS_TEXT = {
    connecting: "Looking for the GM…",
    waiting: "Knocking. Waiting for the GM to let you in…",
    connected: "Connected",
    lost: "Lost the GM",
    refused: "Not connected",
    ended: "Not connected",
} as const

/** Shrink a picture to a token-sized PNG (keeps the connection light) */
async function toTokenImage(source: Blob): Promise<string> {
    const bmp = await createImageBitmap(source)
    const scale = Math.min(1, 256 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bmp.width * scale))
    canvas.height = Math.max(1, Math.round(bmp.height * scale))
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/png")
}

const lightIdOf = (h: Humbug) => {
    if (!h.light) return "none"
    const p = LIGHT_PRESETS.find((x) => x.light.bright === h.light!.bright && x.light.dim === h.light!.dim)
    return p?.id ?? "custom"
}

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
                <strong>{name}</strong>
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
            <label className='net-field'>
                <span>Light</span>
                <select className='net-input' value={lightIdOf(h)} onChange={(e) => setLight(e.currentTarget.value)}>
                    <option value='none'>None</option>
                    {LIGHT_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.label}
                        </option>
                    ))}
                    {lightIdOf(h) === "custom" && <option value='custom'>Set by the GM</option>}
                </select>
            </label>
            <label className='net-field'>
                <span>Vision</span>
                <select className='net-input' value={visionFeet(h)} onChange={(e) => setVision(Number(e.currentTarget.value))}>
                    {VISION_PRESETS.map((p) => (
                        <option key={p.feet} value={p.feet}>
                            {p.label}
                        </option>
                    ))}
                </select>
            </label>
        </li>
    )
}

const AddToken: React.FC<{ defaultName: string }> = ({ defaultName }) => {
    const [party, setParty] = useState<PartyMember[]>([])
    const [name, setName] = useState(defaultName)
    const [busy, setBusy] = useState(false)
    const [note, setNote] = useState("")
    useEffect(() => {
        void loadParty().then(setParty)
    }, [])

    const send = async (load: () => Promise<Blob>) => {
        setBusy(true)
        setNote("")
        try {
            requestAddToken(name, await toTokenImage(await load()))
            setNote("Sent to the GM. Your token appears in a moment.")
        } catch {
            setNote("Couldn't read that picture. Try a PNG or JPEG.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <section aria-labelledby='net-add-title'>
            <h3 id='net-add-title'>Add my token</h3>
            <label className='net-field'>
                <span>Name</span>
                <input className='net-input' value={name} maxLength={40} onChange={(e) => setName(e.currentTarget.value)} />
            </label>
            {party.length > 0 && (
                <div className='net-portraits' role='group' aria-label='Pick a portrait from My Party'>
                    {party.map((m) => (
                        <button
                            key={m.id}
                            type='button'
                            className='net-portrait'
                            disabled={busy}
                            aria-label={`Use ${m.name || "this portrait"}`}
                            onClick={() => void send(async () => (await fetch(m.imageUrl)).blob())}
                        >
                            <img src={m.imageUrl} alt='' />
                        </button>
                    ))}
                </div>
            )}
            <label className='jv-button net-upload'>
                Upload a picture…
                <input
                    type='file'
                    accept='image/*'
                    disabled={busy}
                    onChange={(e) => {
                        const f = e.currentTarget.files?.[0]
                        if (f) void send(async () => f)
                        e.currentTarget.value = ""
                    }}
                />
            </label>
            <p className='net-hint' role='status' aria-live='polite'>
                {note}
            </p>
        </section>
    )
}

export const PlayerView: React.FC<{ defaultName: string }> = ({ defaultName }) => {
    const client = useStore(clientStore)
    const humbugs = useHumbugs()
    if (!client) return null
    const mine = client.you ? humbugs.filter((h) => ownerOf(h) === client.you) : []

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
                    <section aria-labelledby='net-mine-title'>
                        <h3 id='net-mine-title'>My tokens</h3>
                        {mine.length ? (
                            <ul className='net-players'>
                                {mine.map((h) => (
                                    <MyToken key={h.id} h={h} />
                                ))}
                            </ul>
                        ) : (
                            <p className='net-hint'>Add your character below. Drag it on the board to move.</p>
                        )}
                        <button type='button' className='jv-button' onClick={() => undoMyMove()}>
                            Undo my last move
                        </button>
                    </section>
                    {mine.length < MAX_TOKENS_PER_PLAYER && <AddToken defaultName={defaultName} />}
                </>
            )}

            <button type='button' className='jv-button net-danger' onClick={() => void leaveGame()}>
                Leave game
            </button>
        </div>
    )
}
