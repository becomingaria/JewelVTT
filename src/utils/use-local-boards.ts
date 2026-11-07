import { useCallback, useEffect, useRef, useState } from "react"
import {
    applyBoardSlices,
    boardFileText,
    currentBoardJson,
    onAutosaveStatus,
    parseBoardFile,
    restoreAutosaveAndStart,
    saveBoardToFile,
    snapshotBoard,
} from "./board-store"
import {
    boardNameOf,
    chooseFolder,
    ensurePermission,
    fileExists,
    fileNameFor,
    folderPermission,
    forgetFolder,
    getSavedFolder,
    isLocalFolderSupported,
    listBoards,
    readBoardText,
    writeBoardText,
    type BoardEntry,
} from "./local-folder"
import { STORES, idbGet, idbSet } from "./idb"
import { showToast } from "./toast"

/*
 * Local folder + prepared scenes.
 *
 * Scenes are boards open as top-bar tabs. The active scene is the live board
 * (and is what autosave keeps); the others wait in memory as board
 * snapshots. Switching tabs swaps them instantly. Changes are only written
 * to a scene's file when the user saves, like editor tabs.
 */

export interface Scene {
    id: string
    name: string
    /** File in the local folder, if this scene came from / was saved to one */
    fileName?: string
    /** Snapshot while inactive (null for the active, live scene) */
    board: Record<string, unknown> | null
    /** Board JSON as last loaded/saved, to spot unsaved changes */
    savedJson: string
    dirty: boolean
}

export type BoardDialog =
    | { kind: "save"; suggestedName: string }
    | { kind: "open"; boards: BoardEntry[] }
    | { kind: "scenes"; boards: BoardEntry[] }
    | null

