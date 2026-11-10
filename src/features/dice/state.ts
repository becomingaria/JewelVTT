import { createPersistentStore, createStore, type Store } from "../store"
import { pointerWorldStore, viewCentreWorld } from "../board-bridge"
import type { Point } from "../../types/humbug.types"
import type { DieRoll } from "./notation"

/*
 * Shared state for the dice feature: panels, the tray's result and history,
 * the quick-roll bubble and the dice currently lying on the board.
 */

// ---------------------------------------------------------------- panels
export type PanelId = "tray" | "tables" | "log" | "audit"

export interface PanelLayout {
    collapsed: boolean
    /** Custom position (px from the top-left); null = docked default */
    pos: { x: number; y: number } | null
}

function readJson<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key)
        return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
    } catch {
        return fallback
    }
}

function writeJson(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch {
        /* storage unavailable */
    }
}

const OPEN_KEY = "jewel:dice:open"
const savedOpen = readJson<Record<PanelId, boolean>>(OPEN_KEY, { tray: false, tables: false, log: false, audit: false })

function openStore(id: PanelId): Store<boolean> {
    const s = createStore<boolean>(!!savedOpen[id])
    s.subscribe(() => {
        savedOpen[id] = s.get()
        writeJson(OPEN_KEY, savedOpen)
    })
    return s
}

/** Open/closed per panel (drives the dock buttons' aria-pressed) */
export const panelOpen: Record<PanelId, Store<boolean>> = {
    tray: openStore("tray"),
    tables: openStore("tables"),
    log: openStore("log"),
    audit: openStore("audit"),
}

export const togglePanel = (id: PanelId) => panelOpen[id].set((v) => !v)

export const panelLayout: Record<PanelId, Store<PanelLayout>> = {
    tray: createPersistentStore<PanelLayout>("jewel:dice:panel:tray", { collapsed: false, pos: null }),
    tables: createPersistentStore<PanelLayout>("jewel:dice:panel:tables", { collapsed: false, pos: null }),
    log: createPersistentStore<PanelLayout>("jewel:dice:panel:log", { collapsed: false, pos: null }),
    audit: createPersistentStore<PanelLayout>("jewel:dice:panel:audit", { collapsed: false, pos: null }),
}

/** Per-viewer dice settings */
export const diceSettings = createPersistentStore("jewel:dice:settings", {
    /** Roll onto the board as pixel dice sprites */
    boardDice: false,
})

// ---------------------------------------------------------------- results
export interface RollRecord {
    id: string
    at: number
    label?: string
    expression: string
    total: number
    dice: DieRoll[]
    /** Plain-text breakdown, e.g. "4d6kh3 (6, 5, 3, dropped 1) + 2" */
    breakdown: string
    crit?: boolean
    fumble?: boolean
    /** Set when this was a table roll */
    table?: { id: string; name: string; text: string }
    /** Set when the expression couldn't be read */
    error?: string
}

let seq = 0
export const recordId = () => `roll_${Date.now().toString(36)}_${seq++}`

export const trayStore = createStore<{ last: RollRecord | null; history: RollRecord[] }>({
    last: null,
    history: [],
})

/** Compact result shown near the dock (Shift+R, or when the tray is closed) */
export const bubbleStore = createStore<RollRecord | null>(null)

/** Screen-reader announcement for rolls shown only on the board */
export const announceStore = createStore<{ id: string; text: string } | null>(null)

export function isTrayVisible() {
    return panelOpen.tray.get() && !panelLayout.tray.get().collapsed
}

/** Short text used for announcements and bubbles */
export function summarize(r: RollRecord): string {
    if (r.error) return `Couldn't roll ${r.expression}: ${r.error}`
    const label = r.label ? `${r.label}: ` : ""
    if (r.table) return `${label}${r.table.name}: ${r.table.text}`
    const flag = r.crit ? " Critical!" : r.fumble ? " Fumble!" : ""
    return `${label}${r.expression} = ${r.total}.${flag}`
}

/**
 * Show a roll: always in the tray (result + history). On the board when
 * "Roll onto the board" is on; otherwise as a bubble if the tray is hidden.
 */
export function presentRecord(rec: RollRecord, opts: { bubble?: boolean } = {}) {
    trayStore.set((s) => ({
        last: rec,
        history: rec.error ? s.history : [rec, ...s.history].slice(0, 12),
    }))
    const onBoard = !rec.error && diceSettings.get().boardDice && rec.dice.length > 0
    if (onBoard) spawnBoardDice(rec)
    if (opts.bubble || (!onBoard && !isTrayVisible())) bubbleStore.set(rec)
    else if (onBoard && !isTrayVisible()) announceStore.set({ id: rec.id, text: summarize(rec) })
}

// ------------------------------------------------------------ board dice
export interface BoardDiceGroup {
    id: string
    born: number
    /** Groups landing on the same spot are set side by side */
    slot: number
    /** World position the dice land around */
    origin: Point
    dice: DieRoll[]
    record: RollRecord
}

export const BOARD_DICE_LIFETIME = 6000
const MAX_GROUPS = 4
/** Sprites per group; the rest are summarised in the banner */
export const MAX_SPRITES = 12

export const boardDiceStore = createStore<BoardDiceGroup[]>([])

function spawnBoardDice(rec: RollRecord) {
    const origin = pointerWorldStore.get() ?? viewCentreWorld()
    const near = boardDiceStore
        .get()
        .filter((g) => Math.hypot(g.origin.x - origin.x, g.origin.y - origin.y) < 8)
        .map((g) => g.slot)
    let slot = 0
    while (near.includes(slot)) slot++
    const group: BoardDiceGroup = {
        id: rec.id,
        born: Date.now(),
        slot,
        origin: { x: origin.x, y: origin.y },
        dice: rec.dice,
        record: rec,
    }
    boardDiceStore.set((gs) => [...gs, group].slice(-MAX_GROUPS))
    setTimeout(() => boardDiceStore.set((gs) => gs.filter((g) => g.id !== group.id)), BOARD_DICE_LIFETIME)
}

export const clearBoardDice = () => boardDiceStore.set([])
