import { createStore } from "../store"
import { pushUndo } from "../board-bridge"
import { STORES, idbGet, idbSet } from "../../utils/idb"
import { STARTER_TABLES } from "./starter-tables"
import { exportTables, importTables, mergeTables, sanitizeTable, type RandomTable } from "./tables-core"
import { downloadText } from "./download"

/*
 * The viewer's table library, kept in IndexedDB (the shared "settings" key-
 * value store, key "dice:tables"). Not saved with boards: tables are the
 * GM's own toolkit, used across every board.
 */

const KEY = "dice:tables"

/** null while loading */
export const tablesStore = createStore<RandomTable[] | null>(null)

let loadStarted = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

export function loadTables() {
    if (loadStarted) return
    loadStarted = true
    const fallback = () => tablesStore.set(STARTER_TABLES.map((t) => ({ ...t })))
    try {
        idbGet<unknown>(STORES.settings, KEY)
            .then((stored) => {
                if (!Array.isArray(stored)) return fallback()
                tablesStore.set(stored.map(sanitizeTable).filter((t): t is RandomTable => !!t))
            })
            .catch(fallback)
    } catch {
        fallback()
    }
    tablesStore.subscribe(() => {
        const list = tablesStore.get()
        if (!list) return
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
            try {
                idbSet(STORES.settings, KEY, list).catch(() => {})
            } catch {
                /* IndexedDB unavailable: the library lives in memory only */
            }
        }, 300)
    })
}

const list = () => tablesStore.get() ?? []

export function saveTable(table: RandomTable) {
    const t = { ...table, updatedAt: Date.now() }
    const exists = list().some((x) => x.id === t.id)
    tablesStore.set(exists ? list().map((x) => (x.id === t.id ? t : x)) : [...list(), t])
}

/** Delete, with an undo step instead of a confirmation */
export function deleteTable(id: string) {
    const before = list()
    const index = before.findIndex((t) => t.id === id)
    if (index < 0) return
    const removed = before[index]
    tablesStore.set(before.filter((t) => t.id !== id))
    pushUndo({
        label: `Delete table “${removed.name}”`,
        undo: () =>
            tablesStore.set((cur) => {
                const l = cur ?? []
                if (l.some((t) => t.id === id)) return l
                const copy = [...l]
                copy.splice(Math.min(index, copy.length), 0, removed)
                return copy
            }),
        redo: () => tablesStore.set((cur) => (cur ?? []).filter((t) => t.id !== id)),
    })
}

/** Add any starter tables that are missing; returns how many came back */
export function restoreStarters(): number {
    const ids = new Set(list().map((t) => t.id))
    const missing = STARTER_TABLES.filter((t) => !ids.has(t.id))
    if (missing.length) tablesStore.set([...list(), ...missing.map((t) => ({ ...t }))])
    return missing.length
}

export function exportLibrary(tables: RandomTable[] = list(), filename = "jewel-tables.json") {
    downloadText(filename, exportTables(tables), "application/json")
}

/** Throws with a friendly message when the file has no usable tables */
export async function importFile(file: File): Promise<number> {
    const text = await file.text()
    const incoming = importTables(text)
    tablesStore.set(mergeTables(list(), incoming))
    return incoming.length
}
