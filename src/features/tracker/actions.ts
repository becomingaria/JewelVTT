import type { Humbug, TokenHumbug } from "../../types/humbug.types"
import { humbugsStore, pushUndo, selectionStore, updateHumbugs } from "../board-bridge"
import { logEvent, rollDice } from "../services"
import { playSfx } from "../sound"
import { isHumbugHidden } from "../view-state"
import { showToast } from "../../utils/toast"
import { flyTo } from "../../utils/view-events"
import {
    DEFAULT_DUNGEON,
    addCombatants,
    advanceTurn,
    applyHpDelta,
    burnLights,
    conditionLabel,
    elapsedLabel,
    firstPresent,
    initExpression,
    isCheckTurn,
    isEncounter,
    isRestTurn,
    moveCombatant,
    orderByRolls,
    orderBySide,
    removeCombatant,
    setHpMax,
    tokenDisplayName,
    type CharacterSheet,
    type DungeonState,
    type InitState,
    type Side,
} from "./logic"
import { announceStore, dungeonStore, initStore, partyStore, stripOpenStore } from "./state"

/*
 * Everything the tracker does to the board or its own state. Called from
 * hotkeys, menu items and panels alike, so it reads the stores directly.
 */

// ------------------------------------------------------------- helpers
export interface TrackerExt {
    side?: Side
    sheet?: CharacterSheet
}

export const isToken = (h: Humbug | undefined): h is TokenHumbug => h?.type === "token"

export const trackerExt = (h: Humbug): TrackerExt => (h.ext?.tracker ?? {}) as TrackerExt

const byId = (id: string) => humbugsStore.get().find((h) => h.id === id)
const exists = (id: string) => humbugsStore.get().some((h) => h.id === id)

/** Party or foe: an explicit tag, else a generated character or a "My Party" image counts as party */
export function sideOf(h: Humbug): Side {
    const t = trackerExt(h)
    if (t.side) return t.side
    if (t.sheet) return "party"
    if (isToken(h) && partyStore.get().has(h.imageUrl)) return "party"
    return "foe"
}

export const nameOf = (h: Humbug) =>
    tokenDisplayName(isToken(h) ? h : { type: h.type }, partyStore.get())

/** World centre of a humbug (position is its top-left corner) */
export function centreOf(h: Humbug) {
    const size = "size" in h && typeof h.size === "object" ? h.size : { width: 0, height: 0 }
    return { x: h.position.x + size.width / 2, y: h.position.y + size.height / 2 }
}

function announce(text: string) {
    // Re-set even when unchanged so screen readers hear repeats
    announceStore.set("")
    announceStore.set(text)
}

// ---------------------------------------------------------- initiative
/** Apply a new initiative state as one undo step */
function commitInit(next: InitState, label: string) {
    const prev = initStore.get()
    if (next === prev) return
    initStore.set(next)
    pushUndo({ label, undo: () => initStore.set(prev), redo: () => initStore.set(next) })
}

export const setStripOpen = (open: boolean) => stripOpenStore.set(open)
export const toggleStrip = () => stripOpenStore.set((o) => !o)

export function addToInitiative(ids: string[]) {
    const tokens = ids.map(byId).filter(isToken)
    if (!tokens.length) {
        showToast("Only tokens can join initiative.")
        return
    }
    const prev = initStore.get()
    const next = addCombatants(prev, tokens.map((t) => t.id))
    setStripOpen(true)
    if (next === prev) {
        showToast(tokens.length === 1 ? `${nameOf(tokens[0])} is already in initiative.` : "They're already in initiative.")
        return
    }
    const added = next.order.length - prev.order.length
    commitInit(next, "Add to initiative")
    announce(`${added} added to initiative.`)
}

export function addSelectedToInitiative() {
    const ids = selectionStore.get().filter((id) => isToken(byId(id)))
    if (!ids.length) {
        showToast("Select one or more tokens first, then press Shift+U.")
        return
    }
    addToInitiative([...ids])
}

export function addAllToInitiative() {
    const ids = humbugsStore
        .get()
        .filter((h) => isToken(h) && !isHumbugHidden(h))
        .map((h) => h.id)
    if (!ids.length) {
        showToast("There are no tokens on the board yet.")
        return
    }
    addToInitiative(ids)
}

export const isInInitiative = (id: string) => initStore.get().order.some((c) => c.id === id)

