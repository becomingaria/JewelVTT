/*
 * Pure rules for the tracker: initiative order, hit point bands, dungeon
 * turns and character generation. No React, no DOM, no board access, so
 * it can be checked on its own.
 */

// ------------------------------------------------------------ conditions
export interface ConditionDef {
    id: string
    label: string
    hint: string
}

export const CONDITIONS: ConditionDef[] = [
    { id: "poisoned", label: "Poisoned", hint: "Weakened by poison" },
    { id: "asleep", label: "Asleep", hint: "Unconscious until woken" },
    { id: "paralysed", label: "Paralysed", hint: "Cannot move or act" },
    { id: "charmed", label: "Charmed", hint: "Treats the charmer as a friend" },
    { id: "frightened", label: "Frightened", hint: "Will flee or cower" },
    { id: "prone", label: "Prone", hint: "Knocked to the ground" },
    { id: "blinded", label: "Blinded", hint: "Cannot see" },
    { id: "invisible", label: "Invisible", hint: "Cannot be seen" },
    { id: "cursed", label: "Cursed", hint: "Under a curse" },
    { id: "dead", label: "Dead", hint: "Out of the fight for good" },
]

export const conditionLabel = (id: string) =>
    CONDITIONS.find((c) => c.id === id)?.label ?? id

// ------------------------------------------------------------ hit points
export type HpBand = "healthy" | "wounded" | "critical" | "down"

export function hpBand(current: number, max: number): HpBand {
    if (current <= 0) return "down"
    const f = max > 0 ? current / max : 1
    if (f > 0.5) return "healthy"
    if (f > 0.25) return "wounded"
    return "critical"
}

export const HP_BAND_LABEL: Record<HpBand, string> = {
    healthy: "Healthy",
    wounded: "Wounded",
    critical: "Badly hurt",
    down: "Down",
}

/** New current HP after damage (negative delta) or healing, kept in 0..max */
export function applyHpDelta(hp: { current: number; max: number }, delta: number) {
    return { ...hp, current: Math.max(0, Math.min(hp.max, hp.current + delta)) }
}

/** New HP after changing the maximum: current never exceeds it */
export function setHpMax(hp: { current: number; max: number } | undefined, max: number) {
    const m = Math.max(1, Math.round(max))
    if (!hp) return { current: m, max: m }
    return { current: Math.min(hp.current, m), max: m }
}

// ------------------------------------------------------------ initiative
export type Side = "party" | "foe"

export interface Combatant {
    /** Humbug id of the token */
    id: string
    /** Last initiative roll (null = not rolled yet) */
    init: number | null
    /** Individual-initiative modifier */
    mod: number
}

export type InitMode = "side" | "individual"

export interface InitState {
    order: Combatant[]
    /** Index of the combatant whose turn it is; -1 = not started */
    active: number
    round: number
    mode: InitMode
    /** Individual mode: die size */
    die: 20 | 6
    /** Side mode: the last d6 per side */
    sideRolls: { party: number; foe: number } | null
    /** Side mode: roll again automatically at the start of every round */
    rerollEachRound: boolean
}

export const DEFAULT_INIT: InitState = {
    order: [],
    active: -1,
    round: 1,
    mode: "side",
    die: 20,
    sideRolls: null,
    rerollEachRound: false,
}

/** Defensive load of a saved slice (older or hand-edited files) */
export function normaliseInit(v: Partial<InitState> | undefined | null): InitState {
    if (!v || typeof v !== "object") return DEFAULT_INIT
    const order = Array.isArray(v.order)
        ? v.order
              .filter((c) => c && typeof c.id === "string")
              .map((c) => ({
                  id: c.id,
                  init: typeof c.init === "number" ? c.init : null,
                  mod: typeof c.mod === "number" ? c.mod : 0,
              }))
        : []
    const active = typeof v.active === "number" && v.active < order.length ? v.active : -1
    return {
        order,
        active,
        round: typeof v.round === "number" && v.round >= 1 ? Math.floor(v.round) : 1,
        mode: v.mode === "individual" ? "individual" : "side",
        die: v.die === 6 ? 6 : 20,
        sideRolls: v.sideRolls ?? null,
        rerollEachRound: !!v.rerollEachRound,
    }
}

/** Add tokens at the end of the order (ids already present are skipped) */
export function addCombatants(s: InitState, ids: string[]): InitState {
    const have = new Set(s.order.map((c) => c.id))
    const fresh = [...new Set(ids)].filter((id) => !have.has(id))
    if (!fresh.length) return s
    return { ...s, order: [...s.order, ...fresh.map((id) => ({ id, init: null, mod: 0 }))] }
}

