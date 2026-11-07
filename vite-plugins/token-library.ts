import fs from "node:fs"
import path from "node:path"
import type { Plugin } from "vite"
import type {
    TokenLibraryFolder,
    TokenLibraryToken,
} from "../src/types/token-library.types"

const LIBRARY_DIR = "Token_Library"
const MANIFEST_FILE = "token-library.json"
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

function scanFolder(absDir: string, segments: string[]): TokenLibraryFolder {
    const entries = fs.readdirSync(absDir, { withFileTypes: true })
    const folders: TokenLibraryFolder[] = []
    const tokens: TokenLibraryToken[] = []

    for (const entry of entries) {
        if (entry.name.startsWith(".")) continue

        if (entry.isDirectory()) {
            folders.push(
                scanFolder(path.join(absDir, entry.name), [
                    ...segments,
                    entry.name,
                ])
            )
        } else if (
            entry.isFile() &&
            IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
        ) {
            // encodeURI (not encodeURIComponent): Vite's static server decodes
            // with decodeURI, so reserved chars like "&" and "," must stay raw.
            // "#" and "?" would still be read as hash/query, so escape those.
            const urlPath = encodeURI(
                [LIBRARY_DIR, ...segments, entry.name].join("/")
            ).replace(/[#?]/g, encodeURIComponent)
            tokens.push({
                name: path.basename(entry.name, path.extname(entry.name)),
                url: urlPath,
            })
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

function buildManifest(publicDir: string): TokenLibraryFolder {
    const libraryDir = path.join(publicDir, LIBRARY_DIR)
    if (!fs.existsSync(libraryDir)) {
        return { name: "", path: [], folders: [], tokens: [], totalTokens: 0 }
    }
    return scanFolder(libraryDir, [])
}

/**
 * Exposes the contents of public/Token_Library as a JSON tree at
 * /token-library.json. In dev the folder is rescanned on every request, so
 * newly added images show up without restarting the server.
 */
export function tokenLibrary(): Plugin {
    let publicDir = ""

    return {
        name: "jewel-vtt:token-library",

        configResolved(config) {
            publicDir = config.publicDir
        },

        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const pathname = req.url?.split("?")[0]
                if (pathname !== `${server.config.base}${MANIFEST_FILE}`) {
                    return next()
                }
                try {
                    const manifest = buildManifest(publicDir)
                    res.setHeader("Content-Type", "application/json")
                    res.setHeader("Cache-Control", "no-store")
                    res.end(JSON.stringify(manifest))
                } catch (error) {
                    next(error)
                }
            })
        },

        generateBundle() {
            this.emitFile({
                type: "asset",
                fileName: MANIFEST_FILE,
                source: JSON.stringify(buildManifest(publicDir)),
            })
        },
    }
}
