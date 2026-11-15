import type { Room } from "trystero"
import type { Humbug, LightSource, Point } from "../../types/humbug.types"
import {
    applyBoardSlices,
    patchBoardSlices,
    setAutosavePaused,
    snapshotBoard,
} from "../../utils/board-store"
import { showToast } from "../../utils/toast"
import { flyTo } from "../../utils/view-events"
import { cameraStore, humbugsStore } from "../board-bridge"
import { humbugFootprint } from "../../utils/humbug.utils"
import { cellAt, cellKey } from "../grid"
import { isCellVisible } from "../fog-light/effective-fog"
import { fogShape } from "../fog-light/fog-store"
import { auditStore } from "../dice/audit"
import { playSfx } from "../sound"
import { createStore } from "../store"
import { netRoleStore } from "../view-state"
import { clearPlayerAssets, forgetRequest, resolveAssets, storeAsset } from "./assets"
import { formatCode, parseCode, type RoomCode } from "./code"
import { ownerOf } from "./filter"
import { getIdentity } from "./identity"
import {
    DEFAULT_MAX_TOKENS,
    PLAYER_LOCAL_SLICES,
    type NoticeMsg,
    type PlayerRequest,
    type PlayerRules,
    type ShareMsg,
    type StateMsg,
} from "./protocol"
import { channel, openRoom, requestChannel } from "./transport"

/*
 * A player's side of a shared game. The board on screen mirrors the GM's
 * (as filtered for players). The player's own saved board is set aside on
 * joining and put back on leaving; autosave is paused meanwhile so the
 * mirrored board never overwrites it.
 */

export interface ClientState {
    status: "connecting" | "waiting" | "connected" | "lost" | "refused" | "ended"
    link: string
    hostName?: string
    message?: string
    /** The GM is sharing their view */
    sharing: boolean
    /** This player's camera follows the GM's */
    following: boolean
    /** This device's id (the GM sees and labels it) */
    you?: string
}

export const clientStore = createStore<ClientState | null>(null)

/** The GM's rules for this player */
export const DEFAULT_RULES: PlayerRules = { maxTokens: DEFAULT_MAX_TOKENS, frozen: false, fenced: true, approve: false }
export const rulesStore = createStore<PlayerRules>(DEFAULT_RULES)

/** A character waiting to be put on the map (the player clicks a spot) */
export interface Placing {
    name: string
    image: string
    char?: string
    light?: LightSource
    vision?: number
}
export const placingStore = createStore<Placing | null>(null)
const setClient = (patch: Partial<ClientState>) => clientStore.set((c) => (c ? { ...c, ...patch } : c))

interface Conn {
    room: Room
    code: RoomCode
    hostPeer: string | null
    send: (r: PlayerRequest) => void
    requestAsset: (id: string) => Promise<string>
}

let conn: Conn | null = null
let backup: Record<string, unknown> | null = null
let displayName = ""
let hostSlices: Record<string, unknown> = {}
let lastShare: ShareMsg["view"]
let connectTimer = 0

// --------------------------------------------------- own-token changes
type TokenPatch = { position?: Point; light?: LightSource | null; vision?: number; name?: string }

/** What each of my tokens should look like after the GM's latest state */
let expected = new Map<string, Humbug>()
/** Changes sent but not yet confirmed by the GM (shown meanwhile) */
const pending = new Map<string, { patch: TokenPatch; at: number }>()
/** My moves, newest last, for "Undo my move" */
const myMoves: { id: string; from: Point }[] = []

const visionOf = (h: Humbug) => (h.ext?.["fog-light"] as { vision?: number } | undefined)?.vision ?? 0
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

function overlayPending(list: Humbug[]): Humbug[] {
    const now = Date.now()
    return list.map((h) => {
        const p = pending.get(h.id)
        if (!p) return h
        const confirmed =
            (!p.patch.position || same(p.patch.position, h.position)) &&
            (!("light" in p.patch) || same(p.patch.light ?? undefined, h.light)) &&
            (p.patch.vision === undefined || p.patch.vision === visionOf(h)) &&
            (p.patch.name === undefined || (h.type === "token" && h.name === p.patch.name))
        if (confirmed || now - p.at > 5000) {
            pending.delete(h.id)
            return h
        }
        const next = { ...h }
        if (p.patch.position) next.position = p.patch.position
        if ("light" in p.patch) next.light = p.patch.light ?? undefined
        if (p.patch.vision !== undefined) {
            next.ext = { ...h.ext, "fog-light": { ...(h.ext?.["fog-light"] as object), vision: p.patch.vision } }
        }
        if (p.patch.name !== undefined && next.type === "token") next.name = p.patch.name
        return next
    })
}

