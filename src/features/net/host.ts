import type { Room } from "trystero"
import type { Humbug, LightSource, TokenHumbug } from "../../types/humbug.types"
import { onBoardChange } from "../../utils/board-store"
import { snapForGrid } from "../../utils/humbug.utils"
import { showToast } from "../../utils/toast"
import {
    addHumbugs,
    cameraStore,
    humbugBase,
    humbugsStore,
    updateHumbugs,
    viewCentreWorld,
} from "../board-bridge"
import { logEvent } from "../services"
import { recordAudit, sanitizeAuditEntry } from "../dice/audit"
import { playSfx } from "../sound"
import { createPersistentStore, createStore } from "../store"
import { netRoleStore } from "../view-state"
import { assetize, loadAsset } from "./assets"
import { formatCode, newRoom, type RoomCode } from "./code"
import { buildPlayerBoard, ownerOf, personalize } from "./filter"
import { getIdentity } from "./identity"
import {
    MAX_TOKENS_PER_PLAYER,
    NET_EXT,
    type NoticeMsg,
    type PlayerRequest,
    type ShareMsg,
    type StateMsg,
} from "./protocol"
import { profileStore } from "./profile"
import { channel, dropPeer, openRoom, peerAddress, requestChannel, type PeerIdentity, type Verdict } from "./transport"

/*
 * The GM's side of a shared game: one room, many players.
 */

export interface HostState {
    code: RoomCode
    link: string
    /** New players wait at the door until the GM lets them in */
    knock: boolean
    /** Players can follow the GM's view */
    sharing: boolean
}

export interface PlayerConn extends PeerIdentity {
    status: "knocking" | "connected"
    since: number
}

/** What the GM knows about each device (kept between sessions) */
export interface Person {
    label: string
    lastName: string
    ips: string[]
    lastSeen: number
}

export interface Moderation {
    people: Record<string, Person>
    bannedDevices: string[]
    bannedIps: string[]
}

export const hostStore = createStore<HostState | null>(null)
export const playersStore = createStore<readonly PlayerConn[]>([])
export const moderationStore = createPersistentStore<Moderation>("jewel:net:moderation", {
    people: {},
    bannedDevices: [],
    bannedIps: [],
})

interface Session {
    room: Room
    code: RoomCode
    sendState: (m: StateMsg, peer: string) => void
    sendShare: (m: ShareMsg, peer?: string) => void
    sendNotice: (m: NoticeMsg, peer?: string) => void
}

let session: Session | null = null
/** Devices let in during this hosting session (skip the knock after a new code) */
const admitted = new Set<string>()
/** Kicked for this code (a new code forgives) */
const kicked = new Set<string>()
const knocks = new Map<string, (v: Verdict) => void>()
/** Last JSON sent per player per slice, so only changes go out */
const sent = new Map<string, Map<string, string>>()
let rev = 0

const setPlayers = (fn: (p: readonly PlayerConn[]) => readonly PlayerConn[]) => playersStore.set(fn)
const player = (peerId: string) => playersStore.get().find((p) => p.peerId === peerId)

function remember(peer: PeerIdentity) {
    moderationStore.set((m) => {
        const prev = m.people[peer.deviceId]
        const ips = peer.ip && !prev?.ips.includes(peer.ip) ? [...(prev?.ips ?? []), peer.ip].slice(-5) : prev?.ips ?? []
        return {
            ...m,
            people: {
                ...m.people,
                [peer.deviceId]: { label: prev?.label ?? "", lastName: peer.name, ips, lastSeen: Date.now() },
            },
        }
    })
}

const isBanned = (peer: PeerIdentity) => {
    const m = moderationStore.get()
    return m.bannedDevices.includes(peer.deviceId) || (!!peer.ip && m.bannedIps.includes(peer.ip))
}

async function admit(peer: PeerIdentity): Promise<Verdict> {
    remember(peer)
    if (isBanned(peer)) return { ok: false, reason: "You've been banned from this table." }
    if (kicked.has(peer.deviceId)) return { ok: false, reason: "The GM removed you from this game." }
    const host = hostStore.get()
    if (!host?.knock || admitted.has(peer.deviceId)) return { ok: true }

    // Knock: wait at the door until the GM answers
    setPlayers((ps) => [...ps.filter((p) => p.peerId !== peer.peerId), { ...peer, status: "knocking", since: Date.now() }])
    playSfx("alert")
    showToast(`${peer.name} is knocking. Open Multiplayer to let them in.`)
    return new Promise<Verdict>((resolve) => {
        knocks.set(peer.peerId, resolve)
        window.setTimeout(() => {
            if (knocks.delete(peer.peerId)) {
                setPlayers((ps) => ps.filter((p) => p.peerId !== peer.peerId))
                resolve({ ok: false, reason: "The GM didn't answer in time. Try again." })
            }
        }, 170_000)
    })
}

