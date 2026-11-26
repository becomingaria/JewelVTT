import React, { useState } from "react"
import type { Humbug } from "../../types/humbug.types"
import { flyTo } from "../../utils/view-events"
import { humbugFootprint } from "../../utils/humbug.utils"
import { selectHumbugs, useHumbugs } from "../board-bridge"
import { useStore } from "../store"
import { formatCode, shareLink } from "./code"
import {
    allowPlacement,
    answerKnock,
    ban,
    denyPlacement,
    freezeAll,
    frozenStore,
    hostStore,
    kick,
    moderationStore,
    placementsStore,
    playersStore,
    regenerateCode,
    setFrozen,
    setKnock,
    setLabel,
    setRules,
    setSharing,
    stopHosting,
    tableRulesStore,
    takeBack,
    tokensOf,
    unbanDevice,
    unbanIp,
    type PlayerConn,
} from "./host"
import { MAX_TOKENS_LIMIT } from "./protocol"

const goTo = (h: Pick<Humbug, "position"> & Partial<Humbug>, id?: string) => {
    const size = h.type ? humbugFootprint(h as Humbug) : { width: 32, height: 32 }
    flyTo({ x: h.position.x + size.width / 2, y: h.position.y + size.height / 2 })
    if (id) selectHumbugs([id])
}

const tokenName = (h: Humbug) => (h.type === "token" && h.name) || "Token"

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
    const frozen = useStore(frozenStore).has(p.deviceId)
    const humbugs = useHumbugs()
    const label = mod.people[p.deviceId]?.label ?? ""
    const knocking = p.status === "knocking"
    const tokens = knocking ? [] : tokensOf(p.deviceId, humbugs)
    return (
        <li className={`net-player ${knocking ? "is-knocking" : ""}`}>
            <div className='net-player-head'>
                <strong>{p.name}</strong>
                <span className={`net-badge ${frozen ? "is-frozen" : ""}`}>
                    {knocking ? "Knocking" : frozen ? "Paused" : "Connected"}
                </span>
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
            {!knocking && (
                <>
                    {tokens.length ? (
                        <ul className='net-mini-list' aria-label={`${p.name}'s tokens`}>
                            {tokens.map((h) => (
                                <li key={h.id}>
                                    <span>{tokenName(h)}</span>
                                    <button type='button' className='jv-button' onClick={() => goTo(h, h.id)}>
                                        Go to
                                    </button>
                                    <button
                                        type='button'
                                        className='jv-button'
                                        title='It stays on the table, as your token'
                                        onClick={() => takeBack(h)}
                                    >
                                        Take back
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className='net-hint'>No tokens yet. Right-click any token and choose “Give to {p.name}”.</p>
                    )}
                </>
            )}
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
                        <button
                            type='button'
                            className='jv-button'
                            aria-pressed={frozen}
                            title='Stop this player moving or placing tokens'
                            onClick={() => setFrozen(p.deviceId, !frozen)}
                        >
                            {frozen ? "Unpause" : "Pause"}
                        </button>
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

const TableRules: React.FC<{ anyConnected: boolean }> = ({ anyConnected }) => {
    const rules = useStore(tableRulesStore)
    const frozen = useStore(frozenStore)
    return (
        <section aria-labelledby='net-rules-title' className='net-rules'>
            <h3 id='net-rules-title'>Players' tokens</h3>
            <button type='button' className='jv-button net-toggle' aria-pressed={rules.fenced} onClick={() => setRules({ fenced: !rules.fenced })}>
                <span aria-hidden='true'>{rules.fenced ? "■" : "□"}</span> Move only where the party can see
            </button>
            <p className='net-hint'>Players can't move or place tokens under the fog (yours to reveal, or the party's sight).</p>
            <button type='button' className='jv-button net-toggle' aria-pressed={rules.approve} onClick={() => setRules({ approve: !rules.approve })}>
                <span aria-hidden='true'>{rules.approve ? "■" : "□"}</span> Approve new tokens
            </button>
            <label className='net-inline'>
                <span>Tokens per player</span>
                <select
                    className='net-input'
                    value={rules.maxTokens}
                    onChange={(e) => setRules({ maxTokens: Number(e.currentTarget.value) })}
                >
                    {Array.from({ length: MAX_TOKENS_LIMIT }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
            </label>
            {anyConnected && (
                <div className='net-actions'>
                    <button type='button' className='jv-button' onClick={() => freezeAll(true)}>
                        Pause everyone
                    </button>
                    <button type='button' className='jv-button' disabled={!frozen.size} onClick={() => freezeAll(false)}>
                        Unpause everyone
                    </button>
                </div>
            )}
        </section>
    )
}

const Placements: React.FC = () => {
    const list = useStore(placementsStore)
    if (!list.length) return null
    return (
        <section aria-labelledby='net-place-title'>
            <h3 id='net-place-title'>Waiting to be placed ({list.length})</h3>
            <ul className='net-mini-list'>
                {list.map((pl) => (
                    <li key={pl.id}>
                        <img src={pl.token.imageUrl} alt='' />
                        <span>
                            {pl.token.name} <span className='net-hint'>({pl.playerName})</span>
                        </span>
                        <button type='button' className='jv-button' onClick={() => goTo(pl.token)}>
                            See spot
                        </button>
                        <button type='button' className='jv-button jv-button-primary' onClick={() => allowPlacement(pl.id)}>
                            Allow
                        </button>
                        <button type='button' className='jv-button' onClick={() => denyPlacement(pl.id)}>
                            No
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    )
}

export const HostView: React.FC = () => {
    const host = useStore(hostStore)
    const players = useStore(playersStore)
    const mod = useStore(moderationStore)
    const [copied, setCopied] = useState(false)
    const [confirmNew, setConfirmNew] = useState(false)
    if (!host) return null

    // A web address when there is one (opens in any browser, and the app accepts it too), else jewel://
    const link = shareLink(host.code)
    const web = link !== formatCode(host.code)
    const knocking = players.filter((p) => p.status === "knocking")
    const connected = players.filter((p) => p.status === "connected")

    return (
        <div className='net-body'>
            <section aria-labelledby='net-code-title'>
                <h3 id='net-code-title'>Room link</h3>
                <p className='net-hint'>
                    {web
                        ? "Send this to your players. It opens the game in their browser, nothing to install (the desktop app can paste it too). Keep this window open while you play."
                        : "Send this to your players. They paste it into Jewel VTT (or click it)."}
                </p>
                <div className='net-code'>
                    <input className='net-input' readOnly value={link} aria-label='Room link' onFocus={(e) => e.currentTarget.select()} />
                    <button
                        type='button'
                        className='jv-button jv-button-primary'
                        onClick={() =>
                            void copy(link).then((ok) => {
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

            <Placements />

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

            <TableRules anyConnected={connected.length > 0} />

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
