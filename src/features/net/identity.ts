/*
 * Device identity. Each install makes one ECDSA P-256 key pair and keeps it.
 * The public key's fingerprint is the device id the GM sees, labels and can
 * ban; signatures prove a peer really holds that key (so nobody can pose as
 * the GM or as another player). Stored per viewer in localStorage.
 */

const KEY = "jewel:net:identity"
const ALG = { name: "ECDSA", namedCurve: "P-256" } as const
const SIGN = { name: "ECDSA", hash: "SHA-256" } as const

export interface Identity {
    deviceId: string
    publicJwk: JsonWebKey
    sign: (text: string) => Promise<string>
}

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/** Base32 (Crockford-ish, no confusing letters) for short readable ids */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
export function base32(bytes: Uint8Array, length: number): string {
    let out = ""
    let bits = 0
    let value = 0
    for (const byte of bytes) {
        value = (value << 8) | byte
        bits += 8
        while (bits >= 5 && out.length < length) {
            out += ALPHABET[(value >>> (bits - 5)) & 31]
            bits -= 5
        }
        if (out.length >= length) break
    }
    return out
}

/** Short, stable id for a public key */
export async function fingerprint(jwk: JsonWebKey): Promise<string> {
    const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical))
    return base32(new Uint8Array(hash), 16)
}

export async function verifySignature(jwk: JsonWebKey, text: string, signature: string): Promise<boolean> {
    try {
        const key = await crypto.subtle.importKey("jwk", jwk, ALG, false, ["verify"])
        return await crypto.subtle.verify(SIGN, key, unb64(signature), new TextEncoder().encode(text))
    } catch {
        return false
    }
}

async function load(): Promise<Identity> {
    let pair: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null
    let publicJwk: JsonWebKey | null = null
    try {
        const raw = localStorage.getItem(KEY)
        if (raw) {
            const saved = JSON.parse(raw) as { pub: JsonWebKey; priv: JsonWebKey }
            pair = {
                publicKey: await crypto.subtle.importKey("jwk", saved.pub, ALG, true, ["verify"]),
                privateKey: await crypto.subtle.importKey("jwk", saved.priv, ALG, false, ["sign"]),
            }
            publicJwk = saved.pub
        }
    } catch {
        pair = null
    }
    if (!pair || !publicJwk) {
        const made = await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])
        pair = made
        publicJwk = await crypto.subtle.exportKey("jwk", made.publicKey)
        try {
            const priv = await crypto.subtle.exportKey("jwk", made.privateKey)
            localStorage.setItem(KEY, JSON.stringify({ pub: publicJwk, priv }))
        } catch {
            /* storage unavailable: this session gets a temporary identity */
        }
    }
    const privateKey = pair.privateKey
    const pub = { kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x, y: publicJwk.y }
    return {
        deviceId: await fingerprint(pub),
        publicJwk: pub,
        sign: async (text) =>
            b64(await crypto.subtle.sign(SIGN, privateKey, new TextEncoder().encode(text))),
    }
}

let identity: Promise<Identity> | null = null
export const getIdentity = () => (identity ??= load())

/** Random url-safe text */
export function randomToken(bytes: number): string {
    const a = crypto.getRandomValues(new Uint8Array(bytes))
    return base32(a, Math.ceil((bytes * 8) / 5))
}