let patchTimer = 0
function watchMyTokens() {
    if (!conn || !clientStore.get()?.you) return
    // Wait for drags to finish before telling the GM
    window.clearTimeout(patchTimer)
    patchTimer = window.setTimeout(sendMyChanges, 180)
}

/** Can the party see where this token would stand? (the GM checks too) */
function spotVisible(position: Point, h: Humbug): boolean {
    const size = humbugFootprint(h)
    return isCellVisible(cellKey(cellAt({ x: position.x + size.width / 2, y: position.y + size.height / 2 }, fogShape())))
}

function sendMyChanges() {
    const you = clientStore.get()?.you
    if (!conn || !you) return
    const rules = rulesStore.get()
    let refused = ""
    for (const h of humbugsStore.get()) {
        if (ownerOf(h) !== you) continue
        const exp = expected.get(h.id)
        if (!exp) continue
        const patch: TokenPatch = {}
        if (!same(h.position, exp.position)) {
            if (rules.frozen) refused = "The GM has paused your tokens for now."
            else if (rules.fenced && !spotVisible(h.position, h)) refused = "You can only move where the party can see."
            else {
                patch.position = h.position
                myMoves.push({ id: h.id, from: exp.position })
                if (myMoves.length > 50) myMoves.shift()
            }
        }
        if (!same(h.light, exp.light)) patch.light = h.light ?? null
        if (visionOf(h) !== visionOf(exp)) patch.vision = visionOf(h)
        if (!Object.keys(patch).length) continue
        expected.set(h.id, { ...h, position: patch.position ?? exp.position })
        pending.set(h.id, { patch, at: Date.now() })
        conn.send({ t: "patch", id: h.id, ...patch })
    }
    if (refused) {
        // Back where the GM has it
        showToast(refused)
        playSfx("error")
        reapply()
    }
}

/** Put my last-moved token back where it was */
export function undoMyMove(): boolean {
    const last = myMoves.pop()
    if (!conn || !last) return false
    pending.set(last.id, { patch: { position: last.from }, at: Date.now() })
    conn.send({ t: "patch", id: last.id, position: last.from })
    reapply()
    return true
}

export const canUndoMove = () => myMoves.length > 0

/** Rename one of my tokens on the table */
export function renameMyToken(id: string, name: string) {
    const clean = name.trim().slice(0, 40)
    if (!conn || !clean) return
    const prev = pending.get(id)?.patch ?? {}
    pending.set(id, { patch: { ...prev, name: clean }, at: Date.now() })
    conn.send({ t: "patch", id, name: clean })
    reapply()
}

/** Take one of my tokens off the table */
export function removeMyToken(id: string) {
    conn?.send({ t: "remove", id })
}

// ------------------------------------------------------- rolls to the GM
/** Audit entries already known (the GM's, or ones we've sent) */
const knownRolls = new Set<string>()
function watchRolls() {
    for (const e of auditStore.get()) {
        if (knownRolls.has(e.id)) continue
        knownRolls.add(e.id)
        // A roll made here: the GM logs it for everyone and keeps it in the audit
        if (!conn) continue
        const what = e.table ?? `${e.label ? e.label + ": " : ""}${e.expression} = ${e.total}`
        const flag = e.crit ? " (critical!)" : e.fumble ? " (fumble!)" : ""
        conn.send({ t: "roll", text: what + flag, roll: e })
    }
}

// ---------------------------------------------------------- GM's state
let reapplyTimer = 0
function reapply() {
    window.clearTimeout(reapplyTimer)
    reapplyTimer = window.setTimeout(() => applySlices(hostSlices), 30)
}

