import {
    DiceSyntaxError,
    defaultRng,
    diceRange,
    parseDice,
    rollExpression,
    rollInline,
    type DetailedRoll,
    type InlineRoll,
    type Rng,
} from "./notation.ts"

/*
 * Random tables: data model, entry parsing, rolling, import/export. Pure.
 *
 * A table has one or more parts. Each part rolls its own dice and picks an
 * entry; the picked texts are joined (two-part tables like tavern names).
 */

export interface TableEntry {
    min: number
    max: number
    text: string
}

export interface TablePart {
    /** Optional caption, e.g. "First word" */
    label?: string
    dice: string
    entries: TableEntry[]
}

export interface RandomTable {
    id: string
    name: string
    parts: TablePart[]
    /** Joins the parts' results (default a single space) */
    join: string
    updatedAt: number
}

export const TABLES_FILE_FORMAT = "jewel-vtt-tables"

export function newTableId(): string {
    return `tbl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

// ----------------------------------------------------------- entry text
const LINE_RE = /^(\d+)(?:\s*[-–—]\s*(\d+))?\s*[:.)]\s*(.*)$/

/**
 * Parse "1-2: Goblins (2d4)" lines. Lines without a range are numbered on
 * from the previous one. Blank lines and lines starting with # are skipped.
 */
export function parseEntries(text: string): { entries: TableEntry[]; errors: string[] } {
    const entries: TableEntry[] = []
    const errors: string[] = []
    let next = 1
    text.split(/\r?\n/).forEach((raw, i) => {
        const line = raw.trim()
        if (!line || line.startsWith("#")) return
        const m = LINE_RE.exec(line)
        if (m) {
            const a = Number(m[1])
            const b = m[2] === undefined ? a : Number(m[2])
            const body = m[3].trim()
            if (!body) {
                errors.push(`Line ${i + 1}: the entry has no text.`)
                return
            }
            entries.push({ min: Math.min(a, b), max: Math.max(a, b), text: body })
            next = Math.max(a, b) + 1
        } else {
            entries.push({ min: next, max: next, text: line })
            next++
        }
    })
    return { entries, errors }
}

export function formatEntries(entries: TableEntry[]): string {
    return entries
        .map((e) => `${e.min === e.max ? e.min : `${e.min}-${e.max}`}: ${e.text}`)
        .join("\n")
}

/** Problems that make a part unrollable (errors) or leave gaps (warnings) */
export function checkPart(part: TablePart): { errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []
    let range: { min: number; max: number } | null = null
    try {
        range = diceRange(parseDice(part.dice))
    } catch (e) {
        errors.push(e instanceof DiceSyntaxError ? `Dice: ${e.message}` : "Dice: not valid.")
    }
    if (!part.entries.length) errors.push("Add at least one entry.")
    const sorted = [...part.entries].sort((a, b) => a.min - b.min)
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].min <= sorted[i - 1].max)
            warnings.push(`Entries ${sorted[i - 1].min}–${sorted[i - 1].max} and ${sorted[i].min}–${sorted[i].max} overlap.`)
    }
    if (range && sorted.length) {
        const missing: number[] = []
        for (let v = range.min; v <= range.max && missing.length < 6; v++) {
            if (!sorted.some((e) => v >= e.min && v <= e.max)) missing.push(v)
        }
        if (missing.length)
            warnings.push(`No entry for ${missing.join(", ")}${missing.length === 6 ? "…" : ""}.`)
        const r = range
        const unreachable = sorted.filter((e) => e.max < r.min || e.min > r.max)
        if (unreachable.length)
            warnings.push(
                `${part.dice} can't roll ${unreachable.map((e) => (e.min === e.max ? e.min : `${e.min}–${e.max}`)).join(", ")}.`
            )
    }
    return { errors, warnings }
}

// --------------------------------------------------------------- rolling
export interface PartRoll {
    label?: string
    dice: string
    roll: DetailedRoll | null
    entry: TableEntry | null
    /** Final text, inline dice already rolled */
    text: string
    inline: InlineRoll[]
}

export interface TableRoll {
    tableId: string
    tableName: string
    text: string
    parts: PartRoll[]
}

