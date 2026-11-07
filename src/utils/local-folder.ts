import { STORES, idbDelete, idbGet, idbSet } from "./idb"
import { BOARD_FILE_EXTENSION } from "./board-store"

/*
 * A "local folder" the user picks once, where boards are saved and opened.
 *
 * Uses the File System Access API (Chrome, Edge, Brave, Opera). The folder
 * handle is remembered in IndexedDB; browsers may ask for permission again
 * in a new session, which needs a click or key press, so every operation
 * re-checks permission when the user acts.
 */

// Not yet in TypeScript's DOM types
type PermissionMode = { mode: "read" | "readwrite" }
interface PermissionedHandle {
    queryPermission?: (d: PermissionMode) => Promise<PermissionState>
    requestPermission?: (d: PermissionMode) => Promise<PermissionState>
}
type DirectoryPicker = (options?: {
    id?: string
    mode?: "read" | "readwrite"
}) => Promise<FileSystemDirectoryHandle>

const HANDLE_KEY = "localFolder"

export const isLocalFolderSupported = () =>
    typeof window !== "undefined" && "showDirectoryPicker" in window

export interface BoardEntry {
    /** File name in the folder, e.g. "Dragon Lair.jvtt.json" */
    fileName: string
    /** Display name without the extension */
    name: string
    lastModified: number
}

export const boardNameOf = (fileName: string) =>
    fileName.replace(/\.jvtt\.json$/i, "").replace(/\.json$/i, "")

/** Make a board name safe to use as a file name */
export function fileNameFor(name: string) {
    const clean = name
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80)
    return `${clean || "Untitled board"}${BOARD_FILE_EXTENSION}`
}

export async function getSavedFolder(): Promise<FileSystemDirectoryHandle | null> {
    try {
        return (await idbGet<FileSystemDirectoryHandle>(STORES.settings, HANDLE_KEY)) ?? null
    } catch {
        return null
    }
}

/** Ask the user to pick a folder (must be called from a click/key press) */
export async function chooseFolder(): Promise<FileSystemDirectoryHandle | null> {
    const picker = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker
    if (!picker) return null
    try {
        const handle = await picker({ id: "jewel-vtt", mode: "readwrite" })
        await idbSet(STORES.settings, HANDLE_KEY, handle)
        return handle
    } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return null // cancelled
        throw error
    }
}

export async function forgetFolder() {
    await idbDelete(STORES.settings, HANDLE_KEY)
}

export async function folderPermission(
    handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
    const h = handle as unknown as PermissionedHandle
    return h.queryPermission ? h.queryPermission({ mode: "readwrite" }) : "granted"
}

/** Make sure we may read and write; may show the browser's prompt */
export async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    const h = handle as unknown as PermissionedHandle
    if ((await folderPermission(handle)) === "granted") return true
    if (!h.requestPermission) return false
    return (await h.requestPermission({ mode: "readwrite" })) === "granted"
}

/** Board files in the folder, newest first */
export async function listBoards(handle: FileSystemDirectoryHandle): Promise<BoardEntry[]> {
    const out: BoardEntry[] = []
    const entries = (handle as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()
    for await (const entry of entries) {
        if (entry.kind !== "file") continue
        if (!/\.jvtt\.json$/i.test(entry.name)) continue
        const file = await (entry as FileSystemFileHandle).getFile()
        out.push({ fileName: entry.name, name: boardNameOf(entry.name), lastModified: file.lastModified })
    }
    return out.sort((a, b) => b.lastModified - a.lastModified)
}

export async function fileExists(handle: FileSystemDirectoryHandle, fileName: string) {
    try {
        await handle.getFileHandle(fileName)
        return true
    } catch {
        return false
    }
}

export async function readBoardText(handle: FileSystemDirectoryHandle, fileName: string) {
    const file = await (await handle.getFileHandle(fileName)).getFile()
    return file.text()
}

export async function writeBoardText(
    handle: FileSystemDirectoryHandle,
    fileName: string,
    text: string
) {
    const fileHandle = await handle.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(text)
    await writable.close()
}
