import type { DocumentHumbug } from "../types/humbug.types"

/** Largest file we embed in a board before warning (bytes) */
export const LARGE_FILE_BYTES = 15 * 1024 * 1024

/**
 * Only plain web links may be opened. Board files can come from other
 * people, so never follow javascript:, data: or other schemes from a URL.
 */
export function safeHttpUrl(raw: string | undefined): URL | null {
    if (!raw) return null
    try {
        const url = new URL(raw.trim())
        return url.protocol === "http:" || url.protocol === "https:" ? url : null
    } catch {
        return null
    }
}

export function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Approximate decoded size of a base64 data URL */
export function dataUrlBytes(dataUrl: string) {
    const comma = dataUrl.indexOf(",")
    return Math.floor(((dataUrl.length - comma - 1) * 3) / 4)
}

const KNOWN_SITES: [RegExp, string][] = [
    [/(^|\.)notion\.(so|site)$/, "Notion"],
    [/^docs\.google\.com$/, "Google Docs"],
    [/^drive\.google\.com$/, "Google Drive"],
    [/(^|\.)dndbeyond\.com$/, "D&D Beyond"],
    [/(^|\.)dropbox\.com$/, "Dropbox"],
    [/(^|\.)github\.com$/, "GitHub"],
]

export function describeDocument(doc: DocumentHumbug): {
    kind: "link" | "file" | "empty"
    subtitle: string
    badge?: string
    canOpen: boolean
} {
    if (doc.fileData) {
        const ext = doc.fileName?.split(".").pop()?.toUpperCase()
        return {
            kind: "file",
            subtitle: `${doc.fileName ?? "File"} · ${formatBytes(dataUrlBytes(doc.fileData))}`,
            badge: ext && ext.length <= 4 ? ext : undefined,
            canOpen: true,
        }
    }
    const url = safeHttpUrl(doc.url)
    if (url) {
        const host = url.hostname.replace(/^www\./, "")
        const site = KNOWN_SITES.find(([re]) => re.test(host))?.[1]
        return { kind: "link", subtitle: site ? `${site} · ${host}` : host, canOpen: true }
    }
    return { kind: "empty", subtitle: "No link or file yet", canOpen: false }
}

function dataUrlToBlob(dataUrl: string, fallbackType?: string) {
    const [header, base64] = dataUrl.split(",")
    const type = /data:([^;]+)/.exec(header)?.[1] ?? fallbackType ?? "application/octet-stream"
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    return new Blob([bytes], { type })
}

/** Types the browser can show in a tab; everything else is downloaded */
const VIEWABLE = /^(application\/pdf|image\/|text\/plain|video\/|audio\/)/

export function openDocument(doc: DocumentHumbug) {
    if (doc.fileData) {
        const blob = dataUrlToBlob(doc.fileData, doc.mimeType)
        const url = URL.createObjectURL(blob)
        if (VIEWABLE.test(blob.type)) {
            window.open(url, "_blank", "noopener")
        } else {
            const a = document.createElement("a")
            a.href = url
            a.download = doc.fileName ?? "document"
            a.click()
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
        return
    }
    const url = safeHttpUrl(doc.url)
    if (url) window.open(url.href, "_blank", "noopener,noreferrer")
}