export function removeFromInitiative(id: string) {
    const h = byId(id)
    commitInit(removeCombatant(initStore.get(), id), "Remove from initiative")
    announce(`${h ? nameOf(h) : "Token"} removed from initiative.`)
}

export function clearInitiative() {
    const s = initStore.get()
    if (!s.order.length) return
    commitInit({ ...s, order: [], active: -1, round: 1, sideRolls: null }, "Clear initiative")
    showToast("Initiative cleared. Undo (⌘Z / Ctrl+Z) brings it back.")
    announce("Initiative cleared.")
}

export function moveInInitiative(from: number, to: number) {
    commitInit(moveCombatant(initStore.get(), from, to), "Reorder initiative")
}

export function setInitOptions(patch: Partial<Pick<InitState, "mode" | "die" | "rerollEachRound">>) {
    commitInit({ ...initStore.get(), ...patch }, "Initiative settings")
}

export function setCombatantMod(id: string, mod: number) {
    const s = initStore.get()
    const m = Math.max(-5, Math.min(5, Math.round(mod)))
    commitInit({ ...s, order: s.order.map((c) => (c.id === id ? { ...c, mod: m } : c)) }, "Initiative modifier")
}

/** Tag a token as party or foe (saved on the token, so it's undoable with it) */
export function setSide(id: string, side: Side) {
    const h = byId(id)
    if (!h) return
    updateHumbugs([{ id, changes: { ext: { ...h.ext, tracker: { ...trackerExt(h), side } } } }])
}

/** Roll per side: one d6 for the party, one for the monsters */
function rollSides(s: InitState): InitState {
    const party = rollDice("1d6", { label: "Party initiative" }).total
    const foe = rollDice("1d6", { label: "Monster initiative" }).total
    const next = orderBySide(s, { party, foe }, (id) => {
        const h = byId(id)
        return h ? sideOf(h) : "foe"
    })
    const who =
        party === foe ? "a tie: both sides act at once" : party > foe ? "the party acts first" : "the monsters act first"
    const text = `Side initiative: party ${party}, monsters ${foe}, ${who}.`
    logEvent({ kind: "turn", text })
    announce(text)
    return next
}

export function rollInitiative() {
    const s = initStore.get()
    if (!s.order.some((c) => exists(c.id))) {
        showToast("Add tokens to initiative first (Shift+U adds the selected ones).")
        return
    }
    let next: InitState
    if (s.mode === "side") {
        next = rollSides(s)
    } else {
        const totals: Record<string, number> = {}
        for (const c of s.order) {
            const h = byId(c.id)
            if (!h) continue
            totals[c.id] = rollDice(initExpression(s.die, c.mod), {
                label: `Initiative: ${nameOf(h)}`,
                // One tray animation per creature would be noisy; the strip shows every number
                show: false,
            }).total
        }
        next = orderByRolls(s, totals)
        const summary = next.order
            .filter((c) => exists(c.id))
            .map((c) => `${nameOf(byId(c.id)!)} ${c.init}`)
            .join(", ")
        logEvent({ kind: "turn", text: `Initiative order: ${summary}` })
        announce(`Initiative order: ${summary}.`)
    }
    next = { ...next, active: firstPresent(next, 0, exists) }
    commitInit(next, "Roll initiative")
}

export function nextTurn() {
    const s = initStore.get()
    if (!s.order.length) {
        showToast("Nobody is in initiative yet. Select tokens and press Shift+U.")
        return
    }
    const { state, wrapped } = advanceTurn(s, exists)
    if (state === s) {
        showToast("None of the tokens in initiative are on the board.")
        return
    }
    let next = state
    if (wrapped && next.mode === "side" && next.rerollEachRound) {
        next = rollSides(next)
        next = { ...next, active: firstPresent(next, 0, exists) }
    }
    commitInit(next, "Next turn")
    const h = byId(next.order[next.active].id)
    const text = `Round ${next.round}: ${h ? nameOf(h) : "Token"}'s turn`
    playSfx("turn")
    logEvent({ kind: "turn", text })
    announce(`${text}.`)
}

export function activeCombatantId(): string | null {
    const s = initStore.get()
    return s.order[s.active]?.id ?? null
}

export function flyToActive() {
    const id = activeCombatantId()
    const h = id ? byId(id) : undefined
    if (!h) {
        showToast("No one has the turn yet. Press N to start.")
        return
    }
    flyTo(centreOf(h))
}