/** GM answers a knock */
export function answerKnock(peerId: string, allow: boolean) {
    const resolve = knocks.get(peerId)
    if (!resolve) return
    knocks.delete(peerId)
    if (!allow) setPlayers((ps) => ps.filter((p) => p.peerId !== peerId))
    resolve(allow ? { ok: true } : { ok: false, reason: "The GM didn't let you in." })
}

function onVerified(peer: PeerIdentity) {
    admitted.add(peer.deviceId)
    setPlayers((ps) => [
        ...ps.filter((p) => p.peerId !== peer.peerId && p.deviceId !== peer.deviceId),
        { ...peer, status: "connected", since: Date.now() },
    ])
    sent.delete(peer.peerId)
    if (!peer.ip) void refreshAddress(peer.peerId)
    logEvent({ kind: "system", text: `${peer.name} joined the game` })
    playSfx("place")
    // The board goes out when the player says it's ready (see "ready")
}

/**
 * The address is often only known once the connection settles: look again
 * a few times, remember it, and enforce IP bans then too.
 */
async function refreshAddress(peerId: string, tries = 4) {
    for (let i = 0; i < tries; i++) {
        await new Promise((r) => window.setTimeout(r, 1200 * (i + 1)))
        const p = player(peerId)
        if (!session || !p) return
        const ip = await peerAddress(session.room.getPeers()[peerId])
        if (!ip) continue
        setPlayers((ps) => ps.map((x) => (x.peerId === peerId ? { ...x, ip } : x)))
        remember({ ...p, ip })
        if (moderationStore.get().bannedIps.includes(ip)) ban(peerId)
        return
    }
}

// ----------------------------------------------------------------- sync
let syncTimer = 0
let syncing = false
let again = false

function scheduleSync() {
    if (!session || syncTimer) return
    syncTimer = window.setTimeout(() => {
        syncTimer = 0
        void syncNow()
    }, 120)
}

async function syncNow() {
    if (!session) return
    if (syncing) {
        again = true
        return
    }
    syncing = true
    try {
        const shared = (await assetize(buildPlayerBoard())) as Record<string, unknown>
        rev++
        for (const p of playersStore.get()) {
            if (p.status !== "connected" || !session) continue
            const mine = personalize(shared, p.deviceId)
            const last = sent.get(p.peerId) ?? new Map<string, string>()
            const changed: Record<string, unknown> = {}
            for (const [k, v] of Object.entries(mine)) {
                const json = JSON.stringify(v)
                if (last.get(k) !== json) {
                    changed[k] = v
                    last.set(k, json)
                }
            }
            sent.set(p.peerId, last)
            if (Object.keys(changed).length) session.sendState({ rev, you: p.deviceId, slices: changed }, p.peerId)
        }
    } finally {
        syncing = false
        if (again) {
            again = false
            scheduleSync()
        }
    }
}

// ------------------------------------------------------------ requests
const isFiniteNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n)

function sanitizeLight(l: LightSource | null | undefined): LightSource | undefined {
    if (!l) return undefined
    const clamp = (n: unknown, max: number) => (isFiniteNum(n) ? Math.max(0, Math.min(max, n)) : 0)
    return {
        bright: clamp(l.bright, 240),
        dim: clamp(l.dim, 240),
        color: typeof l.color === "string" && /^#[0-9a-f]{3,8}$/i.test(l.color) ? l.color : undefined,
        flicker: !!l.flicker,
        turnsLeft: isFiniteNum(l.turnsLeft) ? Math.max(0, Math.round(l.turnsLeft)) : undefined,
    }
}

