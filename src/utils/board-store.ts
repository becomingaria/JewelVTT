import { useEffect, useRef } from "react"

/*
 * Board persistence.
 *
 * Board state lives in several components (humbugs in HumbugManager, the
 * viewport in InfiniteWhiteboard, paint/style/spots in App, ...). Each owner
 * registers a named "slice" with useBoardSlice(); the store can then
 * snapshot the whole board (save file, autosave) or apply one (open file,
 * restore after refresh).
 *
 * Autosave goes to IndexedDB (boards embed images as data URLs, far beyond
 * localStorage's ~5 MB). It stays disabled until the startup restore has run,
 * so the empty initial board can never overwrite a saved one.
 */

export const BOARD_FILE_FORMAT = "jewel-vtt-board"
export const BOARD_FILE_VERSION = 1
export const BOARD_FILE_EXTENSION = ".jvtt.json"

export interface BoardFile {
    format: typeof BOARD_FILE_FORMAT
    version: number
    savedAt: string
    board: Record<string, unknown>
}

interface Slice {
    get: () => unknown
    /** Receives undefined when the file has no data for this slice */
    set: (value: unknown) => void
}

const slices = new Map<string, Slice>()

/**
 * Register a slice of board state. `value` is serialised as-is, so convert
 * Maps etc. with the optional `serialize` / `deserialize`.
 */
export function useBoardSlice<T, S = T>(
    key: string,
    value: T,
    apply: (value: T | undefined) => void,
    options: {
        serialize?: (value: T) => S
        deserialize?: (stored: S) => T
        /** Changes to this slice don't trigger an autosave on their own */
        quiet?: boolean
    } = {}
) {
    const latest = useRef({ value, apply, options })
    useEffect(() => {
        latest.current = { value, apply, options }
    })

    useEffect(() => {
        const slice: Slice = {
            get: () => {
                const { value, options } = latest.current
                return options.serialize ? options.serialize(value) : value
            },
            set: (stored) => {
                const { apply, options } = latest.current
                if (stored === undefined) return apply(undefined)
                apply(
                    options.deserialize
                        ? options.deserialize(stored as S)
                        : (stored as T)
                )
            },
        }
        slices.set(key, slice)
        return () => {
            if (slices.get(key) === slice) slices.delete(key)
        }
    }, [key])

    useEffect(() => {
        if (!options.quiet) markBoardDirty()
    }, [value, options.quiet])
}

export function snapshotBoard(): BoardFile {
    const board: Record<string, unknown> = {}
    for (const [key, slice] of slices) board[key] = slice.get()
    return {
        format: BOARD_FILE_FORMAT,
        version: BOARD_FILE_VERSION,
        savedAt: new Date().toISOString(),
        board,
    }
}

export function applyBoard(file: BoardFile) {
    for (const [key, slice] of slices) slice.set(file.board[key])
    window.dispatchEvent(new CustomEvent("jewel:boardLoaded"))
}

export function parseBoardFile(text: string): BoardFile {
    let data: unknown
    try {
        data = JSON.parse(text)
    } catch {
        throw new Error("This file isn't valid JSON.")
    }
    const file = data as Partial<BoardFile>
    if (file?.format !== BOARD_FILE_FORMAT || typeof file.board !== "object") {
        throw new Error("This isn't a Jewel VTT board file.")
    }
    if ((file.version ?? 0) > BOARD_FILE_VERSION) {
        throw new Error("This board was saved by a newer version of Jewel VTT.")
    }
    return file as BoardFile
}

// ------------------------------------------------------------- save / open
export function saveBoardToFile(name = "jewel-board") {
    const file = snapshotBoard()
    const blob = new Blob([JSON.stringify(file)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")
    a.href = url
    a.download = `${name}-${stamp}${BOARD_FILE_EXTENSION}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Ask the user for a board file and load it. Resolves false if cancelled. */
export function openBoardFromFile(): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = `${BOARD_FILE_EXTENSION},.json,application/json`
        input.onchange = async () => {
            const picked = input.files?.[0]
            if (!picked) return resolve(false)
            try {
                applyBoard(parseBoardFile(await picked.text()))
                resolve(true)
            } catch (error) {
                reject(error)
            }
        }
        input.addEventListener("cancel", () => resolve(false))
        input.click()
    })
}

// ---------------------------------------------------------------- autosave
const DB_NAME = "jewel-vtt"
const STORE = "autosave"
const AUTOSAVE_KEY = "current"
const AUTOSAVE_DELAY_MS = 800

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => req.result.createObjectStore(STORE)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

async function idb<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = run(tx.objectStore(STORE))
        tx.oncomplete = () => {
            db.close()
            resolve(req.result)
        }
        tx.onerror = () => {
            db.close()
            reject(tx.error)
        }
    })
}

let autosaveEnabled = false
let autosaveTimer: number | undefined
let lastSavedJson = ""

export type AutosaveStatus = "idle" | "saving" | "saved" | "error"
const statusListeners = new Set<(s: AutosaveStatus) => void>()
const setStatus = (s: AutosaveStatus) => statusListeners.forEach((l) => l(s))
export function onAutosaveStatus(listener: (s: AutosaveStatus) => void) {
    statusListeners.add(listener)
    return () => {
        statusListeners.delete(listener)
    }
}

async function writeAutosave() {
    autosaveTimer = undefined
    const file = snapshotBoard()
    const json = JSON.stringify(file.board)
    if (json === lastSavedJson) return
    setStatus("saving")
    try {
        await idb("readwrite", (s) => s.put(file, AUTOSAVE_KEY))
        lastSavedJson = json
        setStatus("saved")
    } catch (error) {
        console.error("Autosave failed:", error)
        setStatus("error")
    }
}

export function markBoardDirty() {
    if (!autosaveEnabled) return
    window.clearTimeout(autosaveTimer)
    autosaveTimer = window.setTimeout(writeAutosave, AUTOSAVE_DELAY_MS)
}

/** Save immediately if a save is pending (e.g. the tab is being hidden) */
export function flushAutosave() {
    if (autosaveTimer !== undefined) {
        window.clearTimeout(autosaveTimer)
        void writeAutosave()
    }
}

/**
 * Restore the autosaved board (if any), then start autosaving.
 * Returns true when a board was restored.
 */
let restorePromise: Promise<boolean> | null = null

export function restoreAutosaveAndStart(): Promise<boolean> {
    restorePromise ??= restoreAndStart()
    return restorePromise
}

async function restoreAndStart(): Promise<boolean> {
    let restored = false
    try {
        const saved = await idb<BoardFile | undefined>("readonly", (s) =>
            s.get(AUTOSAVE_KEY)
        )
        if (saved?.format === BOARD_FILE_FORMAT && saved.board) {
            applyBoard(saved)
            lastSavedJson = JSON.stringify(saved.board)
            restored = true
        }
    } catch (error) {
        console.error("Couldn't read autosave:", error)
    }
    autosaveEnabled = true
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushAutosave()
    })
    window.addEventListener("pagehide", flushAutosave)
    return restored
}
