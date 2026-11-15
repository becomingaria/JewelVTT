import type { Room } from "trystero"
import type { Humbug, LightSource, Point, TokenHumbug } from "../../types/humbug.types"
import { onBoardChange } from "../../utils/board-store"
import { snapForGrid } from "../../utils/humbug.utils"
import { showToast } from "../../utils/toast"
import {
    addHumbugs,
    cameraStore,
    humbugBase,
    humbugsStore,
    removeHumbugs,
    updateHumbugs,
    viewCentreWorld,
} from "../board-bridge"
import { cellAt, cellKey } from "../grid"
import { isCellVisible } from "../fog-light/effective-fog"
import { fogShape } from "../fog-light/fog-store"
import { humbugFootprint } from "../../utils/humbug.utils"
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
    DEFAULT_MAX_TOKENS,
    MAX_TOKENS_LIMIT,
    NET_EXT,
    type NetExt,
    type NoticeMsg,
    type PlayerRequest,
    type PlayerRules,
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

/** The GM's rules for players (kept between sessions) */
export interface TableRules {
    /** Players move only where the party can see, or the GM revealed */
    fenced: boolean
    /** New tokens wait for the GM's OK */
    approve: boolean
    maxTokens: number
}

/** A token waiting for the GM's OK */
export interface Placement {
    id: string
    peerId: string
    deviceId: string
    playerName: string
    token: TokenHumbug
}

export const hostStore = createStore<HostState | null>(null)
export const tableRulesStore = createPersistentStore<TableRules>("jewel:net:rules", {
    fenced: true,
    approve: false,
    maxTokens: DEFAULT_MAX_TOKENS,
})
/** Devices whose tokens are frozen (this session) */
export const frozenStore = createStore<ReadonlySet<string>>(new Set())
export const placementsStore = createStore<readonly Placement[]>([])
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
            const rules = rulesFor(p.deviceId)
            const mine = personalize(shared, p.deviceId, rules.frozen)
            const last = sent.get(p.peerId) ?? new Map<string, string>()
            const rulesJson = JSON.stringify(rules)
            const rulesChanged = last.get("\u0000rules") !== rulesJson
            last.set("\u0000rules", rulesJson)
            const changed: Record<string, unknown> = {}
            for (const [k, v] of Object.entries(mine)) {
                const json = JSON.stringify(v)
                if (last.get(k) !== json) {
                    changed[k] = v
                    last.set(k, json)
                }
            }
            sent.set(p.peerId, last)
            if (Object.keys(changed).length || rulesChanged) {
                session.sendState({ rev, you: p.deviceId, slices: changed, rules: rulesChanged ? rules : undefined }, p.peerId)
            }
        }
    } finally {
        syncing = false
        if (again) {
            again = false
            scheduleSync()
        }
    }
}

// ---------------------------------------------------------------- rules
export function rulesFor(deviceId: string): PlayerRules {
    const r = tableRulesStore.get()
    return { maxTokens: r.maxTokens, frozen: frozenStore.get().has(deviceId), fenced: r.fenced, approve: r.approve }
}

export function setRules(patch: Partial<TableRules>) {
    tableRulesStore.set((r) => {
        const next = { ...r, ...patch }
        next.maxTokens = Math.max(1, Math.min(MAX_TOKENS_LIMIT, Math.round(next.maxTokens) || DEFAULT_MAX_TOKENS))
        return next
    })
}

export function setFrozen(deviceId: string, frozen: boolean) {
    frozenStore.set((s) => {
        const next = new Set(s)
        if (frozen) next.add(deviceId)
        else next.delete(deviceId)
        return next
    })
}

/** Freeze or unfreeze every connected player */
export function freezeAll(frozen: boolean) {
    frozenStore.set(frozen ? new Set(playersStore.get().map((p) => p.deviceId)) : new Set())
}

/** Tokens a device controls */
export const tokensOf = (deviceId: string, list: readonly Humbug[] = humbugsStore.get()) =>
    list.filter((h) => ownerOf(h) === deviceId)

/** Can players see this spot (where a token of this size would stand)? */
function spotVisible(position: Point, size: { width: number; height: number }): boolean {
    const centre = { x: position.x + size.width / 2, y: position.y + size.height / 2 }
    return isCellVisible(cellKey(cellAt(centre, fogShape())))
}

/** Give a token to a player (they can move it and set its light and vision) */
export function giveToken(h: Humbug, deviceId: string) {
    if (h.type !== "token") return
    const name = playersStore.get().find((p) => p.deviceId === deviceId)?.name ?? "the player"
    const fog = h.ext?.["fog-light"] as { vision?: number } | undefined
    updateHumbugs([
        {
            id: h.id,
            changes: {
                ext: {
                    ...h.ext,
                    [NET_EXT]: { ...(h.ext?.[NET_EXT] as NetExt | undefined), owner: deviceId },
                    tracker: { ...(h.ext?.tracker as object), side: "party" },
                    // A token that can't see would leave its player in the dark
                    "fog-light": { ...fog, vision: fog?.vision || 60 },
                },
            },
        },
    ])
    showToast(`${h.name || "Token"} now belongs to ${name}`)
}

/** Take a token back from its player */
export function takeBack(h: Humbug) {
    const ext = { ...h.ext }
    delete ext[NET_EXT]
    updateHumbugs([{ id: h.id, changes: { ext } }])
}

