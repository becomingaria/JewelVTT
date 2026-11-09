import type { DiceResult } from "../services"

/*
 * Dice notation: parser and roller. Pure (no DOM, no React) so it can be
 * tested on its own.
 *
 *   NdM            3d6, d8 (N defaults to 1)
 *   d% / d100      percentile
 *   + / - terms    1d8+1d6+2, 1d20-1
 *   keep / drop    4d6kh3, 2d20kl1, 4d6k3 (= kh3), 4d6dl1, 3d6dh1
 *   adv / dis      2d20kh1 / 2d20kl1
 */

export type Rng = () => number

export interface DieRoll {
    sides: number
    value: number
    dropped?: boolean
}

export interface DiceTerm {
    type: "dice"
    sign: 1 | -1
    count: number
    sides: number
    /** Keep the highest / lowest n (drop rules are normalised into keep) */
    keep?: { mode: "h" | "l"; n: number }
    /** As typed (lower-case, no spaces), e.g. "4d6kh3", "adv", "d%" */
    source: string
}

export interface ConstTerm {
    type: "const"
    sign: 1 | -1
    value: number
    source: string
}

export type Term = DiceTerm | ConstTerm

export interface TermResult {
    term: Term
    rolls: DieRoll[]
    /** Signed contribution to the total */
    subtotal: number
}

export interface DetailedRoll extends DiceResult {
    terms: TermResult[]
    /** Canonical spelling, e.g. "4d6kh3+2" */
    normalized: string
}

export class DiceSyntaxError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "DiceSyntaxError"
    }
}

export const LIMITS = { dicePerTerm: 100, sides: 1000, terms: 20, totalDice: 200, constant: 100000 }

const DICE_RE = /^(\d*)d(\d+|%)(?:(kh|kl|k|dh|dl)(\d+))?/
const CONST_RE = /^\d+/
const SHORTHAND_RE = /^(adv|dis)/

/** Parse an expression into terms. Throws DiceSyntaxError with a friendly message. */
export function parseDice(input: string): Term[] {
    const s = input.toLowerCase().replace(/\s+/g, "")
    if (!s) throw new DiceSyntaxError("Type some dice, like 1d20+2.")
    if (s.length > 200) throw new DiceSyntaxError("That expression is too long.")
    const terms: Term[] = []
    let i = 0
    let first = true
    let totalDice = 0
    while (i < s.length) {
        let sign: 1 | -1 = 1
        const ch = s[i]
        if (ch === "+" || ch === "-") {
            sign = ch === "-" ? -1 : 1
            i++
            if (i >= s.length) throw new DiceSyntaxError(`Something is missing after "${ch}".`)
        } else if (!first) {
            throw new DiceSyntaxError(`I don't understand "${s.slice(i)}". Join terms with + or -.`)
        }
        const rest = s.slice(i)
        let m: RegExpExecArray | null
        if ((m = SHORTHAND_RE.exec(rest))) {
            terms.push({
                type: "dice",
                sign,
                count: 2,
                sides: 20,
                keep: { mode: m[1] === "adv" ? "h" : "l", n: 1 },
                source: m[1],
            })
            totalDice += 2
        } else if ((m = DICE_RE.exec(rest))) {
            const count = m[1] === "" ? 1 : Number(m[1])
            const sides = m[2] === "%" ? 100 : Number(m[2])
            if (count < 1) throw new DiceSyntaxError("Roll at least one die.")
            if (count > LIMITS.dicePerTerm)
                throw new DiceSyntaxError(`At most ${LIMITS.dicePerTerm} dice per group.`)
            if (sides < 2) throw new DiceSyntaxError("Dice need at least 2 sides.")
            if (sides > LIMITS.sides) throw new DiceSyntaxError(`Dice can have at most ${LIMITS.sides} sides.`)
            const term: DiceTerm = { type: "dice", sign, count, sides, source: m[0] }
            if (m[3]) {
                const n = Number(m[4])
                const op = m[3]
                if (op.startsWith("k")) {
                    if (n < 1 || n > count)
                        throw new DiceSyntaxError(`Can't keep ${n} of ${count} dice in "${m[0]}".`)
                    term.keep = { mode: op === "kl" ? "l" : "h", n }
                } else {
                    if (n < 0 || n >= count)
                        throw new DiceSyntaxError(`Can't drop ${n} of ${count} dice in "${m[0]}".`)
                    // drop lowest n = keep highest (count - n), and vice versa
                    if (n > 0) term.keep = { mode: op === "dl" ? "h" : "l", n: count - n }
                }
            }
            terms.push(term)
            totalDice += count
        } else if ((m = CONST_RE.exec(rest))) {
            if (rest[m[0].length] === "d")
                throw new DiceSyntaxError(`"${m[0]}d" needs a number of sides, like ${m[0]}d6.`)
            const value = Number(m[0])
            if (value > LIMITS.constant) throw new DiceSyntaxError("That number is too big.")
            terms.push({ type: "const", sign, value, source: m[0] })
        } else {
            throw new DiceSyntaxError(`I don't understand "${rest}". Try something like 2d6+1.`)
        }
        i += m[0].length
        first = false
        if (terms.length > LIMITS.terms) throw new DiceSyntaxError(`At most ${LIMITS.terms} terms.`)
        if (totalDice > LIMITS.totalDice) throw new DiceSyntaxError(`At most ${LIMITS.totalDice} dice in one roll.`)
    }
    return terms
}

