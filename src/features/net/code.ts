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
 *
 * The web version shares the same code as a web address instead:
 *   https://<site>/#join/<room>/<secret>/<host fingerprint>
 * Opening it loads Jewel VTT in the browser with the join form filled in.
 * The code sits after the #, so browsers never send it to the web server.
 * The desktop app hands out web links too when it was built with
 * VITE_WEB_URL (the site's address); otherwise it shares jewel:// links.
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

/** Marks a join code in a web address: https://<site>/#join/… */
export const WEB_JOIN = "#join/"

/** Where players open the web version: this page when it's the website, else VITE_WEB_URL (desktop builds). */
export function webBase(): string | null {
    const onWeb =
        typeof window !== "undefined" && /^https?:$/.test(window.location.protocol) && !window.jewelDesktop
    if (onWeb) return window.location.origin + window.location.pathname
    const configured = (import.meta.env.VITE_WEB_URL as string | undefined)?.trim()
    return configured ? configured.replace(/#.*$/, "") : null
}

/** The link to give players: a web address when there is one (works with or without the app), else jewel://. */
export function shareLink(c: RoomCode): string {
    const base = webBase()
    return base ? `${base}${WEB_JOIN}${c.room}/${c.secret}/${c.host}` : formatCode(c)
}

const PART = /^[0-9A-Z]{8,40}$/

export function parseCode(text: string): RoomCode | null {
    let cleaned = text.trim().replace(/\s+/g, "")
    // A web link: everything after "#join/" is the code
    const web = cleaned.toLowerCase().indexOf(WEB_JOIN)
    if (web >= 0) cleaned = cleaned.slice(web + WEB_JOIN.length)
    const body = cleaned.toLowerCase().startsWith(LINK_PREFIX)
        ? cleaned.slice(LINK_PREFIX.length)
        : cleaned.replace(/^jewel:\/\//i, "")
    const [room, secret, host] = body.split("/").map((p) => p.toUpperCase())
    if (![room, secret, host].every((p) => p && PART.test(p))) return null
    return { room, secret, host }
}