function requestAsset(id: string) {
    if (!conn) return
    conn.requestAsset(id)
        .then(async (data) => {
            if (await storeAsset(id, String(data ?? ""))) reapply()
            else forgetRequest(id)
        })
        .catch(() => forgetRequest(id))
}

function applySlices(slices: Record<string, unknown>) {
    const resolved: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(slices)) {
        if (PLAYER_LOCAL_SLICES.has(k)) continue
        resolved[k] = resolveAssets(v, requestAsset)
    }
    if (Array.isArray(resolved.humbugs)) {
        const list = overlayPending(resolved.humbugs as Humbug[])
        resolved.humbugs = list
        const you = clientStore.get()?.you
        expected = new Map(list.filter((h) => ownerOf(h) === you).map((h) => [h.id, h]))
    }
    // Rolls already in the GM's audit are known (not sent back)
    if (Array.isArray(resolved["dice:audit"])) {
        for (const e of resolved["dice:audit"] as { id: string }[]) knownRolls.add(e.id)
    }
    patchBoardSlices(resolved)
}

let firstState = true
function onState(msg: StateMsg) {
    if (!msg || typeof msg !== "object" || !msg.slices) return
    if (clientStore.get()?.status !== "connected") {
        setClient({ status: "connected", message: undefined, you: msg.you })
    }
    if (msg.rules && typeof msg.rules === "object") {
        const r = msg.rules
        rulesStore.set({
            maxTokens: typeof r.maxTokens === "number" ? r.maxTokens : DEFAULT_MAX_TOKENS,
            frozen: !!r.frozen,
            fenced: !!r.fenced,
            approve: !!r.approve,
        })
        if (r.frozen) placingStore.set(null)
    }
    hostSlices = { ...hostSlices, ...msg.slices }
    applySlices(msg.slices)
    if (firstState) {
        firstState = false
        playSfx("place")
        // Start where the GM is looking, if they're sharing
        if (lastShare) flyTo({ x: lastShare.x, y: lastShare.y, fit: lastShare, instant: true })
    }
}

// --------------------------------------------------------- GM's view
function onShare(msg: ShareMsg) {
    const was = clientStore.get()?.sharing
    lastShare = msg.sharing ? msg.view : undefined
    setClient({ sharing: !!msg.sharing, following: msg.sharing ? clientStore.get()?.following ?? false : false })
    if (msg.sharing && !was) playSfx("alert")
    if (msg.sharing && clientStore.get()?.following && msg.view) {
        flyTo({ x: msg.view.x, y: msg.view.y, fit: msg.view, instant: true })
    }
}

let stopFollowListeners: (() => void) | null = null
export function followGm(on: boolean) {
    setClient({ following: on })
    stopFollowListeners?.()
    stopFollowListeners = null
    if (!on) return
    if (lastShare) flyTo({ x: lastShare.x, y: lastShare.y, fit: lastShare, instant: true })
    // Panning or zooming yourself stops following
    const el = cameraStore.get()?.container
    if (!el) return
    const stop = () => followGm(false)
    el.addEventListener("wheel", stop, { passive: true })
    el.addEventListener("pointerdown", stop)
    stopFollowListeners = () => {
        el.removeEventListener("wheel", stop)
        el.removeEventListener("pointerdown", stop)
    }
}

// ------------------------------------------------------------ notices
function onNotice(msg: NoticeMsg) {
    switch (msg?.kind) {
        case "toast":
            if (msg.revert) {
                // The GM said no: put the token back where the GM has it
                pending.delete(msg.revert)
                reapply()
            }
            if (msg.text) showToast(msg.text)
            return
        case "migrate":
            if (msg.code) void switchRoom(msg.code)
            return
        case "kicked":
        case "banned":
        case "ended":
            void leaveGame(msg.text ?? "The game ended.", msg.kind === "ended" ? "ended" : "refused")
            return
    }
}

