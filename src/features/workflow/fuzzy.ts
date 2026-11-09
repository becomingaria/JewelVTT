/*
 * Fuzzy matching for the command palette. Pure (no imports) so it can be
 * checked with a throwaway node script.
 *
 * The query's characters must appear in order in the text. Matches score
 * higher when they are consecutive, start a word, or start the text, and
 * lower when they are spread out. Spaces in the query split it into words
 * that may match in any order ("map dungeon" finds "Change map type:
 * Dungeon crawl").
 */

export interface FuzzyMatch {
    score: number
    /** Indices into the text that matched (for highlighting) */
    indices: number[]
}

const isWordStart = (text: string, i: number) => {
    if (i === 0) return true
    const prev = text[i - 1]
    const cur = text[i]
    if (/[\s\-_:/.(),+&]/.test(prev)) return true
    // camelCase boundary
    return prev === prev.toLowerCase() && cur !== cur.toLowerCase()
}

function subsequence(word: string, text: string, lower: string, preferStarts: boolean): number[] | null {
    const indices: number[] = []
    let from = 0
    for (const ch of word) {
        let found = lower.indexOf(ch, from)
        if (found === -1) return null
        const extendsRun = indices.length > 0 && found === indices[indices.length - 1] + 1
        if (preferStarts && !extendsRun && !isWordStart(text, found)) {
            for (let j = found + 1; j < lower.length; j++) {
                if (lower[j] === ch && isWordStart(text, j)) {
                    found = j
                    break
                }
            }
        }
        indices.push(found)
        from = found + 1
    }
    return indices
}

/** Match one query word (no spaces) against text, best-effort greedy + lookahead */
function matchWord(word: string, text: string, lower: string): FuzzyMatch | null {
    if (!word) return { score: 0, indices: [] }
    // Exact substring: best case, prefer one that starts a word
    let best: FuzzyMatch | null = null
    let from = lower.indexOf(word)
    while (from !== -1) {
        const indices = Array.from({ length: word.length }, (_, k) => from + k)
        let score = 10 * word.length + 8
        if (isWordStart(text, from)) score += 12
        if (from === 0) score += 8
        if (!best || score > best.score) best = { score, indices }
        from = lower.indexOf(word, from + 1)
    }
    if (best) return best

    // Subsequence: prefer word starts ("cmt" -> Change Map Type), and fall
    // back to a plain left-to-right walk if jumping ahead loses the match
    const indices = subsequence(word, text, lower, true) ?? subsequence(word, text, lower, false)
    if (!indices) return null
    let score = 0
    for (let k = 0; k < indices.length; k++) {
        const i = indices[k]
        score += 2
        if (k > 0 && indices[k - 1] === i - 1) score += 5
        if (isWordStart(text, i)) score += 6
        if (k > 0) score -= Math.min(3, Math.max(0, i - indices[k - 1] - 1) * 0.5)
    }
    if (indices[0] === 0) score += 4
    return { score, indices }
}

/**
 * Score `text` against `query` (case-insensitive). Returns null when it
 * doesn't match. Shorter texts win ties.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
    if (!words.length) return { score: 0, indices: [] }
    const lower = text.toLowerCase()
    let score = 0
    const indices = new Set<number>()
    for (const w of words) {
        const m = matchWord(w, text, lower)
        if (!m) return null
        score += m.score
        m.indices.forEach((i) => indices.add(i))
    }
    // Whole query as typed appears verbatim: strong bonus
    if (words.length > 1 && lower.includes(query.toLowerCase().trim())) score += 15
    score -= text.length * 0.05
    return { score, indices: [...indices].sort((a, b) => a - b) }
}

export interface Searchable {
    label: string
    /** Extra words that match but aren't shown */
    keywords?: string
}

/**
 * Rank items by query. Label matches beat keyword-only matches. Items whose
 * id is in `boost` (recently used) get a small lift. Stable for equal scores.
 */
export function rankItems<T extends Searchable & { id: string }>(
    items: T[],
    query: string,
    boost: string[] = []
): { item: T; indices: number[] }[] {
    if (!query.trim()) return items.map((item) => ({ item, indices: [] }))
    const out: { item: T; indices: number[]; score: number; order: number }[] = []
    items.forEach((item, order) => {
        const onLabel = fuzzyMatch(query, item.label)
        const onAll = item.keywords ? fuzzyMatch(query, `${item.label} ${item.keywords}`) : null
        let score: number
        let indices: number[]
        if (onLabel) {
            score = onLabel.score
            indices = onLabel.indices
        } else if (onAll) {
            score = onAll.score - 10
            indices = onAll.indices.filter((i) => i < item.label.length)
        } else return
        const r = boost.indexOf(item.id)
        if (r !== -1) score += 6 - Math.min(5, r)
        out.push({ item, indices, score, order })
    })
    out.sort((a, b) => b.score - a.score || a.order - b.order)
    return out.map(({ item, indices }) => ({ item, indices }))
}
