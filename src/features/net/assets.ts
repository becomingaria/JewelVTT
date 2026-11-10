import { ASSET_PREFIX } from "./protocol"

/*
 * Images travel once. The GM replaces every embedded image (data: URL) and
 * art-library link in the shared board with "jewel-asset:<id>"; a player's
 * app asks for each id it hasn't got, then shows it from a local blob URL.
 * Keeps board updates small however many maps and tokens are on the table.
 */

const isLibraryPath = (s: string) => /^(Token_Library|Maps_Library)\//.test(s)
const isEmbedded = (s: string) => s.startsWith("data:") && s.length > 1024

async function digest(text: string): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
    return [...new Uint8Array(hash).slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

// ------------------------------------------------------------------ host
const idBySource = new Map<string, string>()
const sourceById = new Map<string, string>()

async function assetId(source: string): Promise<string> {
    let id = idBySource.get(source)
    if (!id) {
        id = await digest(source)
        idBySource.set(source, id)
        sourceById.set(id, source)
    }
    return id
}

/** Deep copy with images swapped for asset references */
export async function assetize(value: unknown): Promise<unknown> {
    if (typeof value === "string") {
        return isEmbedded(value) || isLibraryPath(value) ? ASSET_PREFIX + (await assetId(value)) : value
    }
    if (Array.isArray(value)) return Promise.all(value.map(assetize))
    if (value && typeof value === "object") {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value)) out[k] = await assetize(v)
        return out
    }
    return value
}

const toDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(r.error)
        r.readAsDataURL(blob)
    })

/** The GM answers a player's request for one image */
export async function loadAsset(id: string): Promise<string> {
    const source = sourceById.get(id)
    if (!source) return ""
    if (source.startsWith("data:")) return source
    try {
        const res = await fetch(source)
        return res.ok ? await toDataUrl(await res.blob()) : ""
    } catch {
        return ""
    }
}

// ---------------------------------------------------------------- player
const urlById = new Map<string, string>()
const requested = new Set<string>()

/** 1×1 transparent placeholder while an image is on its way */
const PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAAAAACw="

/**
 * Swap asset references for local URLs. Unknown ids are passed to
 * `request` once and shown as a placeholder until they arrive.
 */
export function resolveAssets(value: unknown, request: (id: string) => void): unknown {
    if (typeof value === "string") {
        if (!value.startsWith(ASSET_PREFIX)) return value
        const id = value.slice(ASSET_PREFIX.length)
        const url = urlById.get(id)
        if (url) return url
        if (!requested.has(id)) {
            requested.add(id)
            request(id)
        }
        return PLACEHOLDER
    }
    if (Array.isArray(value)) return value.map((v) => resolveAssets(v, request))
    if (value && typeof value === "object") {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value)) out[k] = resolveAssets(v, request)
        return out
    }
    return value
}

/** Keep an image that arrived from the GM */
export async function storeAsset(id: string, dataUrl: string): Promise<boolean> {
    requested.delete(id)
    if (!dataUrl.startsWith("data:")) return false
    try {
        const blob = await (await fetch(dataUrl)).blob()
        urlById.set(id, URL.createObjectURL(blob))
        return true
    } catch {
        return false
    }
}

/** Retry later (e.g. the GM was busy) */
export const forgetRequest = (id: string) => requested.delete(id)

export function clearPlayerAssets() {
    urlById.forEach((u) => URL.revokeObjectURL(u))
    urlById.clear()
    requested.clear()
}
