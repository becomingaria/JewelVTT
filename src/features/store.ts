import { useSyncExternalStore } from "react"

/*
 * Tiny external store. Features share state through these instead of
 * threading props through App / HumbugManager, so each feature can live in
 * its own folder.
 */

export interface Store<T> {
    get: () => T
    set: (next: T | ((prev: T) => T)) => void
    subscribe: (listener: () => void) => () => void
}

export function createStore<T>(initial: T): Store<T> {
    let value = initial
    const listeners = new Set<() => void>()
    return {
        get: () => value,
        set: (next) => {
            const v = typeof next === "function" ? (next as (p: T) => T)(value) : next
            if (Object.is(v, value)) return
            value = v
            listeners.forEach((l) => l())
        },
        subscribe: (l) => {
            listeners.add(l)
            return () => listeners.delete(l)
        },
    }
}

export function useStore<T>(store: Store<T>): T {
    return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/**
 * A store backed by localStorage (per-viewer conveniences only). Storage can
 * be missing or throw (private windows, blocked site data), so every access
 * is guarded and the store still works in memory.
 */
export function createPersistentStore<T extends object>(key: string, defaults: T): Store<T> {
    let initial = defaults
    try {
        const raw = localStorage.getItem(key)
        if (raw) initial = { ...defaults, ...JSON.parse(raw) }
    } catch {
        /* storage unavailable: use defaults */
    }
    const store = createStore<T>(initial)
    store.subscribe(() => {
        try {
            localStorage.setItem(key, JSON.stringify(store.get()))
        } catch {
            /* ignore */
        }
    })
    return store
}
