import dns from "node:dns/promises"
import net from "node:net"
import type { Plugin } from "vite"

/*
 * Same-origin image fetcher for the cropper (dev server only).
 *
 * Browsers won't let a page read the pixels of an image from another site
 * unless that site sends CORS headers, so cropping a pasted URL fails. This
 * route fetches the image server-side so the cropper can use it.
 *
 * Locked down so it can't be abused:
 * - only requests from Jewel VTT's own pages (Sec-Fetch-Site: same-origin)
 * - only http(s) URLs, only image responses, at most MAX_BYTES
 * - never fetches from loopback, private or link-local addresses (checked
 *   again on every redirect), so other web pages can't reach your network
 */

const ROUTE = "__image-proxy"
const MAX_BYTES = 25 * 1024 * 1024
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 15_000

function isPrivateAddress(ip: string): boolean {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split(".").map(Number)
        return (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            a >= 224
        )
    }
    const v6 = ip.toLowerCase()
    if (v6 === "::" || v6 === "::1") return true
    if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7))
    return /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)
}

async function assertPublicHost(url: URL) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw Object.assign(new Error("Only web (http/https) images can be fetched"), { status: 400 })
    }
    const host = url.hostname.replace(/^\[|\]$/g, "")
    const addresses = net.isIP(host)
        ? [host]
        : (await dns.lookup(host, { all: true })).map((a) => a.address)
    if (!addresses.length || addresses.some(isPrivateAddress)) {
        throw Object.assign(new Error("That address is on a private network"), { status: 403 })
    }
}

async function fetchImage(raw: string): Promise<{ type: string; body: Buffer }> {
    let url = new URL(raw)
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        await assertPublicHost(url)
        const res = await fetch(url, {
            redirect: "manual",
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: { "user-agent": "JewelVTT image fetcher", accept: "image/*" },
        })
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
            url = new URL(res.headers.get("location")!, url)
            continue
        }
        if (!res.ok) throw Object.assign(new Error(`The image host answered ${res.status}`), { status: 502 })
        const type = res.headers.get("content-type") ?? ""
        if (!type.startsWith("image/")) {
            throw Object.assign(new Error("That link isn't an image"), { status: 415 })
        }
        const declared = Number(res.headers.get("content-length") ?? 0)
        if (declared > MAX_BYTES) throw Object.assign(new Error("Image is too large"), { status: 413 })
        const chunks: Uint8Array[] = []
        let size = 0
        for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
            size += chunk.byteLength
            if (size > MAX_BYTES) throw Object.assign(new Error("Image is too large"), { status: 413 })
            chunks.push(chunk)
        }
        return { type, body: Buffer.concat(chunks) }
    }
    throw Object.assign(new Error("Too many redirects"), { status: 502 })
}

export function imageProxy(): Plugin {
    return {
        name: "jewel-vtt:image-proxy",
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const [pathname, query = ""] = (req.url ?? "").split("?")
                if (pathname !== `${server.config.base}${ROUTE}`) return next()

                const fail = (status: number, message: string) => {
                    res.statusCode = status
                    res.setHeader("Content-Type", "text/plain; charset=utf-8")
                    res.end(message)
                }
                // Only Jewel VTT's own pages may use this
                const site = req.headers["sec-fetch-site"]
                if (site !== "same-origin") return fail(403, "Not allowed")
                const target = new URLSearchParams(query).get("url")
                if (!target) return fail(400, "Missing url")
                try {
                    const { type, body } = await fetchImage(target)
                    res.setHeader("Content-Type", type)
                    res.setHeader("Cache-Control", "private, max-age=3600")
                    res.setHeader("X-Content-Type-Options", "nosniff")
                    res.end(body)
                } catch (error) {
                    const e = error as Error & { status?: number }
                    fail(e.status ?? 502, e.name === "TimeoutError" ? "The image took too long to download" : e.message)
                }
            })
        },
    }
}
