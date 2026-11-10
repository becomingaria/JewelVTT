import { randomToken } from "./identity"

/*
 * Room codes. One string carries everything a player needs:
 *   jewel://join/<room>/<secret>/<host fingerprint>
 * - room: which meeting place on the public relays to look for the GM
 * - secret: encrypts the connection setup, so strangers on the relays can't
 *   read it or join; a new code means a new secret
 * - host fingerprint: the GM's device key, so nobody else can pose as the GM
 *
 * Players can paste the link, the bare "room/secret/host" part, or click
 * the link (the desktop app opens jewel:// links).
 */

export interface RoomCode {
    room: string
    secret: string
    host: string
}

export const LINK_PREFIX = "jewel://join/"

export function newRoom(hostFingerprint: string): RoomCode {
    return { room: randomToken(8), secret: randomToken(16), host: hostFingerprint }
}

export const formatCode = (c: RoomCode) => `${LINK_PREFIX}${c.room}/${c.secret}/${c.host}`

const PART = /^[0-9A-Z]{8,40}$/

export function parseCode(text: string): RoomCode | null {
    const cleaned = text.trim().replace(/\s+/g, "")
    const body = cleaned.toLowerCase().startsWith(LINK_PREFIX)
        ? cleaned.slice(LINK_PREFIX.length)
        : cleaned.replace(/^jewel:\/\//i, "")
    const [room, secret, host] = body.split("/").map((p) => p.toUpperCase())
    if (![room, secret, host].every((p) => p && PART.test(p))) return null
    return { room, secret, host }
}