export function flyToHumbug(id: string) {
    const h = byId(id)
    if (h) flyTo(centreOf(h))
}

// ------------------------------------------------------- dungeon turns
function commitDungeon(next: DungeonState, label: string) {
    const prev = dungeonStore.get()
    dungeonStore.set(next)
    pushUndo({ label, undo: () => dungeonStore.set(prev), redo: () => dungeonStore.set(next) })
}

const lightOwner = (h: Humbug) => {
    if (isToken(h)) {
        const n = nameOf(h)
        return n === "Token" ? "A token's torch" : `${n}'s torch`
    }
    return "A torch"
}

export function advanceDungeonTurn() {
    const prev = dungeonStore.get()
    const turn = prev.turn + 1

    // Lights burn down, all in one undo step
    const { patches, burnedOut } = burnLights(humbugsStore.get())
    if (patches.length) {
        updateHumbugs(patches.map((p) => ({ id: p.id, changes: { light: p.light } })))
    }
    if (burnedOut.length) {
        playSfx("torch-out")
        for (const h of burnedOut) {
            const text = `${lightOwner(h)} burns out`
            showToast(text)
            logEvent({ kind: "turn", text })
        }
    }

    let lastCheck = prev.lastCheck
    if (isCheckTurn(turn, prev.checkEvery)) {
        const roll = rollDice("1d6", { label: "Wandering monster check" }).total
        const encounter = isEncounter(roll)
        lastCheck = { turn, roll, encounter }
        if (encounter) {
            playSfx("alert")
            showToast("Wandering monsters! Something is coming this way.")
            logEvent({ kind: "encounter", text: `Wandering monsters on turn ${turn}` })
        }
    } else {
        playSfx("turn")
    }

    if (isRestTurn(turn)) {
        showToast("An hour of exploring: the party should rest for one turn.")
    }

    logEvent({ kind: "turn", text: `Dungeon turn ${turn} (${elapsedLabel(turn)} elapsed)` })
    commitDungeon({ ...prev, turn, lastCheck }, "Dungeon turn")
}

export function setCheckEvery(n: number) {
    const s = dungeonStore.get()
    const v = Math.max(1, Math.min(12, Math.round(n)))
    if (v !== s.checkEvery) commitDungeon({ ...s, checkEvery: v }, "Wandering check interval")
}

export function resetDungeonTurns() {
    const s = dungeonStore.get()
    if (!s.turn && !s.lastCheck) return
    commitDungeon({ ...DEFAULT_DUNGEON, checkEvery: s.checkEvery }, "Reset dungeon turns")
    showToast("Dungeon turns reset. Undo brings them back.")
}

// -------------------------------------------------- hit points, conditions
export function changeHp(id: string, delta: number) {
    const h = byId(id)
    if (!isToken(h) || !h.hp || !delta) return
    const hp = applyHpDelta(h.hp, delta)
    if (hp.current === h.hp.current) return
    updateHumbugs([{ id, changes: { hp } }])
    if (hp.current === 0 && h.hp.current > 0) {
        logEvent({ kind: "note", text: `${nameOf(h)} drops to 0 hit points` })
    }
}

export function setHpCurrent(id: string, value: number) {
    const h = byId(id)
    if (!isToken(h) || !h.hp) return
    changeHp(id, Math.round(value) - h.hp.current)
}

export function setHpMaximum(id: string, max: number) {
    const h = byId(id)
    if (!isToken(h) || !Number.isFinite(max) || max < 1) return
    updateHumbugs([{ id, changes: { hp: setHpMax(h.hp, max) } }])
}

export function clearHp(id: string) {
    const h = byId(id)
    if (isToken(h) && h.hp) updateHumbugs([{ id, changes: { hp: undefined } }])
}

export function toggleCondition(id: string, cond: string) {
    const h = byId(id)
    if (!isToken(h)) return
    const cur = h.conditions ?? []
    const on = cur.includes(cond)
    const conditions = on ? cur.filter((c) => c !== cond) : [...cur, cond]
    updateHumbugs([{ id, changes: { conditions } }])
    if (!on) logEvent({ kind: "note", text: `${nameOf(h)} is ${conditionLabel(cond).toLowerCase()}` })
}

export function clearConditions(id: string) {
    const h = byId(id)
    if (isToken(h) && h.conditions?.length) updateHumbugs([{ id, changes: { conditions: [] } }])
}
