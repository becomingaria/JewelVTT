import React, { useEffect, useRef, useState } from "react"
import { desktop } from "../../desktop"
import { createStore, useStore } from "../store"
import { useNetRole } from "../view-state"
import { clientStore, followGm, joinGame } from "./client"
import { WEB_JOIN } from "./code"
import { startHosting } from "./host"
import { HostView } from "./HostView"
import { PlayerView } from "./PlayerView"
import { panelOpenStore, profileStore, openPanel } from "./profile"
import "./net.css"

/** A link the app was opened with (jewel://join/...), waiting in the join form */
const pendingLinkStore = createStore<string>("")

const StartView: React.FC = () => {
    const profile = useStore(profileStore)
    const client = useStore(clientStore)
    const pending = useStore(pendingLinkStore)
    const [link, setLink] = useState(pending)
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)
    useEffect(() => {
        if (pending) setLink(pending)
    }, [pending])

    const setName = (name: string) => profileStore.set({ name })

    return (
        <div className='net-body'>
            <label className='net-field'>
                <span>Your name</span>
                <input
                    className='net-input'
                    value={profile.name}
                    maxLength={40}
                    placeholder='Shown to the others'
                    onChange={(e) => setName(e.currentTarget.value)}
                />
            </label>

            {client?.message && (
                <p className='net-hint' role='status'>
                    {client.message}
                </p>
            )}

            <section aria-labelledby='net-join-title'>
                <h3 id='net-join-title'>Join a game</h3>
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        setBusy(true)
                        void joinGame(link, profile.name).then((err) => {
                            setBusy(false)
                            setError(err ?? "")
                            if (!err) pendingLinkStore.set("")
                        })
                    }}
                >
                    <label className='net-field'>
                        <span>Room link from your GM</span>
                        <textarea
                            className='net-input'
                            rows={3}
                            value={link}
                            placeholder='Paste the link (https://…#join/… or jewel://join/…)'
                            onChange={(e) => setLink(e.currentTarget.value)}
                            aria-invalid={!!error}
                            aria-describedby={error ? "net-join-error" : undefined}
                        />
                    </label>
                    {error && (
                        <p id='net-join-error' className='net-error' role='alert'>
                            {error}
                        </p>
                    )}
                    <button type='submit' className='jv-button jv-button-primary' disabled={busy || !link.trim()}>
                        Join
                    </button>
                </form>
            </section>

            <section aria-labelledby='net-host-title'>
                <h3 id='net-host-title'>Host a game</h3>
                <p className='net-hint'>
                    Players connect straight to this computer. No account or server: free public relays only help the
                    apps find each other. Like any direct connection, you and your players can see each other's IP
                    address.
                </p>
                <button type='button' className='jv-button jv-button-primary' onClick={() => void startHosting(true)}>
                    Host this board
                </button>
            </section>
        </div>
    )
}

const NetPanel: React.FC = () => {
    const role = useNetRole()
    const { open } = useStore(panelOpenStore)
    const profile = useStore(profileStore)
    const closeRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !e.defaultPrevented) panelOpenStore.set({ open: false })
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open])

    if (!open) return null
    const title = role === "host" ? "Hosting" : role === "player" ? "Playing" : "Multiplayer"
    return (
        <section className='net-panel jv-window' role='dialog' aria-modal='false' aria-labelledby='net-panel-title'>
            <header className='net-titlebar jv-titlebar'>
                <h2 id='net-panel-title'>{title}</h2>
                <button
                    ref={closeRef}
                    type='button'
                    className='jv-close'
                    aria-label='Close multiplayer panel'
                    onClick={() => panelOpenStore.set({ open: false })}
                >
                    ×
                </button>
            </header>
            {role === "host" ? <HostView /> : role === "player" ? <PlayerView defaultName={profile.name} /> : <StartView />}
        </section>
    )
}

/** Floating "Now sharing" button for players (flashes gently, at most 1×/s) */
const ShareButton: React.FC = () => {
    const client = useStore(clientStore)
    const role = useNetRole()
    if (role !== "player" || !client?.sharing) return null
    return (
        <button
            type='button'
            className={`net-share-btn ${client.following ? "is-following" : ""}`}
            aria-pressed={client.following}
            onClick={() => followGm(!client.following)}
        >
            <span className='net-share-dot' aria-hidden='true' />
            {client.following ? "Following GM view · Stop" : "Now sharing · Look"}
        </button>
    )
}

/** The web version: a player link (https://<site>/#join/…) opens the join form, filled in. */
function useWebJoinLink() {
    useEffect(() => {
        if (desktop) return
        const take = () => {
            if (!window.location.hash.toLowerCase().startsWith(WEB_JOIN)) return
            pendingLinkStore.set(window.location.href)
            openPanel()
            // Take the code out of the address bar, so a reload or a shared screenshot doesn't carry it
            history.replaceState(null, "", window.location.pathname + window.location.search)
        }
        take()
        window.addEventListener("hashchange", take)
        return () => window.removeEventListener("hashchange", take)
    }, [])
}

export const NetLayer: React.FC = () => {
    useWebJoinLink()
    // jewel:// links: the app was opened with one, or got one while running
    useEffect(() => {
        if (!desktop) return
        const take = (link: string | null) => {
            if (!link) return
            pendingLinkStore.set(link)
            openPanel()
        }
        void desktop.takeJoinLink().then(take)
        return desktop.onJoinLink(take)
    }, [])

    return (
        <>
            <NetPanel />
            <ShareButton />
        </>
    )
}
