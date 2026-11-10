import { pushUndo } from "../board-bridge"
import { createStore, useStore } from "../store"
import { netRoleStore } from "../view-state"
import { profileStore } from "../net/profile"
import type { DieRoll } from "./notation"

/*
 * Roll audit: every roll ever made at this table, with who rolled it, every
 * die face and the total. Saved with the board ("dice:audit"), so it goes
 * back across sessions until the GM clears it. Unlike the session log (a
 * story of the game), the audit is the full record for checking rolls.
 *
 * In a shared game the GM's audit is the record: players' rolls are sent to
 * the GM and logged under their name. Players see every public roll; GM
 * rolls made in secret (not shown) appear only in the GM's audit.
 */

export interface AuditEntry {
    id: string
    /** epoch ms */
    at: number
    /** Who rolled: the GM's or player's name */
    by: string
    /** Player's device id (shared games) */
    device?: string
    label?: string
    expression: string
    total: number
    dice: DieRoll[]
    /** Readable breakdown, e.g. "4d6kh3 (6, 5, 3, dropped 1)" */
    breakdown: string
    crit?: boolean
    fumble?: boolean
    /** Rolled without showing anyone (GM only) */
    secret?: boolean
    /** Random table rolls: "Table name: result" */
    table?: string
}

/** Oldest rolls drop off past this many */
export const AUDIT_LIMIT = 10_000

export const auditStore = createStore<readonly AuditEntry[]>([])
export const useAudit = () => useStore(auditStore)

let seq = 0
const newId = () => `audit_${Date.now().toString(36)}_${(seq++).toString(36)}_${Math.random().toString(36).slice(2, 5)}`

/** The name rolls made on this computer are filed under */
export function localRoller(): string {
    const name = profileStore.get().name.trim()
    if (name) return name
    return netRoleStore.get() === "player" ? "Player" : "GM"
}

export function recordAudit(entry: Omit<AuditEntry, "id" | "at"> & { id?: string; at?: number }): AuditEntry {
    const full: AuditEntry = { ...entry, id: entry.id ?? newId(), at: entry.at ?? Date.now() }
    auditStore.set((prev) => {
        const next = [...prev, full]
        return next.length > AUDIT_LIMIT ? next.slice(next.length - AUDIT_LIMIT) : next
    })
    return full
}

/** GM only: wipe the audit (one undo step) */
export function clearAudit() {
    const before = auditStore.get()
    if (!before.length) return
    auditStore.set([])
    pushUndo({ label: "Clear roll audit", undo: () => auditStore.set(before), redo: () => auditStore.set([]) })
}

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n)

function sanitizeDice(v: unknown): DieRoll[] {
    if (!Array.isArray(v)) return []
    return v
        .slice(0, 200)
        .filter((d) => d && isNum(d.sides) && isNum(d.value) && d.sides >= 1 && d.sides <= 10_000)
        .map((d) => ({
            sides: Math.round(d.sides),
            value: Math.max(1, Math.min(Math.round(d.sides), Math.round(d.value))),
            dropped: d.dropped ? true : undefined,
        }))
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined)

/** Clean one entry from a saved board or from a player's app */
export function sanitizeAuditEntry(v: unknown): AuditEntry | null {
    const e = v as Partial<AuditEntry>
    if (!e || typeof e !== "object" || !isNum(e.total)) return null
    return {
        id: str(e.id, 80) ?? newId(),
        at: isNum(e.at) ? e.at : Date.now(),
        by: str(e.by, 40) || "Someone",
        device: str(e.device, 40),
        label: str(e.label, 120),
        expression: str(e.expression, 200) ?? "",
        total: e.total,
        dice: sanitizeDice(e.dice),
        breakdown: str(e.breakdown, 400) ?? "",
        crit: e.crit ? true : undefined,
        fumble: e.fumble ? true : undefined,
        secret: e.secret ? true : undefined,
        table: str(e.table, 300),
    }
}

export function sanitizeAudit(v: unknown): AuditEntry[] {
    if (!Array.isArray(v)) return []
    return v
        .map(sanitizeAuditEntry)
        .filter((e): e is AuditEntry => !!e)
        .slice(-AUDIT_LIMIT)
}

// ------------------------------------------------------------- summaries
export interface RollerStats {
    by: string
    rolls: number
    d20s: number
    d20Average: number
    nat20: number
    nat1: number
}

/** Per-roller numbers: how many rolls, and how their d20s have gone */
export function rollerStats(entries: readonly AuditEntry[]): RollerStats[] {
    const map = new Map<string, { rolls: number; d20: number[] }>()
    for (const e of entries) {
        const s = map.get(e.by) ?? { rolls: 0, d20: [] }
        s.rolls++
        for (const d of e.dice) if (d.sides === 20 && !d.dropped) s.d20.push(d.value)
        map.set(e.by, s)
    }
    return [...map.entries()]
        .map(([by, s]) => ({
            by,
            rolls: s.rolls,
            d20s: s.d20.length,
            d20Average: s.d20.length ? s.d20.reduce((a, b) => a + b, 0) / s.d20.length : 0,
            nat20: s.d20.filter((v) => v === 20).length,
            nat1: s.d20.filter((v) => v === 1).length,
        }))
        .sort((a, b) => b.rolls - a.rolls)
}

/** Faces as text: kept dice plain, dropped ones in brackets */
export const facesText = (dice: DieRoll[]) =>
    dice.map((d) => (d.dropped ? `(${d.value})` : String(d.value))).join(", ")

/** Spreadsheet export of the audit */
export function auditCsv(entries: readonly AuditEntry[]): string {
    const q = (s: string | number | undefined) => {
        const t = String(s ?? "")
        return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
    }
    const rows = [["Time", "Who", "Device", "Label", "Expression", "Dice", "Total", "Critical", "Fumble", "Secret", "Table result"]]
    for (const e of entries) {
        rows.push([
            new Date(e.at).toISOString(),
            e.by,
            e.device ?? "",
            e.label ?? "",
            e.expression,
            facesText(e.dice),
            String(e.total),
            e.crit ? "yes" : "",
            e.fumble ? "yes" : "",
            e.secret ? "yes" : "",
            e.table ?? "",
        ])
    }
    return rows.map((r) => r.map(q).join(",")).join("\n")
}