function refuse(peerId: string, text: string, revert?: string) {
    session?.sendNotice({ kind: "toast", text, revert }, peerId)
}

/** Let a waiting token onto the table */
export function allowPlacement(id: string) {
    const pl = placementsStore.get().find((x) => x.id === id)
    if (!pl) return
    placementsStore.set((list) => list.filter((x) => x.id !== id))
    addHumbugs([pl.token])
    logEvent({ kind: "system", text: `${pl.playerName} placed ${pl.token.name}` })
    session?.sendNotice({ kind: "toast", text: `The GM let ${pl.token.name} onto the table.` }, pl.peerId)
}

export function denyPlacement(id: string) {
    const pl = placementsStore.get().find((x) => x.id === id)
    if (!pl) return
    placementsStore.set((list) => list.filter((x) => x.id !== id))
    session?.sendNotice({ kind: "toast", text: `The GM didn't place ${pl.token.name}.` }, pl.peerId)
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
            const rules = rulesFor(p.deviceId)
            if (rules.frozen) return refuse(peerId, "The GM has paused your tokens for now.")
            const waiting = placementsStore.get().filter((x) => x.deviceId === p.deviceId).length
            if (tokensOf(p.deviceId).length + waiting >= rules.maxTokens) {
                return refuse(peerId, `You can have up to ${rules.maxTokens} token${rules.maxTokens === 1 ? "" : "s"} on the table.`)
            }
            const image = typeof req.image === "string" ? req.image : ""
            if (!/^data:image\/(png|jpe?g|webp|gif|avif);/i.test(image) || image.length > 12_000_000) {
                return refuse(peerId, "That image couldn't be used. Try a PNG or JPEG.")
            }
            const name = String(req.name ?? "").slice(0, 40).trim() || p.name
            const size = { width: 32, height: 32 }
            const shape = cameraStore.get()?.gridShape ?? "square"
            let position: Point
            if (req.at && isFiniteNum(req.at.x) && isFiniteNum(req.at.y)) {
                position = snapForGrid({ x: req.at.x, y: req.at.y }, size, shape)
                // Only where the party can see (or the GM revealed)
                if (!spotVisible(position, size)) return refuse(peerId, "Pick a spot you can see, not under the fog.")
            } else {
                const centre = viewCentreWorld()
                position = snapForGrid({ x: centre.x - 16, y: centre.y - 16 }, size, shape)
            }
            const vision = isFiniteNum(req.vision) ? Math.max(0, Math.min(240, req.vision)) : 60
            const token: TokenHumbug = {
                ...humbugBase(position),
                type: "token",
                imageUrl: image,
                size,
                originalSize: size,
                borderColor: "#6c2fcf",
                borderWidth: 2,
                name,
                layer: "tokens",
                light: sanitizeLight(req.light),
                ext: {
                    [NET_EXT]: {
                        owner: p.deviceId,
                        char: typeof req.char === "string" ? req.char.slice(0, 80) : undefined,
                    } satisfies NetExt,
                    tracker: { side: "party" },
                    "fog-light": { vision },
                },
            }
            if (rules.approve) {
                placementsStore.set((list) => [
                    ...list,
                    { id: token.id, peerId, deviceId: p.deviceId, playerName: p.name, token },
                ])
                playSfx("alert")
                showToast(`${p.name} wants to place ${name}. Open Multiplayer to allow it.`)
                return refuse(peerId, `Asked the GM to place ${name}.`)
            }
            addHumbugs([token])
            showToast(`${p.name} placed ${name}`)
            logEvent({ kind: "system", text: `${p.name} placed ${name}` })
            return
        }
        case "remove": {
            const h = humbugsStore.get().find((x) => x.id === req.id)
            if (!h || ownerOf(h) !== p.deviceId) return
            removeHumbugs([h.id])
            logEvent({ kind: "system", text: `${p.name} took ${(h.type === "token" && h.name) || "a token"} off the table` })
            return
        }
        case "patch": {
            const h = humbugsStore.get().find((x) => x.id === req.id)
            if (!h || ownerOf(h) !== p.deviceId) return
            const changes: Partial<Humbug> = {}
            if (req.position && isFiniteNum(req.position.x) && isFiniteNum(req.position.y)) {
                const rules = rulesFor(p.deviceId)
                const to = { x: req.position.x, y: req.position.y }
                if (rules.frozen) return refuse(peerId, "The GM has paused your tokens for now.", h.id)
                if (rules.fenced && !spotVisible(to, humbugFootprint(h))) {
                    return refuse(peerId, "You can only move where the party can see.", h.id)
                }
                changes.position = to
            }
            if (typeof req.name === "string" && h.type === "token") {
                const name = req.name.slice(0, 40).trim()
                if (name) (changes as Partial<TokenHumbug>).name = name
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
        placementsStore.set((list) => list.filter((x) => x.peerId !== peerId))
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
    unsubscribers = [
        onBoardChange(scheduleSync),
        humbugsStore.subscribe(scheduleSync),
        cameraStore.subscribe(onCamera),
        tableRulesStore.subscribe(scheduleSync),
        frozenStore.subscribe(scheduleSync),
    ]
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
    placementsStore.set([])
    frozenStore.set(new Set())
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
