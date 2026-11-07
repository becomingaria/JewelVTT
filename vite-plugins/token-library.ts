import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { Plugin } from "vite"
import type {
    LibraryFolder,
    LibraryItem,
} from "../src/types/token-library.types"

/*
 * Art libraries: folders of images under public/ that the app can browse.
 *
 * - Each library's tree is served as JSON (e.g. /token-library.json); in dev
 *   it is rescanned on every request so new images appear on reload.
 * - Libraries with `thumbnails` get small cached WebP previews generated on
 *   demand at /__library-thumb (big battle maps are ~10 MB each).
 * - Library folders are NOT copied into production builds (Maps_Library
 *   alone is many GB); they are a local, dev-server feature.
 */

interface LibraryConfig {
    /** Folder name under public/ */
    dir: string
    /** Manifest file name served at the app base */
    manifest: string
    /** Generate thumbnails for the drawer */
    thumbnails?: boolean
}

export const LIBRARIES: LibraryConfig[] = [
    { dir: "Token_Library", manifest: "token-library.json" },
    { dir: "Maps_Library", manifest: "maps-library.json", thumbnails: true },
]

const THUMB_ROUTE = "__library-thumb"
const THUMB_WIDTH = 360
const IMAGE_EXTENSIONS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".svg",
    ".avif",
])

const byName = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })

// encodeURI (not encodeURIComponent): Vite's static server decodes with
// decodeURI, so reserved chars like "&" and "," must stay raw. "#" and "?"
// would still be read as hash/query, so escape those.
const toUrlPath = (relPath: string) =>
    encodeURI(relPath).replace(/[#?]/g, encodeURIComponent)

function scanFolder(
    lib: LibraryConfig,
    absDir: string,
    segments: string[]
): LibraryFolder {
    const entries = fs.readdirSync(absDir, { withFileTypes: true })
    const folders: LibraryFolder[] = []
    const tokens: LibraryItem[] = []

    for (const entry of entries) {
        if (entry.name.startsWith(".")) continue

        if (entry.isDirectory()) {
            folders.push(
                scanFolder(lib, path.join(absDir, entry.name), [
                    ...segments,
                    entry.name,
                ])
            )
        } else if (
            entry.isFile() &&
            IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
        ) {
            const relPath = [lib.dir, ...segments, entry.name].join("/")
            const item: LibraryItem = {
                name: path.basename(entry.name, path.extname(entry.name)),
                url: toUrlPath(relPath),
            }
            if (lib.thumbnails) {
                item.thumb = `${THUMB_ROUTE}?src=${encodeURIComponent(relPath)}`
            }
            tokens.push(item)
        }
    }

    folders.sort((a, b) => byName(a.name, b.name))
    tokens.sort((a, b) => byName(a.name, b.name))

    return {
        name: segments[segments.length - 1] ?? "",
        path: segments,
        folders,
        tokens,
        totalTokens:
            tokens.length +
            folders.reduce((sum, folder) => sum + folder.totalTokens, 0),
    }
}

function buildManifest(publicDir: string, lib: LibraryConfig): LibraryFolder {
    const libraryDir = path.join(publicDir, lib.dir)
    if (!fs.existsSync(libraryDir)) {
        return { name: "", path: [], folders: [], tokens: [], totalTokens: 0 }
    }
    return scanFolder(lib, libraryDir, [])
}

export function tokenLibrary(): Plugin {
    let publicDir = ""
    let cacheDir = ""

    // Resolve a thumbnail request to a file inside a thumbnail-enabled library
    const resolveThumbSource = (src: string | null): string | null => {
        if (!src) return null
        const abs = path.resolve(publicDir, src)
        const allowed = LIBRARIES.filter((l) => l.thumbnails).some((l) =>
            abs.startsWith(path.join(publicDir, l.dir) + path.sep)
        )
        if (!allowed || !IMAGE_EXTENSIONS.has(path.extname(abs).toLowerCase()))
            return null
        return fs.existsSync(abs) ? abs : null
    }

    const getThumbnail = async (abs: string): Promise<string> => {
        const stat = fs.statSync(abs)
        const key = crypto
            .createHash("sha1")
            .update(`${abs}|${stat.mtimeMs}|${stat.size}|${THUMB_WIDTH}`)
            .digest("hex")
        const out = path.join(cacheDir, `${key}.webp`)
        if (!fs.existsSync(out)) {
            const { default: sharp } = await import("sharp")
            fs.mkdirSync(cacheDir, { recursive: true })
            const tmp = `${out}.${process.pid}.tmp`
            await sharp(abs, { limitInputPixels: false })
                .rotate()
                .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
                .webp({ quality: 72 })
                .toFile(tmp)
            fs.renameSync(tmp, out)
        }
        return out
    }

    return {
        name: "jewel-vtt:art-libraries",

        config() {
            // Copy public/ ourselves (minus the libraries) in writeBundle
            return { build: { copyPublicDir: false } }
        },

        configResolved(config) {
            publicDir = config.publicDir
            cacheDir = path.join(
                config.cacheDir,
                "..",
                ".cache",
                "jewel-vtt-thumbs"
            )
        },

        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const [pathname, query = ""] = (req.url ?? "").split("?")
                const base = server.config.base

                const lib = LIBRARIES.find(
                    (l) => pathname === `${base}${l.manifest}`
                )
                if (lib) {
                    try {
                        res.setHeader("Content-Type", "application/json")
                        res.setHeader("Cache-Control", "no-store")
                        res.end(JSON.stringify(buildManifest(publicDir, lib)))
                    } catch (error) {
                        next(error)
                    }
                    return
                }

                if (pathname === `${base}${THUMB_ROUTE}`) {
                    const abs = resolveThumbSource(
                        new URLSearchParams(query).get("src")
                    )
                    if (!abs) {
                        res.statusCode = 404
                        res.end()
                        return
                    }
                    try {
                        const file = await getThumbnail(abs)
                        res.setHeader("Content-Type", "image/webp")
                        res.setHeader("Cache-Control", "max-age=86400")
                        fs.createReadStream(file).pipe(res)
                    } catch (error) {
                        next(error)
                    }
                    return
                }

                next()
            })
        },

        generateBundle() {
            for (const lib of LIBRARIES) {
                // Libraries aren't bundled, so ship empty manifests
                this.emitFile({
                    type: "asset",
                    fileName: lib.manifest,
                    source: JSON.stringify(
                        buildManifest(path.join(publicDir, "__none__"), lib)
                    ),
                })
            }
        },

        writeBundle(options) {
            const outDir = options.dir
            if (!outDir || !fs.existsSync(publicDir)) return
            const skip = new Set(LIBRARIES.map((l) => l.dir))
            for (const entry of fs.readdirSync(publicDir)) {
                if (skip.has(entry) || entry.startsWith(".")) continue
                fs.cpSync(
                    path.join(publicDir, entry),
                    path.join(outDir, entry),
                    { recursive: true }
                )
            }
        },
    }
}
