import { joinRoom, type DataPayload, type Room } from "trystero"
import type { RoomCode } from "./code"
import { fingerprint, randomToken, verifySignature, type Identity } from "./identity"

/*
 * Peer-to-peer connections (WebRTC via Trystero). Peers find each other
 * through public Nostr relays; the room secret encrypts that exchange.
 * After that, data flows directly between the apps, encrypted.
 *
 * Every connection starts with a handshake before anything else is sent:
 *   1. both send hello { role, name, public key, nonce }
 *   2. both sign the other's nonce; both verify
 *   3. a player only accepts the GM whose key matches the room code;
 *      the GM checks bans, asks the GM to admit (knock), then answers.
 * Players reject each other, so the network is a star around the GM.
 */

export const APP_ID = "jewel-vtt/1"

export type Role = "host" | "player"

interface Hello {
    v: 1
    role: Role
    name: string
    pub: JsonWebKey
    nonce: string
}

export interface Verdict {
    ok: boolean
    reason?: string
}

export interface PeerIdentity {
    peerId: string
    deviceId: string
    name: string
    /** Remote address as seen by WebRTC (null if unknown) */
    ip: string | null
}

export interface OpenRoomOptions {
    role: Role
    name: string
    identity: Identity
    /** GM only: decide whether to let a verified player in (may wait for the GM) */
    admit?: (peer: PeerIdentity) => Promise<Verdict>
    /** GM only: a verified player joined */
    onVerified?: (peer: PeerIdentity) => void
    /** Player only: the handshake reached the GM and is waiting for an answer */
    onWaiting?: (hostName: string) => void
    /** Player only: the GM refused */
    onRefused?: (reason: string) => void
    /** Player only: the GM was verified */
    onHost?: (peerId: string, hostName: string) => void
}

const isHello = (x: unknown): x is Hello => {
    const h = x as Hello
    return (
        !!h &&
        h.v === 1 &&
        (h.role === "host" || h.role === "player") &&
        typeof h.name === "string" &&
        typeof h.nonce === "string" &&
        !!h.pub &&
        typeof h.pub === "object"
    )
}

/** Printable characters only, at most 40 */
const cleanName = (s: string) =>
    [...s].filter((ch) => ch.charCodeAt(0) >= 32).join("").trim().slice(0, 40) || "Adventurer"

/** The remote address of a live connection, from WebRTC stats */
export async function peerAddress(pc: RTCPeerConnection | undefined): Promise<string | null> {
    if (!pc) return null
    try {
        const stats = await pc.getStats()
        let pairId: string | undefined
        stats.forEach((r) => {
            if (r.type === "transport" && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId
        })
        if (!pairId) {
            stats.forEach((r) => {
                if (r.type === "candidate-pair" && r.state === "succeeded" && (r.nominated || r.selected)) pairId = r.id
            })
        }
        const pair = pairId ? stats.get(pairId) : undefined
        const remote = pair ? stats.get(pair.remoteCandidateId) : undefined
        const addrOf = (c: { address?: string; ip?: string } | undefined) => c?.address || c?.ip || ""
        const addr = addrOf(remote)
        if (addr && !addr.endsWith(".local")) return addr
        // On a local network the browser hides the address in use; the
        // peer's public address is usually among its other candidates
        let pub = ""
        stats.forEach((r) => {
            if (!pub && r.type === "remote-candidate" && (r.candidateType === "srflx" || r.candidateType === "prflx")) {
                pub = addrOf(r)
            }
        })
        if (pub) return pub
        return remote ? "local network" : null
    } catch {
        return null
    }
}

export function openRoom(code: RoomCode, opts: OpenRoomOptions): Room {
    const { identity } = opts
    let room: Room | null = null

    room = joinRoom(
        { appId: APP_ID, password: code.secret },
        code.room,
        {
            // Knocking players wait for the GM, so allow a long handshake
            handshakeTimeoutMs: 180_000,
            onPeerHandshake: async (peerId, send, receive) => {
                const nonce = randomToken(16)
                const mine: Hello = { v: 1, role: opts.role, name: cleanName(opts.name), pub: identity.publicJwk, nonce }
                await send(mine as never)
                const theirs = (await receive()).data
                if (!isHello(theirs)) throw new Error("bad hello")

                await send({ sig: await identity.sign(`${theirs.nonce}|${code.room}`) })
                const sig = ((await receive()).data as { sig?: string })?.sig
                if (typeof sig !== "string" || !(await verifySignature(theirs.pub, `${nonce}|${code.room}`, sig))) {
                    throw new Error("bad signature")
                }
                const deviceId = await fingerprint(theirs.pub)
                const name = cleanName(theirs.name)

                if (opts.role === "player") {
                    // Only the GM named in the code; never other players
                    if (theirs.role !== "host" || deviceId !== code.host) throw new Error("not the host")
                    opts.onWaiting?.(name)
                    const verdict = (await receive()).data as unknown as Verdict
                    if (!verdict?.ok) {
                        opts.onRefused?.(verdict?.reason ?? "The GM didn't let you in.")
                        throw new Error("refused")
                    }
                    opts.onHost?.(peerId, name)
                    return
                }

                // GM
                if (theirs.role !== "player") throw new Error("only players may join")
                const ip = await peerAddress(room?.getPeers()[peerId])
                const peer = { peerId, deviceId, name, ip }
                const verdict = opts.admit ? await opts.admit(peer) : { ok: true }
                await send(verdict as never)
                if (!verdict.ok) throw new Error("refused")
                opts.onVerified?.(peer)
            },
        }
    )
    return room
}

/** Close one peer's connection (kick) */
export function dropPeer(room: Room, peerId: string) {
    try {
        room.getPeers()[peerId]?.close()
    } catch {
        /* already gone */
    }
}

/** A typed message channel over a room (Trystero actions carry plain JSON) */
export function channel<T>(room: Room, name: string) {
    const action = room.makeAction(name)
    return {
        send: (data: T, target?: string) =>
            void action.send(data as unknown as DataPayload, target ? { target } : undefined).catch(() => {}),
        listen: (fn: (data: T, peerId: string) => void) => {
            action.onMessage = (d, ctx) => fn(d as unknown as T, ctx.peerId)
        },
    }
}

/** A typed request/response channel (used for images, which can be large) */
export function requestChannel<T, R>(room: Room, name: string) {
    const action = room.makeAction(name, { kind: "request" })
    return {
        request: (data: T, target: string, timeoutMs = 120_000) =>
            action.request(data as unknown as DataPayload, { target, timeoutMs }) as unknown as Promise<R>,
        answer: (fn: (data: T, peerId: string) => R | Promise<R>) => {
            action.onRequest = (d, ctx) => fn(d as unknown as T, ctx.peerId) as unknown as DataPayload
        },
    }
}
