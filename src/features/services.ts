import type { Cell } from "./grid"
import { createStore, useStore } from "./store"

/*
 * Cross-feature services. Each is a small facade: one feature registers the
 * real implementation, any feature may call it. Calls before registration
 * fall back to something sensible (or do nothing), so features never depend
 * on each other being present.
 */

// ------------------------------------------------------------ session log
/** Owned by the dice feature (panel, saving, journal export) */
export interface LogEntry {
    id: string
    /** epoch ms */
    at: number
    kind: "roll" | "table" | "turn" | "travel" | "weather" | "encounter" | "note" | "scene" | "system"
    text: string
    detail?: string
}

export const logStore = createStore<LogEntry[]>([])
export const useLog = () => useStore(logStore)

export function logEvent(e: Omit<LogEntry, "id" | "at">) {
    const entry: LogEntry = {
        ...e,
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        at: Date.now(),
    }
    logStore.set((prev) => [...prev, entry].slice(-2000))
}

// ------------------------------------------------------------------ dice
/** Owned by the dice feature, which shows the result, plays sound and logs */
export interface DiceResult {
    expression: string
    total: number
    /** Every die rolled, in order */
    rolls: { sides: number; value: number; dropped?: boolean }[]
    /** Natural max / min on a single d20 */
    crit?: boolean
    fumble?: boolean
}

export interface RollOptions {
    /** What the roll is for, e.g. "Wandering monster check" */
    label?: string
    /** Show it in the dice tray / on the board (default true) */
    show?: boolean
    /** Add to the session log (default true) */
    log?: boolean
}

type DiceEngine = (expression: string, opts: RollOptions) => DiceResult

let diceEngine: DiceEngine | null = null
export function registerDiceEngine(e: DiceEngine) {
    diceEngine = e
}

/** Basic NdM±K roller used until the dice feature registers its own */
function basicRoll(expression: string): DiceResult {
    const m = expression.replace(/\s+/g, "").match(/^(\d*)d(\d+)([+-]\d+)?$/i)
    if (!m) return { expression, total: 0, rolls: [] }
    const n = Number(m[1] || 1)
    const sides = Number(m[2])
    const rolls = Array.from({ length: n }, () => ({
        sides,
        value: 1 + Math.floor(Math.random() * sides),
    }))
    const total = rolls.reduce((s, r) => s + r.value, 0) + Number(m[3] || 0)
    return { expression, total, rolls }
}

/** Roll dice from any feature, e.g. rollDice("1d6", { label: "Encounter check" }) */
export function rollDice(expression: string, opts: RollOptions = {}): DiceResult {
    if (diceEngine) return diceEngine(expression, opts)
    const r = basicRoll(expression)
    if (opts.log !== false) {
        logEvent({ kind: "roll", text: `${opts.label ? opts.label + ": " : ""}${expression} = ${r.total}` })
    }
    return r
}

// ------------------------------------------------------------------- fog
/** Owned by the fog-light feature. Cells use the board's current grid. */
interface FogApi {
    reveal: (cells: Cell[]) => void
    hide: (cells: Cell[]) => void
    isRevealed: (cell: Cell) => boolean
    /** Fog is in use on this board */
    enabled: () => boolean
}

let fogApi: FogApi | null = null
export function registerFogApi(api: FogApi) {
    fogApi = api
}

export const fog = {
    reveal: (cells: Cell[]) => fogApi?.reveal(cells),
    hide: (cells: Cell[]) => fogApi?.hide(cells),
    isRevealed: (cell: Cell) => fogApi?.isRevealed(cell) ?? true,
    enabled: () => fogApi?.enabled() ?? false,
}

// ----------------------------------------------------------------- sight
/**
 * Walls that block line of sight, contributed by features (the dungeon
 * floor's walls, for one). Owned by the fog-light feature, which reads
 * them for vision and light. World units.
 */
export interface SightSegment {
    x1: number
    y1: number
    x2: number
    y2: number
}

export interface SightSource {
    segments: () => readonly SightSegment[]
    /**
     * Cells to show beside what a token can see (the wall itself, so the
     * edge of a room is drawn). Optional.
     */
    besides?: (visible: ReadonlySet<string>) => Iterable<string>
    /** Call back whenever the segments change; returns an unsubscribe */
    subscribe: (onChange: () => void) => () => void
}

const sightSources = new Map<string, { source: SightSource; off: () => void }>()
/** Bumps whenever any source's walls change */
export const sightVersionStore = createStore(0)
const bumpSight = () => sightVersionStore.set((n) => n + 1)

export function registerSightSource(id: string, source: SightSource) {
    sightSources.get(id)?.off()
    sightSources.set(id, { source, off: source.subscribe(bumpSight) })
    bumpSight()
}

export const sightSourceList = (): SightSource[] => [...sightSources.values()].map((s) => s.source)