function handleRequest(req: PlayerRequest, peerId: string) {
    const p = player(peerId)
    if (!p || p.status !== "connected" || !req || typeof req !== "object") return
    switch (req.t) {
        case "ready": {
            // Send everything again from scratch
            sent.delete(peerId)
            void syncNow()
            if (hostStore.get()?.sharing) session?.sendShare({ sharing: true, view: currentView() }, peerId)
            return
        }
        case "add-token": {
            const mine = humbugsStore.get().filter((h) => ownerOf(h) === p.deviceId)
            if (mine.length >= MAX_TOKENS_PER_PLAYER) {
                session?.sendNotice({ kind: "toast", text: `You can have up to ${MAX_TOKENS_PER_PLAYER} tokens.` }, peerId)
                return
            }
            const image = typeof req.image === "string" ? req.image : ""
            if (!/^data:image\/(png|jpe?g|webp|gif|avif);/i.test(image) || image.length > 12_000_000) {
                session?.sendNotice({ kind: "toast", text: "That image couldn't be used. Try a PNG or JPEG." }, peerId)
                return
            }
            const name = String(req.name ?? "").slice(0, 40).trim() || p.name
            const centre = viewCentreWorld()
            const offset = mine.length * 32 + playersStore.get().indexOf(p) * 64
            const position = snapForGrid(
                { x: centre.x - 16 + offset, y: centre.y - 16 },
                { width: 32, height: 32 },
                cameraStore.get()?.gridShape ?? "square"
            )
            const token: TokenHumbug = {
                ...humbugBase(position),
                type: "token",
                imageUrl: image,
                size: { width: 32, height: 32 },
                originalSize: { width: 32, height: 32 },
                borderColor: "#6c2fcf",
                borderWidth: 2,
                name,
                layer: "tokens",
                ext: {
                    [NET_EXT]: { owner: p.deviceId },
                    tracker: { side: "party" },
                    "fog-light": { vision: 60 },
                },
            }
            addHumbugs([token])
            showToast(`${p.name} added ${name} to the table`)
            logEvent({ kind: "system", text: `${p.name} added ${name}` })
            return
        }
        case "patch": {
            const h = humbugsStore.get().find((x) => x.id === req.id)
            if (!h || ownerOf(h) !== p.deviceId) return
            const changes: Partial<Humbug> = {}
            if (req.position && isFiniteNum(req.position.x) && isFiniteNum(req.position.y)) {
                changes.position = { x: req.position.x, y: req.position.y }
            }
            if ("light" in req) changes.light = sanitizeLight(req.light)
            if (isFiniteNum(req.vision)) {
                changes.ext = {
                    ...h.ext,
                    "fog-light": { ...(h.ext?.["fog-light"] as object), vision: Math.max(0, Math.min(240, req.vision)) },
                }
            }
            if (Object.keys(changes).length) updateHumbugs([{ id: h.id, changes }])
            return
        }
        case "roll": {
            const text = String(req.text ?? "").slice(0, 200)
            if (!text) return
            logEvent({ kind: "roll", text: `${p.name}: ${text}` })
            showToast(`${p.name}: ${text}`)
            // The audit files it under the player, whatever their app called it
            const entry = sanitizeAuditEntry(req.roll)
            // (stamped with the GM's clock; players can't make secret rolls)
            if (entry) recordAudit({ ...entry, at: undefined, by: p.name, device: p.deviceId, secret: undefined })
            return
        }
    }
}

// ----------------------------------------------------------- the room
async function openSession(code: RoomCode): Promise<Session> {
    const identity = await getIdentity()
    const room = openRoom(code, {
        role: "host",
        name: profileStore.get().name || "GM",
        identity,
        admit,
        onVerified,
    })
    const state = channel<StateMsg>(room, "state")
    const share = channel<ShareMsg>(room, "share")
    const notice = channel<NoticeMsg>(room, "notice")
    channel<PlayerRequest>(room, "req").listen(handleRequest)
    requestChannel<string, string>(room, "asset").answer((id) => loadAsset(String(id)))

    room.onPeerLeave = (peerId) => {
        const p = player(peerId)
        knocks.get(peerId)?.({ ok: false, reason: "left" })
        knocks.delete(peerId)
        sent.delete(peerId)
        setPlayers((ps) => ps.filter((x) => x.peerId !== peerId))
        if (p?.status === "connected") logEvent({ kind: "system", text: `${p.name} left the game` })
    }

    return {
        room,
        code,
        sendState: (m, peer) => state.send(m, peer),
        sendShare: (m, peer) => share.send(m, peer),
        sendNotice: (m, peer) => notice.send(m, peer),
    }
}

let unsubscribers: (() => void)[] = []