// --------------------------------------------------------------- room
async function connect(code: RoomCode) {
    const identity = await getIdentity()
    const room = openRoom(code, {
        role: "player",
        name: displayName,
        identity,
        onWaiting: (hostName) => setClient({ status: "waiting", hostName, message: undefined }),
        onRefused: (reason) => void leaveGame(reason, "refused"),
        onHost: (peerId, hostName) => {
            if (!conn) return
            conn.hostPeer = peerId
            setClient({ hostName, you: identity.deviceId })
            // Listening now: ask for the whole board (messages sent before
            // this point could have arrived before we knew who the GM was)
            conn.send({ t: "ready" })
        },
    })
    const req = channel<PlayerRequest>(room, "req")
    const assets = requestChannel<string, string>(room, "asset")
    channel<StateMsg>(room, "state").listen((m, peer) => peer === conn?.hostPeer && onState(m))
    channel<ShareMsg>(room, "share").listen((m, peer) => peer === conn?.hostPeer && onShare(m))
    channel<NoticeMsg>(room, "notice").listen((m, peer) => peer === conn?.hostPeer && onNotice(m))
    room.onPeerLeave = (peerId) => {
        if (peerId !== conn?.hostPeer) return
        conn.hostPeer = null
        setClient({ status: "lost", message: "Lost the GM. Reconnecting when they're back…", sharing: false })
        followGm(false)
    }
    conn = {
        room,
        code,
        hostPeer: null,
        send: (r) => {
            const host = conn?.hostPeer
            if (host) req.send(r, host)
        },
        requestAsset: (id) => (conn?.hostPeer ? assets.request(id, conn.hostPeer) : Promise.reject(new Error("no host"))),
    }
    window.clearTimeout(connectTimer)
    connectTimer = window.setTimeout(() => {
        if (clientStore.get()?.status === "connecting") {
            setClient({
                message:
                    "Still looking for the GM. Check the code, and that the GM's app is open and hosting. Strict networks (some offices, schools, mobile hotspots) can block direct connections.",
            })
        }
    }, 20_000)
}

let unsubscribers: (() => void)[] = []

/** Join a game. Returns an error message, or null when it started connecting. */
export async function joinGame(linkText: string, name: string): Promise<string | null> {
    const code = parseCode(linkText)
    if (!code) return "That doesn't look like a room code. Paste the whole link the GM sent."
    if (netRoleStore.get() === "host") return "You're hosting a game. Stop hosting first."
    if (conn) await leaveGame()
    displayName = name.trim().slice(0, 40) || "Adventurer"

    // Set the player's own board aside; show the GM's instead
    backup = snapshotBoard().board
    setAutosavePaused(true)
    netRoleStore.set("player")
    applyBoardSlices({})
    hostSlices = {}
    firstState = true
    knownRolls.clear()
    auditStore.get().forEach((e) => knownRolls.add(e.id))
    clientStore.set({ status: "connecting", link: formatCode(code), sharing: false, following: false })
    unsubscribers = [humbugsStore.subscribe(watchMyTokens), auditStore.subscribe(watchRolls)]
    await connect(code)
    return null
}

/** The GM moved the game to a new code: follow without losing the board */
async function switchRoom(link: string) {
    const code = parseCode(link)
    if (!code || !conn) return
    const old = conn.room
    conn = null
    await connect(code)
    setClient({ link: formatCode(code), status: "connecting" })
    window.setTimeout(() => void old.leave(), 1000)
}

export async function leaveGame(message?: string, status: ClientState["status"] = "ended") {
    window.clearTimeout(connectTimer)
    unsubscribers.forEach((u) => u())
    unsubscribers = []
    followGm(false)
    const old = conn
    conn = null
    if (old) void old.room.leave()
    pending.clear()
    myMoves.length = 0
    placingStore.set(null)
    rulesStore.set(DEFAULT_RULES)
    expected = new Map()
    hostSlices = {}
    lastShare = undefined
    clearPlayerAssets()
    // Put the player's own board back
    if (backup) applyBoardSlices(backup)
    backup = null
    setAutosavePaused(false)
    netRoleStore.set("solo")
    clientStore.set(message ? { status, link: "", message, sharing: false, following: false } : null)
    if (message) showToast(message)
}

/** Ask the GM to put my character on the table at a spot (top-left, world units) */
export function requestAddToken(c: Placing, at?: Point) {
    conn?.send({ t: "add-token", name: c.name, image: c.image, char: c.char, light: c.light ?? null, vision: c.vision, at })
}