/** Uniform 1..sides, using crypto when available */
export const defaultRng: Rng = () => {
    const c = (globalThis as { crypto?: Crypto }).crypto
    if (c?.getRandomValues) {
        const buf = new Uint32Array(1)
        c.getRandomValues(buf)
        return buf[0] / 4294967296
    }
    return Math.random()
}

export function rollDie(sides: number, rng: Rng = defaultRng): number {
    return 1 + Math.min(sides - 1, Math.floor(rng() * sides))
}

export function normalize(terms: Term[]): string {
    return terms
        .map((t, i) => {
            const sign = t.sign < 0 ? "-" : i > 0 ? "+" : ""
            if (t.type === "const") return `${sign}${t.value}`
            const keep = t.keep ? `k${t.keep.mode}${t.keep.n}` : ""
            return `${sign}${t.count}d${t.sides}${keep}`
        })
        .join("")
}

export function rollTerms(terms: Term[], expression: string, rng: Rng = defaultRng): DetailedRoll {
    const results: TermResult[] = terms.map((term) => {
        if (term.type === "const") return { term, rolls: [], subtotal: term.sign * term.value }
        const rolls: DieRoll[] = Array.from({ length: term.count }, () => ({
            sides: term.sides,
            value: rollDie(term.sides, rng),
        }))
        if (term.keep) {
            const { mode, n } = term.keep
            // Stable order: on ties the earlier die is kept
            const order = rolls
                .map((r, idx) => ({ v: r.value, idx }))
                .sort((a, b) => (mode === "h" ? b.v - a.v : a.v - b.v) || a.idx - b.idx)
            const kept = new Set(order.slice(0, n).map((o) => o.idx))
            rolls.forEach((r, idx) => {
                if (!kept.has(idx)) r.dropped = true
            })
        }
        const sum = rolls.reduce((s, r) => s + (r.dropped ? 0 : r.value), 0)
        return { term, rolls, subtotal: term.sign * sum }
    })
    const total = results.reduce((s, r) => s + r.subtotal, 0)
    const rolls = results.flatMap((r) => r.rolls)
    const keptD20 = rolls.filter((r) => r.sides === 20 && !r.dropped)
    const out: DetailedRoll = {
        expression: expression.trim(),
        total,
        rolls,
        terms: results,
        normalized: normalize(terms),
    }
    if (keptD20.length === 1) {
        if (keptD20[0].value === 20) out.crit = true
        if (keptD20[0].value === 1) out.fumble = true
    }
    return out
}

/** Parse and roll. Throws DiceSyntaxError on bad input. */
export function rollExpression(expression: string, rng: Rng = defaultRng): DetailedRoll {
    return rollTerms(parseDice(expression), expression, rng)
}

/** Lowest and highest possible totals */
export function diceRange(terms: Term[]): { min: number; max: number } {
    let min = 0
    let max = 0
    for (const t of terms) {
        let lo: number
        let hi: number
        if (t.type === "const") {
            lo = hi = t.value
        } else {
            const n = t.keep ? t.keep.n : t.count
            lo = n
            hi = n * t.sides
        }
        if (t.sign > 0) {
            min += lo
            max += hi
        } else {
            min -= hi
            max -= lo
        }
    }
    return { min, max }
}

/** "4d6kh3 → 6, 5, 3, dropped 1 · +2" */
export function describeRoll(r: { terms: TermResult[] }): string {
    return r.terms
        .map((t, i) => {
            const sign = t.term.sign < 0 ? "− " : i > 0 ? "+ " : ""
            if (t.term.type === "const") return `${sign}${t.term.value}`
            const kept = t.rolls.filter((d) => !d.dropped).map((d) => d.value)
            const dropped = t.rolls.filter((d) => d.dropped).map((d) => d.value)
            const list = kept.join(", ") + (dropped.length ? `, dropped ${dropped.join(", ")}` : "")
            return `${sign}${t.term.source} (${list})`
        })
        .join(" ")
}

// ------------------------------------------------------------ inline dice
const INLINE_DIE = String.raw`(?:\d*d(?:\d+|%)(?:k[hl]?\d+)?)`
const INLINE_TERM = String.raw`(?:${INLINE_DIE}|\d+)`
const INLINE_RE = new RegExp(
    String.raw`(?<![A-Za-z0-9])${INLINE_TERM}(?:\s*[+-]\s*${INLINE_TERM})*(?![A-Za-z0-9])`,
    "gi"
)

export interface InlineRoll {
    source: string
    roll: DetailedRoll
}

/**
 * Roll every dice expression inside a piece of text and replace it with its
 * total: "Goblins (2d4)" -> "Goblins (5)". Plain numbers are left alone.
 */
export function rollInline(text: string, rng: Rng = defaultRng): { text: string; rolls: InlineRoll[] } {
    const rolls: InlineRoll[] = []
    const out = text.replace(INLINE_RE, (match) => {
        if (!/d/i.test(match)) return match
        try {
            const roll = rollExpression(match, rng)
            rolls.push({ source: match.trim(), roll })
            return String(roll.total)
        } catch {
            return match
        }
    })
    return { text: out, rolls }
}