export async function startHosting(knock = true) {
    if (session) return
    const identity = await getIdentity()
    const code = newRoom(identity.deviceId)
    session = await openSession(code)
    hostStore.set({ code, link: formatCode(code), knock, sharing: false })
    netRoleStore.set("host")
    unsubscribers = [onBoardChange(scheduleSync), humbugsStore.subscribe(scheduleSync), cameraStore.subscribe(onCamera)]
}

export async function stopHosting() {
    if (!session) return
    session.sendNotice({ kind: "ended", text: "The GM ended the game." })
    const old = session
    session = null
    unsubscribers.forEach((u) => u())
    unsubscribers = []
    knocks.forEach((r) => r({ ok: false, reason: "The game ended." }))
    knocks.clear()
    sent.clear()
    admitted.clear()
    kicked.clear()
    hostStore.set(null)
    playersStore.set([])
    netRoleStore.set("solo")
    window.setTimeout(() => void old.room.leave(), 800)
}

/** New code. Players still connected can be moved to it, or everyone is dropped. */
export async function regenerateCode(keepPlayers: boolean) {
    const host = hostStore.get()
    if (!session || !host) return
    const identity = await getIdentity()
    const code = newRoom(identity.deviceId)
    const old = session
    const link = formatCode(code)
    kicked.clear()
    if (keepPlayers) old.sendNotice({ kind: "migrate", code: link })
    else {
        old.sendNotice({ kind: "ended", text: "The GM changed the room code." })
        admitted.clear()
    }
    session = await openSession(code)
    sent.clear()
    playersStore.set([])
    hostStore.set({ ...host, code, link })
    window.setTimeout(() => void old.room.leave(), 1500)
    showToast(keepPlayers ? "New code made. Connected players are moving to it." : "New code made. Everyone was disconnected.")
}

export function setKnock(knock: boolean) {
    hostStore.set((h) => (h ? { ...h, knock } : h))
}

export function kick(peerId: string) {
    const p = player(peerId)
    if (!session || !p) return
    kicked.add(p.deviceId)
    admitted.delete(p.deviceId)
    session.sendNotice({ kind: "kicked", text: "The GM removed you from the game." }, peerId)
    const room = session.room
    window.setTimeout(() => dropPeer(room, peerId), 400)
    logEvent({ kind: "system", text: `${p.name} was removed` })
}

export function ban(peerId: string) {
    const p = player(peerId)
    if (!p) return
    moderationStore.set((m) => ({
        ...m,
        bannedDevices: [...new Set([...m.bannedDevices, p.deviceId])],
        bannedIps: p.ip && p.ip !== "local network" ? [...new Set([...m.bannedIps, p.ip])] : m.bannedIps,
    }))
    if (session) {
        session.sendNotice({ kind: "banned", text: "The GM banned you from this table." }, peerId)
        const room = session.room
        window.setTimeout(() => dropPeer(room, peerId), 400)
    }
    admitted.delete(p.deviceId)
    logEvent({ kind: "system", text: `${p.name} was banned` })
}

export function unbanDevice(deviceId: string) {
    moderationStore.set((m) => ({ ...m, bannedDevices: m.bannedDevices.filter((d) => d !== deviceId) }))
}

export function unbanIp(ip: string) {
    moderationStore.set((m) => ({ ...m, bannedIps: m.bannedIps.filter((x) => x !== ip) }))
}

export function setLabel(deviceId: string, label: string) {
    moderationStore.set((m) => {
        const prev = m.people[deviceId] ?? { label: "", lastName: "", ips: [], lastSeen: Date.now() }
        return { ...m, people: { ...m.people, [deviceId]: { ...prev, label: label.slice(0, 60) } } }
    })
}

// ------------------------------------------------------------ share view
function currentView(): ShareMsg["view"] {
    const cam = cameraStore.get()
    const el = cam?.container
    if (!cam || !el) return undefined
    return {
        x: -cam.viewport.x,
        y: -cam.viewport.y,
        width: el.clientWidth / cam.viewport.zoom,
        height: el.clientHeight / cam.viewport.zoom,
    }
}

let shareTimer = 0
function onCamera() {
    if (!hostStore.get()?.sharing || shareTimer) return
    shareTimer = window.setTimeout(() => {
        shareTimer = 0
        session?.sendShare({ sharing: true, view: currentView() })
    }, 100)
}

export function setSharing(sharing: boolean) {
    hostStore.set((h) => (h ? { ...h, sharing } : h))
    session?.sendShare(sharing ? { sharing: true, view: currentView() } : { sharing: false })
}
