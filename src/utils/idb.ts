/*
 * Tiny IndexedDB helper shared by autosave, scenes and the local folder.
 * One database ("jewel-vtt"), one key-value store per purpose.
 */

const DB_NAME = "jewel-vtt"
const DB_VERSION = 2
export const STORES = {
    autosave: "autosave",
    settings: "settings",
} as const
type StoreName = (typeof STORES)[keyof typeof STORES]

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = () => {
            const db = req.result
            for (const name of Object.values(STORES)) {
                if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
            }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

export async function idb<T>(
    store: StoreName,
    mode: IDBTransactionMode,
    run: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const req = run(tx.objectStore(store))
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

export const idbGet = <T>(store: StoreName, key: string) =>
    idb<T | undefined>(store, "readonly", (s) => s.get(key))
export const idbSet = (store: StoreName, key: string, value: unknown) =>
    idb(store, "readwrite", (s) => s.put(value, key))
export const idbDelete = (store: StoreName, key: string) =>
    idb(store, "readwrite", (s) => s.delete(key))