export function rollTable(table: RandomTable, rng: Rng = defaultRng): TableRoll {
    const parts: PartRoll[] = table.parts.map((part) => {
        let roll: DetailedRoll | null = null
        try {
            roll = rollExpression(part.dice, rng)
        } catch {
            return { label: part.label, dice: part.dice, roll: null, entry: null, text: "(bad dice)", inline: [] }
        }
        const total = roll.total
        const entry = part.entries.find((e) => total >= e.min && total <= e.max) ?? null
        if (!entry)
            return { label: part.label, dice: part.dice, roll, entry, text: `(no entry for ${total})`, inline: [] }
        const inline = rollInline(entry.text, rng)
        return { label: part.label, dice: part.dice, roll, entry, text: inline.text, inline: inline.rolls }
    })
    return {
        tableId: table.id,
        tableName: table.name,
        text: parts.map((p) => p.text).join(table.join ?? " "),
        parts,
    }
}

/** "2d6 → 7 (3, 4) · Goblins: 2d4 → 5" */
export function describeTableRoll(r: TableRoll): string {
    return r.parts
        .map((p) => {
            const head = p.roll ? `${p.dice} → ${p.roll.total}` : p.dice
            const inline = p.inline.map((i) => `${i.source} → ${i.roll.total}`).join(", ")
            return inline ? `${head}; ${inline}` : head
        })
        .join(" · ")
}

// ------------------------------------------------------- import / export
export function exportTables(tables: RandomTable[]): string {
    return JSON.stringify(
        {
            format: TABLES_FILE_FORMAT,
            version: 1,
            tables: tables.map(({ id, name, parts, join }) => ({ id, name, join, parts })),
        },
        null,
        2
    )
}

function asString(v: unknown, fallback = ""): string {
    return typeof v === "string" ? v : fallback
}

function sanitizeEntry(v: unknown): TableEntry | null {
    if (!v || typeof v !== "object") return null
    const o = v as Record<string, unknown>
    const min = Number(o.min)
    const max = Number(o.max ?? o.min)
    const text = asString(o.text).trim()
    if (!Number.isFinite(min) || !Number.isFinite(max) || !text) return null
    return { min: Math.round(Math.min(min, max)), max: Math.round(Math.max(min, max)), text: text.slice(0, 500) }
}

/** Validate one table-shaped object (also accepts a flat {dice, entries}) */
export function sanitizeTable(v: unknown): RandomTable | null {
    if (!v || typeof v !== "object") return null
    const o = v as Record<string, unknown>
    const name = asString(o.name).trim().slice(0, 80)
    if (!name) return null
    const rawParts = Array.isArray(o.parts) ? o.parts : [{ dice: o.dice, entries: o.entries }]
    const parts: TablePart[] = []
    for (const p of rawParts.slice(0, 6)) {
        if (!p || typeof p !== "object") continue
        const po = p as Record<string, unknown>
        const dice = asString(po.dice).trim().slice(0, 60)
        let entries: TableEntry[] = []
        if (Array.isArray(po.entries)) {
            entries = po.entries.slice(0, 1000).map(sanitizeEntry).filter((e): e is TableEntry => !!e)
        } else if (typeof po.entries === "string") {
            entries = parseEntries(po.entries).entries
        }
        if (!dice || !entries.length) continue
        const label = asString(po.label).trim().slice(0, 40)
        parts.push(label ? { label, dice, entries } : { dice, entries })
    }
    if (!parts.length) return null
    return {
        id: asString(o.id) || newTableId(),
        name,
        parts,
        join: asString(o.join, " ").slice(0, 10),
        updatedAt: Date.now(),
    }
}

/**
 * Read tables from JSON: our export format, a bare array, or one table.
 * Throws an Error with a friendly message when nothing usable is found.
 */
export function importTables(json: string): RandomTable[] {
    let data: unknown
    try {
        data = JSON.parse(json)
    } catch {
        throw new Error("That file isn't valid JSON.")
    }
    let list: unknown[]
    if (Array.isArray(data)) list = data
    else if (data && typeof data === "object" && Array.isArray((data as { tables?: unknown }).tables))
        list = (data as { tables: unknown[] }).tables
    else list = [data]
    const tables = list.map(sanitizeTable).filter((t): t is RandomTable => !!t)
    if (!tables.length) throw new Error("No tables found in that file.")
    return tables
}

/** Add imported tables; ids that already exist get fresh ones */
export function mergeTables(existing: RandomTable[], incoming: RandomTable[]): RandomTable[] {
    const ids = new Set(existing.map((t) => t.id))
    const added = incoming.map((t) => {
        if (!ids.has(t.id)) {
            ids.add(t.id)
            return t
        }
        const id = newTableId()
        ids.add(id)
        return { ...t, id }
    })
    return [...existing, ...added]
}
