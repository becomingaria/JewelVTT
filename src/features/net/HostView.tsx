import React, { useState } from "react"
import { useStore } from "../store"
import {
    answerKnock,
    ban,
    hostStore,
    kick,
    moderationStore,
    playersStore,
    regenerateCode,
    setKnock,
    setLabel,
    setSharing,
    stopHosting,
    unbanDevice,
    unbanIp,
    type PlayerConn,
} from "./host"

const shortId = (id: string) => `${id.slice(0, 4)}-${id.slice(4, 8)}`

async function copy(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text)
        return true
    } catch {
        return false
    }
}

const PlayerRow: React.FC<{ p: PlayerConn }> = ({ p }) => {
    const mod = useStore(moderationStore)
    const label = mod.people[p.deviceId]?.label ?? ""
    const knocking = p.status === "knocking"
    return (
        <li className={`net-player ${knocking ? "is-knocking" : ""}`}>
            <div className='net-player-head'>
                <strong>{p.name}</strong>
                <span className='net-badge'>{knocking ? "Knocking" : "Connected"}</span>
            </div>
            <input
                className='net-input'
                defaultValue={label}
                placeholder='Your label (only you see it)'
                aria-label={`Label for ${p.name}`}
                onBlur={(e) => setLabel(p.deviceId, e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
            <dl className='net-facts'>
                <dt>Device</dt>
                <dd>
                    <code>{shortId(p.deviceId)}</code>
                </dd>
                <dt>IP</dt>
                <dd>
                    <code>{p.ip ?? "unknown"}</code>
                </dd>
            </dl>
            <div className='net-actions'>
                {knocking ? (
                    <>
                        <button type='button' className='jv-button jv-button-primary' onClick={() => answerKnock(p.peerId, true)}>
                            Let in
                        </button>
                        <button type='button' className='jv-button' onClick={() => answerKnock(p.peerId, false)}>
                            Turn away
                        </button>
                    </>
                ) : (
                    <>
                        <button type='button' className='jv-button' onClick={() => kick(p.peerId)}>
                            Kick
                        </button>
                        <button type='button' className='jv-button net-danger' onClick={() => ban(p.peerId)}>
                            Ban
                        </button>
                    </>
                )}
            </div>
        </li>
    )
}

export const HostView: React.FC = () => {
    const host = useStore(hostStore)
    const players = useStore(playersStore)
    const mod = useStore(moderationStore)
    const [copied, setCopied] = useState(false)
    const [confirmNew, setConfirmNew] = useState(false)
    if (!host) return null

    const knocking = players.filter((p) => p.status === "knocking")
    const connected = players.filter((p) => p.status === "connected")

    return (
        <div className='net-body'>
            <section aria-labelledby='net-code-title'>
                <h3 id='net-code-title'>Room link</h3>
                <p className='net-hint'>Send this to your players. They paste it into Jewel VTT (or click it).</p>
                <div className='net-code'>
                    <input className='net-input' readOnly value={host.link} aria-label='Room link' onFocus={(e) => e.currentTarget.select()} />
                    <button
                        type='button'
                        className='jv-button jv-button-primary'
                        onClick={() =>
                            void copy(host.link).then((ok) => {
                                setCopied(ok)
                                window.setTimeout(() => setCopied(false), 2000)
                            })
                        }
                    >
                        {copied ? "Copied" : "Copy"}
                    </button>
                </div>
                <span className='net-live' role='status' aria-live='polite'>
                    {copied ? "Room link copied" : ""}
                </span>
                {confirmNew ? (
                    <div className='net-actions'>
                        <button type='button' className='jv-button' onClick={() => (setConfirmNew(false), void regenerateCode(true))}>
                            New code, keep players
                        </button>
                        <button type='button' className='jv-button' onClick={() => (setConfirmNew(false), void regenerateCode(false))}>
                            New code, drop everyone
                        </button>
                        <button type='button' className='jv-button' onClick={() => setConfirmNew(false)}>
                            Cancel
                        </button>
                    </div>
                ) : (
                    <button type='button' className='jv-button' onClick={() => setConfirmNew(true)}>
                        New room code…
                    </button>
                )}
            </section>

            <section aria-labelledby='net-options-title'>
                <h3 id='net-options-title'>Table</h3>
                <button type='button' className='jv-button net-toggle' aria-pressed={host.knock} onClick={() => setKnock(!host.knock)}>
                    <span aria-hidden='true'>{host.knock ? "■" : "□"}</span> Knock to join
                </button>
                <p className='net-hint'>New players wait until you let them in.</p>
                <button
                    type='button'
                    className='jv-button net-toggle'
                    aria-pressed={host.sharing}
                    onClick={() => setSharing(!host.sharing)}
                >
                    <span aria-hidden='true'>{host.sharing ? "■" : "□"}</span> Share my view
                </button>
                <p className='net-hint'>
                    Players get a “Now sharing” button to jump to what you're looking at. It never lifts the fog.
                </p>
            </section>

            {knocking.length > 0 && (
                <section aria-labelledby='net-knock-title'>
                    <h3 id='net-knock-title'>At the door ({knocking.length})</h3>
                    <ul className='net-players'>
                        {knocking.map((p) => (
                            <PlayerRow key={p.peerId} p={p} />
                        ))}
                    </ul>
                </section>
            )}

            <section aria-labelledby='net-players-title'>
                <h3 id='net-players-title'>Players ({connected.length})</h3>
                {connected.length ? (
                    <ul className='net-players'>
                        {connected.map((p) => (
                            <PlayerRow key={p.peerId} p={p} />
                        ))}
                    </ul>
                ) : (
                    <p className='net-hint'>Nobody yet. Share the room link.</p>
                )}
            </section>

            {(mod.bannedDevices.length > 0 || mod.bannedIps.length > 0) && (
                <details className='net-bans'>
                    <summary>Banned ({mod.bannedDevices.length + mod.bannedIps.length})</summary>
                    <ul>
                        {mod.bannedDevices.map((d) => (
                            <li key={d}>
                                <span>
                                    {mod.people[d]?.label || mod.people[d]?.lastName || "Unknown"} · <code>{shortId(d)}</code>
                                </span>
                                <button type='button' className='jv-button' onClick={() => unbanDevice(d)}>
                                    Unban
                                </button>
                            </li>
                        ))}
                        {mod.bannedIps.map((ip) => (
                            <li key={ip}>
                                <span>
                                    IP <code>{ip}</code>
                                </span>
                                <button type='button' className='jv-button' onClick={() => unbanIp(ip)}>
                                    Unban
                                </button>
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            <button type='button' className='jv-button net-danger' onClick={() => void stopHosting()}>
                Stop hosting
            </button>
        </div>
    )
}