/** Remove one combatant, keeping the turn on the same creature where possible */
export function removeCombatant(s: InitState, id: string): InitState {
    const i = s.order.findIndex((c) => c.id === id)
    if (i < 0) return s
    const order = s.order.filter((c) => c.id !== id)
    let active = s.active
    if (i < active) active -= 1
    // Removing the creature whose turn it is hands the turn to the next one
    else if (i === active) active = order.length ? Math.min(i, order.length - 1) : -1
    return { ...s, order, active }
}

/** Move a combatant from one index to another; the active creature stays active */
export function moveCombatant(s: InitState, from: number, to: number): InitState {
    if (from === to || from < 0 || from >= s.order.length) return s
    const target = Math.max(0, Math.min(s.order.length - 1, to))
    const activeId = s.order[s.active]?.id
    const order = [...s.order]
    const [c] = order.splice(from, 1)
    order.splice(target, 0, c)
    const active = activeId ? order.findIndex((o) => o.id === activeId) : -1
    return { ...s, order, active }
}

/**
 * Side initiative: the side with the higher d6 acts first. Ties go to the
 * party (and are announced as simultaneous). Order within a side is kept.
 */
export function orderBySide(
    s: InitState,
    rolls: { party: number; foe: number },
    sideOf: (id: string) => Side
): InitState {
    const partyFirst = rolls.party >= rolls.foe
    const party = s.order.filter((c) => sideOf(c.id) === "party")
    const foes = s.order.filter((c) => sideOf(c.id) === "foe")
    const withInit = (list: Combatant[], v: number) => list.map((c) => ({ ...c, init: v }))
    const order = partyFirst
        ? [...withInit(party, rolls.party), ...withInit(foes, rolls.foe)]
        : [...withInit(foes, rolls.foe), ...withInit(party, rolls.party)]
    return { ...s, order, sideRolls: rolls }
}

/** Individual initiative: highest first; ties keep their current order */
export function orderByRolls(s: InitState, totals: Record<string, number>): InitState {
    const order = s.order
        .map((c, i) => ({ c: { ...c, init: totals[c.id] ?? c.init }, i }))
        .sort((a, b) => (b.c.init ?? -99) - (a.c.init ?? -99) || a.i - b.i)
        .map((x) => x.c)
    return { ...s, order, sideRolls: null }
}

/** First index at or after `from` whose token still exists, or -1 */
export function firstPresent(s: InitState, from: number, exists: (id: string) => boolean): number {
    for (let i = Math.max(0, from); i < s.order.length; i++) if (exists(s.order[i].id)) return i
    return -1
}

/**
 * Advance one turn. Tokens that no longer exist (deleted, maybe to be
 * undone later) are skipped. Wrapping past the end starts the next round.
 */
export function advanceTurn(
    s: InitState,
    exists: (id: string) => boolean
): { state: InitState; wrapped: boolean } {
    const next = firstPresent(s, s.active + 1, exists)
    if (next >= 0) return { state: { ...s, active: next }, wrapped: false }
    const first = firstPresent(s, 0, exists)
    if (first < 0) return { state: s, wrapped: false }
    return { state: { ...s, active: first, round: s.round + 1 }, wrapped: true }
}

export const formatMod = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0")

/** Dice expression for an individual roll, e.g. "1d20+2", "1d6-1" */
export const initExpression = (die: 20 | 6, mod: number) =>
    `1d${die}${mod > 0 ? `+${mod}` : mod < 0 ? `${mod}` : ""}`

// --------------------------------------------------------- dungeon turns
export const MINUTES_PER_TURN = 10
export const REST_EVERY = 6

export interface DungeonState {
    turn: number
    /** Roll for wandering monsters every N turns */
    checkEvery: number
    lastCheck: { turn: number; roll: number; encounter: boolean } | null
}

export const DEFAULT_DUNGEON: DungeonState = { turn: 0, checkEvery: 2, lastCheck: null }

export function normaliseDungeon(v: Partial<DungeonState> | undefined | null): DungeonState {
    if (!v || typeof v !== "object") return DEFAULT_DUNGEON
    return {
        turn: typeof v.turn === "number" && v.turn >= 0 ? Math.floor(v.turn) : 0,
        checkEvery:
            typeof v.checkEvery === "number" && v.checkEvery >= 1 ? Math.min(12, Math.floor(v.checkEvery)) : 2,
        lastCheck: v.lastCheck ?? null,
    }
}

