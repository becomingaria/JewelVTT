import { app, BrowserWindow, ipcMain, nativeImage, net, protocol, session, shell } from "electron"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { autoUpdater } from "electron-updater"
import { IMAGE_EXTENSIONS, LIBRARIES, THUMB_ROUTE, buildManifest } from "../vite-plugins/token-library"
import { fetchImage } from "../vite-plugins/image-proxy"

/*
 * Jewel VTT desktop shell.
 *
 * The built web app is served from a private app://jewel/ origin, which
 * also answers the routes the Vite dev server provides (art library
 * manifests, thumbnails, the image proxy), so the web code runs unchanged.
 */

const SCHEME = "app"
const HOST = "jewel"
const ORIGIN = `${SCHEME}://${HOST}`
const DEV_URL = process.env.VITE_DEV_SERVER_URL
const RELEASES_URL = "https://github.com/becomingaria/JewelVTT/releases/latest"
const JOIN_SCHEME = "jewel"
const DIST = path.join(__dirname, "..", "dist")

protocol.registerSchemesAsPrivileged([
    {
        scheme: SCHEME,
        privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
    },
])

let win: BrowserWindow | null = null
let pendingJoinLink: string | null = null

// ------------------------------------------------------------ libraries
/** Art libraries live in Documents/Jewel VTT/{Token_Library,Maps_Library} */
const libraryRoot = () => path.join(app.getPath("documents"), "Jewel VTT")

function ensureLibraryFolders() {
    for (const lib of LIBRARIES) {
        try {
            fs.mkdirSync(path.join(libraryRoot(), lib.dir), { recursive: true })
        } catch {
            /* read-only documents folder: libraries just stay empty */
        }
    }
}

const insideDir = (dir: string, file: string) => {
    const rel = path.relative(dir, file)
    return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel)
}

/** Small JPEG preview for big maps, cached in userData */
async function thumbnail(abs: string): Promise<Response> {
    const stat = fs.statSync(abs)
    const key = crypto.createHash("sha1").update(`${abs}|${stat.mtimeMs}|${stat.size}`).digest("hex")
    const dir = path.join(app.getPath("userData"), "thumbs")
    const out = path.join(dir, `${key}.jpg`)
    if (!fs.existsSync(out)) {
        const img = nativeImage.createFromPath(abs)
        // Formats nativeImage can't decode (e.g. WebP) are served as-is
        if (img.isEmpty()) return net.fetch(pathToFileURL(abs).toString())
        fs.mkdirSync(dir, { recursive: true })
        const { width } = img.getSize()
        const small = width > 360 ? img.resize({ width: 360, quality: "good" }) : img
        fs.writeFileSync(out, small.toJPEG(72))
    }
    return net.fetch(pathToFileURL(out).toString())
}

// ------------------------------------------------------------- protocol
async function handleAppRequest(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.host !== HOST) return new Response("Not found", { status: 404 })
    const pathname = decodeURIComponent(url.pathname)

    // Image proxy: lets the cropper read pixels from other sites
    if (pathname === "/__image-proxy") {
        const target = url.searchParams.get("url")
        if (!target) return new Response("Missing url", { status: 400 })
        try {
            const { type, body } = await fetchImage(target)
            return new Response(new Uint8Array(body), {
                headers: { "Content-Type": type, "X-Content-Type-Options": "nosniff" },
            })
        } catch (e) {
            const err = e as Error & { status?: number }
            return new Response(err.message, { status: err.status ?? 502 })
        }
    }

    // Library manifests, rescanned on every request so new art shows up
    const lib = LIBRARIES.find((l) => pathname === `/${l.manifest}`)
    if (lib) {
        return new Response(JSON.stringify(buildManifest(libraryRoot(), lib)), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        })
    }

    if (pathname === `/${THUMB_ROUTE}`) {
        const src = url.searchParams.get("src") ?? ""
        const abs = path.resolve(libraryRoot(), src)
        const ok =
            LIBRARIES.some((l) => insideDir(path.join(libraryRoot(), l.dir), abs)) &&
            IMAGE_EXTENSIONS.has(path.extname(abs).toLowerCase()) &&
            fs.existsSync(abs)
        return ok ? thumbnail(abs) : new Response("Not found", { status: 404 })
    }

    // Library files
    for (const l of LIBRARIES) {
        if (pathname.startsWith(`/${l.dir}/`)) {
            const abs = path.resolve(libraryRoot(), "." + pathname)
            if (!insideDir(path.join(libraryRoot(), l.dir), abs) || !fs.existsSync(abs)) {
                return new Response("Not found", { status: 404 })
            }
            return net.fetch(pathToFileURL(abs).toString())
        }
    }

    // The built app (single-page: unknown paths get index.html)
    let file = path.resolve(DIST, "." + pathname)
    if (!insideDir(DIST, file) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        file = path.join(DIST, "index.html")
    }
    return net.fetch(pathToFileURL(file).toString())
}