const SCENES_KEY = "scenes"
const newId = () => `scene_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

/** A board with nothing on it isn't worth keeping as its own tab */
function isEmptyBoard(board: Record<string, unknown>) {
    const len = (v: unknown) =>
        Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0
    return ["humbugs", "spots", "scribbles", "paintGrid", "connectors"].every((k) => len(board[k]) === 0)
}

export function useLocalBoards() {
    const supported = isLocalFolderSupported()
    const [folder, setFolder] = useState<FileSystemDirectoryHandle | null>(null)
    const [permission, setPermission] = useState<PermissionState | null>(null)
    const [scenes, setScenes] = useState<Scene[]>([])
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null)
    const [dialog, setDialog] = useState<BoardDialog>(null)
    const [ready, setReady] = useState(false)

    const scenesRef = useRef(scenes)
    const activeRef = useRef(activeSceneId)
    useEffect(() => {
        scenesRef.current = scenes
        activeRef.current = activeSceneId
    })

    // ---- startup: restore the board, the remembered folder and the scenes
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const restored = await restoreAutosaveAndStart()
            // React's dev mode runs this effect twice; only the live run greets
            if (cancelled) return
            if (restored) showToast("Welcome back — your board was restored")
            const saved = await getSavedFolder()
            const stored = await idbGet<{ scenes: Scene[]; activeSceneId: string | null }>(
                STORES.settings,
                SCENES_KEY
            ).catch(() => undefined)
            if (cancelled) return
            if (saved) {
                setFolder(saved)
                setPermission(await folderPermission(saved).catch(() => "prompt" as PermissionState))
            }
            if (stored?.scenes?.length) {
                setScenes(stored.scenes)
                setActiveSceneId(stored.activeSceneId)
            }
            setReady(true)
        })()
        return () => {
            cancelled = true
        }
    }, [])

    // ---- remember scenes across refreshes (inactive ones hold snapshots)
    useEffect(() => {
        if (!ready) return
        const t = window.setTimeout(() => {
            idbSet(STORES.settings, SCENES_KEY, { scenes, activeSceneId }).catch(() => {})
        }, 400)
        return () => window.clearTimeout(t)
    }, [scenes, activeSceneId, ready])

    // ---- unsaved-changes dot: re-check whenever autosave writes
    useEffect(
        () =>
            onAutosaveStatus((status) => {
                if (status !== "saved") return
                const id = activeRef.current
                if (!id) return
                const json = currentBoardJson()
                setScenes((prev) =>
                    prev.map((s) =>
                        s.id === id ? { ...s, dirty: s.fileName ? json !== s.savedJson : !isEmptyBoard(JSON.parse(json)) } : s
                    )
                )
            }),
        []
    )

    /** After loading a board, record its normalised JSON as "saved" */
    const captureBaseline = (id: string) =>
        window.setTimeout(() => {
            const json = currentBoardJson()
            setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, savedJson: json, dirty: false } : s)))
        }, 150)

    // ---- folder
    const pickFolder = useCallback(async () => {
        try {
            const handle = await chooseFolder()
            if (!handle) return
            setFolder(handle)
            setPermission("granted")
            showToast(`Boards will be saved in “${handle.name}”`)
        } catch (error) {
            showToast(`Couldn't use that folder: ${(error as Error).message}`, "error")
        }
    }, [])

    const clearFolder = useCallback(async () => {
        await forgetFolder()
        setFolder(null)
        setPermission(null)
        showToast("Local folder forgotten. Saving downloads files again.")
    }, [])

    /** Folder with permission, asking if needed (call from a click / key) */
    const usableFolder = useCallback(async () => {
        if (!folder) return null
        try {
            const ok = await ensurePermission(folder)
            setPermission(ok ? "granted" : "denied")
            if (!ok) showToast(`Jewel VTT needs permission to use “${folder.name}”.`, "error")
            return ok ? folder : null
        } catch (error) {
            showToast(`Couldn't open “${folder.name}”: ${(error as Error).message}`, "error")
            return null
        }
    }, [folder])

    // ---- scenes
    const switchScene = useCallback((id: string) => {
        const list = scenesRef.current
        const current = activeRef.current
        const target = list.find((s) => s.id === id)
        if (!target || id === current) return
        const snapshot = snapshotBoard().board
        setScenes((prev) =>
            prev.map((s) => {
                if (s.id === current) return { ...s, board: snapshot }
                if (s.id === id) return { ...s, board: null }
                return s
            })
        )
        setActiveSceneId(id)
        if (target.board) applyBoardSlices(target.board)
        // keep the target's own dirty state; only refresh the baseline for clean files
        if (!target.dirty) captureBaseline(id)
    }, [])

    /** Turn the current (tab-less) board into a scene before adding others */
    const ensureCurrentIsScene = (prev: Scene[], fallbackName = "Current board"): Scene[] => {
        if (prev.length || isEmptyBoard(snapshotBoard().board)) return prev
        const id = newId()
        activeRef.current = id
        setActiveSceneId(id)
        return [{ id, name: fallbackName, board: null, savedJson: "", dirty: true }]
    }

    const addScenesFromFolder = useCallback(
        async (fileNames: string[]) => {
            const dir = await usableFolder()
            if (!dir || !fileNames.length) return
            const loaded: Scene[] = []
            for (const fileName of fileNames) {
                try {
                    const file = parseBoardFile(await readBoardText(dir, fileName))
                    loaded.push({
                        id: newId(),
                        name: boardNameOf(fileName),
                        fileName,
                        board: file.board,
                        savedJson: JSON.stringify(file.board),
                        dirty: false,
                    })
                } catch (error) {
                    showToast(`Skipped “${fileName}”: ${(error as Error).message}`, "error")
                }
            }
            if (!loaded.length) return
            let switchTo: string | null = null
            setScenes((prev) => {
                const base = ensureCurrentIsScene(prev)
                if (!base.length) switchTo = loaded[0].id // nothing open yet: show the first
                return [...base, ...loaded]
            })
            setDialog(null)
            // Wait for state, then switch if there was nothing to keep
            window.setTimeout(() => {
                if (switchTo) {
                    const first = loaded[0]
                    activeRef.current = first.id
                    setActiveSceneId(first.id)
                    setScenes((prev) => prev.map((s) => (s.id === first.id ? { ...s, board: null } : s)))
                    applyBoardSlices(first.board!)
                    captureBaseline(first.id)
                }
            }, 0)
            showToast(
                loaded.length === 1
                    ? `Added scene “${loaded[0].name}”`
                    : `Added ${loaded.length} scenes. Click a tab to switch.`
            )
        },
        [usableFolder]
    )

    const openFromFolder = useCallback(
        async (fileName: string) => {
            const existing = scenesRef.current.find((s) => s.fileName === fileName)
            if (existing) {
                switchScene(existing.id)
                setDialog(null)
                return
            }
            await addScenesFromFolder([fileName])
            // switch to the newly added tab
            window.setTimeout(() => {
                const added = scenesRef.current.find((s) => s.fileName === fileName)
                if (added) switchScene(added.id)
            }, 30)
        },
        [addScenesFromFolder, switchScene]
    )

    const closeScene = useCallback(
        (id: string) => {
            const list = scenesRef.current
            const idx = list.findIndex((s) => s.id === id)
            if (idx === -1) return
            if (id === activeRef.current && list.length > 1) {
                const next = list[idx + 1] ?? list[idx - 1]
                switchScene(next.id)
            }
            window.setTimeout(() => {
                setScenes((prev) => prev.filter((s) => s.id !== id))
                if (activeRef.current === id) setActiveSceneId(null)
            }, 0)
        },
        [switchScene]
    )

    // ---- save / open
    const writeActive = async (dir: FileSystemDirectoryHandle, fileName: string, name: string) => {
        await writeBoardText(dir, fileName, boardFileText())
        const json = currentBoardJson()
        const id = activeRef.current
        if (id) {
            setScenes((prev) =>
                prev.map((s) => (s.id === id ? { ...s, fileName, name, savedJson: json, dirty: false } : s))
            )
        } else {
            // first save of a tab-less board: it becomes a scene linked to its file
            const sid = newId()
            activeRef.current = sid
            setActiveSceneId(sid)
            setScenes([{ id: sid, name, fileName, board: null, savedJson: json, dirty: false }])
        }
        showToast(`Saved “${name}” to ${dir.name}`)
    }

    const saveBoard = useCallback(async () => {
        const active = scenesRef.current.find((s) => s.id === activeRef.current)
        if (!supported || !folder) {
            saveBoardToFile(active?.name ?? "jewel-board")
            showToast("Board saved to your downloads")
            return
        }
        const dir = await usableFolder()
        if (!dir) return
        if (active?.fileName) {
            try {
                await writeActive(dir, active.fileName, active.name)
            } catch (error) {
                showToast(`Couldn't save: ${(error as Error).message}`, "error")
            }
            return
        }
        setDialog({ kind: "save", suggestedName: active?.name && active.name !== "Current board" ? active.name : "" })
    }, [supported, folder, usableFolder])

    /** From the Save dialog. Returns false if the name is taken and not confirmed. */
    const saveAs = useCallback(
        async (name: string, replace: boolean): Promise<"saved" | "exists" | "failed"> => {
            const dir = await usableFolder()
            if (!dir) return "failed"
            const fileName = fileNameFor(name)
            if (!replace && (await fileExists(dir, fileName))) return "exists"
            try {
                await writeActive(dir, fileName, boardNameOf(fileName))
                setDialog(null)
                return "saved"
            } catch (error) {
                showToast(`Couldn't save: ${(error as Error).message}`, "error")
                return "failed"
            }
        },
        [usableFolder]
    )

    const showFolderList = useCallback(
        async (kind: "open" | "scenes") => {
            const dir = await usableFolder()
            if (!dir) return
            try {
                setDialog({ kind, boards: await listBoards(dir) })
            } catch (error) {
                showToast(`Couldn't read “${dir.name}”: ${(error as Error).message}`, "error")
            }
        },
        [usableFolder]
    )

    /** New Board: with scenes open, it gets its own "Untitled" tab */
    const startNewSceneIfNeeded = useCallback(() => {
        if (!scenesRef.current.length) return
        const snapshot = snapshotBoard().board
        const current = activeRef.current
        const id = newId()
        setScenes((prev) => [
            ...prev.map((s) => (s.id === current ? { ...s, board: snapshot } : s)),
            { id, name: "Untitled board", board: null, savedJson: "", dirty: false },
        ])
        activeRef.current = id
        setActiveSceneId(id)
    }, [])

    return {
        supported,
        folder,
        permission,
        scenes,
        activeSceneId,
        dialog,
        setDialog,
        pickFolder,
        clearFolder,
        saveBoard,
        saveAs,
        openBoard: () => (folder && supported ? showFolderList("open") : null),
        showPreparedScenes: () => showFolderList("scenes"),
        openFromFolder,
        addScenesFromFolder,
        switchScene,
        closeScene,
        startNewSceneIfNeeded,
    }
}