/** "0 min", "50 min", "1 h", "2 h 30 min" */
export function elapsedLabel(turn: number): string {
    const mins = turn * MINUTES_PER_TURN
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (!h) return `${m} min`
    return m ? `${h} h ${m} min` : `${h} h`
}

export const isCheckTurn = (turn: number, every: number) => turn > 0 && turn % every === 0

/** Turns until the next wandering-monster check (1..every) */
export const turnsUntilCheck = (turn: number, every: number) => every - (turn % every)

export const isRestTurn = (turn: number) => turn > 0 && turn % REST_EVERY === 0

/** On a wandering-monster check, a 1 on the d6 means an encounter */
export const isEncounter = (roll: number) => roll === 1

export interface LightLike {
    id: string
    light?: { turnsLeft?: number }
}

/**
 * Burn one turn off every light that has a limited life. Returns the
 * patches (light objects, or undefined when burnt out) and which went out.
 */
export function burnLights<T extends LightLike>(humbugs: readonly T[]) {
    const patches: { id: string; light: NonNullable<T["light"]> | undefined }[] = []
    const burnedOut: T[] = []
    for (const h of humbugs) {
        const left = h.light?.turnsLeft
        if (typeof left !== "number") continue
        if (left - 1 <= 0) {
            patches.push({ id: h.id, light: undefined })
            burnedOut.push(h)
        } else {
            patches.push({ id: h.id, light: { ...h.light!, turnsLeft: left - 1 } as NonNullable<T["light"]> })
        }
    }
    return { patches, burnedOut }
}

// ---------------------------------------------------- character generator
export const STATS = ["STR", "INT", "WIS", "DEX", "CON", "CHA"] as const
export type StatKey = (typeof STATS)[number]

export const STAT_NAMES: Record<StatKey, string> = {
    STR: "Strength",
    INT: "Intelligence",
    WIS: "Wisdom",
    DEX: "Dexterity",
    CON: "Constitution",
    CHA: "Charisma",
}

export interface ClassDef {
    id: string
    label: string
    hitDie: number
    blurb: string
}

export const CLASSES: ClassDef[] = [
    { id: "fighter", label: "Fighter", hitDie: 8, blurb: "Armour, weapons and grit" },
    { id: "cleric", label: "Cleric", hitDie: 6, blurb: "Faith, healing and turning the dead" },
    { id: "magic-user", label: "Magic-User", hitDie: 4, blurb: "Frail, learned, dangerous spells" },
    { id: "thief", label: "Thief", hitDie: 4, blurb: "Locks, traps, stealth and climbing" },
    { id: "dwarf", label: "Dwarf", hitDie: 8, blurb: "Tough, sees in the dark, knows stone" },
    { id: "elf", label: "Elf", hitDie: 6, blurb: "Blade and spell together" },
    { id: "halfling", label: "Halfling", hitDie: 6, blurb: "Small, lucky and hard to hit" },
]

export type RollMethod = "3d6" | "4d6dl"

/** Classic −1 / 0 / +1 modifier bands */
export function abilityMod(score: number): number {
    if (score <= 8) return -1
    if (score <= 12) return 0
    return 1
}

/** Sum of 4d6 dropping the lowest die. Returns the dropped index too. */
export function dropLowest(dice: number[]): { total: number; dropped: number } {
    if (!dice.length) return { total: 0, dropped: -1 }
    let dropped = 0
    dice.forEach((d, i) => {
        if (d < dice[dropped]) dropped = i
    })
    const total = dice.reduce((s, d, i) => (i === dropped ? s : s + d), 0)
    return { total, dropped }
}

/** First-level hit points: one hit die plus the CON modifier, at least 1 */
export const firstLevelHp = (hitDieRoll: number, con: number) => Math.max(1, hitDieRoll + abilityMod(con))

export interface CharacterSheet {
    classId: string
    className: string
    level: number
    stats: Record<StatKey, number>
    method: RollMethod
    /** The hit-die roll before the CON modifier */
    hitDieRoll: number
}

// --------------------------------------------------------------- naming
/** A readable token name: its own name, its party name, or its file name */
export function tokenDisplayName(
    h: { name?: string; imageUrl?: string; type?: string },
    partyNames: ReadonlyMap<string, string>
): string {
    if (h.name?.trim()) return h.name.trim()
    if (h.imageUrl) {
        const p = partyNames.get(h.imageUrl)
        if (p) return p
        if (!/^(data|blob):/.test(h.imageUrl)) {
            try {
                const file = decodeURIComponent(h.imageUrl.split(/[?#]/)[0].split("/").pop() ?? "")
                const name = file.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim()
                if (name) return name
            } catch {
                /* fall through */
            }
        }
    }
    return "Token"
}