// ------------------------------------------------------------ join links
const findJoinLink = (argv: string[]) => argv.find((a) => a.startsWith(`${JOIN_SCHEME}://`)) ?? null

function deliverJoinLink(link: string) {
    pendingJoinLink = link
    if (win && !win.isDestroyed()) {
        win.webContents.send("join:link", link)
        if (win.isMinimized()) win.restore()
        win.focus()
    }
}

// --------------------------------------------------------------- updates
type UpdateStatus =
    | { state: "checking" }
    | { state: "none" }
    | { state: "downloading"; version?: string; percent?: number }
    | { state: "ready"; version: string }
    /** Mac builds are unsigned, so they can't install themselves */
    | { state: "manual"; version: string; url: string }
    | { state: "error"; message: string }

let lastStatus: UpdateStatus | null = null
function sendStatus(s: UpdateStatus) {
    lastStatus = s
    win?.webContents.send("update:status", s)
}

function setupUpdates() {
    if (!app.isPackaged) return
    const manualOnly = process.platform === "darwin"
    autoUpdater.autoDownload = !manualOnly
    autoUpdater.autoInstallOnAppQuit = !manualOnly
    autoUpdater.on("checking-for-update", () => sendStatus({ state: "checking" }))
    autoUpdater.on("update-not-available", () => sendStatus({ state: "none" }))
    autoUpdater.on("update-available", (info) =>
        sendStatus(
            manualOnly
                ? { state: "manual", version: info.version, url: RELEASES_URL }
                : { state: "downloading", version: info.version }
        )
    )
    autoUpdater.on("download-progress", (p) =>
        sendStatus({ state: "downloading", percent: Math.round(p.percent) })
    )
    autoUpdater.on("update-downloaded", (info) => sendStatus({ state: "ready", version: info.version }))
    autoUpdater.on("error", (e) => sendStatus({ state: "error", message: e?.message ?? String(e) }))
    // Check shortly after launch, then every 6 hours while open
    const check = () => autoUpdater.checkForUpdates().catch(() => {})
    setTimeout(check, 4000)
    setInterval(check, 6 * 60 * 60 * 1000)
}

// ----------------------------------------------------------------- window
function createWindow() {
    win = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: "#e9e4d8",
        title: "Jewel VTT",
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
        },
    })

    // Links to other sites open in the browser; the app never navigates away
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:/i.test(url)) void shell.openExternal(url)
        return { action: "deny" }
    })
    win.webContents.on("will-navigate", (e, url) => {
        const allowed = DEV_URL ? url.startsWith(DEV_URL) : url.startsWith(ORIGIN)
        if (!allowed) {
            e.preventDefault()
            if (/^https?:/i.test(url)) void shell.openExternal(url)
        }
    })
    win.webContents.on("did-finish-load", () => {
        if (lastStatus) win?.webContents.send("update:status", lastStatus)
    })

    void win.loadURL(DEV_URL ?? `${ORIGIN}/index.html`)
    win.on("closed", () => (win = null))
}

// -------------------------------------------------------------- lifecycle
if (!app.requestSingleInstanceLock()) {
    app.quit()
} else {
    pendingJoinLink = findJoinLink(process.argv)

    // Windows/Linux: a jewel:// link opened while running arrives here
    app.on("second-instance", (_e, argv) => {
        const link = findJoinLink(argv)
        if (link) deliverJoinLink(link)
        else if (win) {
            if (win.isMinimized()) win.restore()
            win.focus()
        }
    })
    // macOS: jewel:// links
    app.on("open-url", (e, url) => {
        e.preventDefault()
        deliverJoinLink(url)
    })

    if (process.defaultApp && process.argv[1]) {
        app.setAsDefaultProtocolClient(JOIN_SCHEME, process.execPath, [path.resolve(process.argv[1])])
    } else {
        app.setAsDefaultProtocolClient(JOIN_SCHEME)
    }

    app.whenReady().then(() => {
        ensureLibraryFolders()
        protocol.handle(SCHEME, handleAppRequest)

        // Only the permissions the app actually uses
        const allowed = new Set(["clipboard-read", "clipboard-sanitized-write", "fileSystem", "fullscreen"])
        session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)))

        ipcMain.handle("app:info", () => ({
            version: app.getVersion(),
            platform: process.platform,
            libraryFolder: libraryRoot(),
            packaged: app.isPackaged,
        }))
        ipcMain.handle("library:open", () => shell.openPath(libraryRoot()))
        ipcMain.handle("join:take", () => {
            const link = pendingJoinLink
            pendingJoinLink = null
            return link
        })
        ipcMain.handle("update:install", () => autoUpdater.quitAndInstall())
        ipcMain.handle("update:open-page", () => shell.openExternal(RELEASES_URL))
        ipcMain.handle("update:check", () => (app.isPackaged ? autoUpdater.checkForUpdates().then(() => true) : false))

        createWindow()
        setupUpdates()

        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow()
        })
    })

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") app.quit()
    })
}
