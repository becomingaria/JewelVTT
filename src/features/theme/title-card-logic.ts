/*
 * Pure helpers for scene title cards (kept free of React and the DOM so
 * they can be checked on their own).
 */

const len = (v: unknown) =>
    Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0

/** Same rule the scene tabs use: nothing drawn, placed or painted */
export function isEmptyBoard(board: Record<string, unknown>): boolean {
    return ["humbugs", "spots", "scribbles", "paintGrid", "connectors"].every((k) => len(board[k]) === 0)
}

/**
 * Split a title for the illuminated initial: the first letter or digit gets
 * the decorated box, the rest follows. Leading punctuation stays with the
 * rest so "“Tomb”" still gets a T.
 */
export function splitInitial(title: string): { initial: string; rest: string } {
    const t = title.trim()
    const chars = Array.from(t)
    const i = chars.findIndex((c) => /[\p{L}\p{N}]/u.test(c))
    if (i < 0) return { initial: "", rest: t }
    return {
        initial: chars[i].toUpperCase(),
        rest: chars.slice(0, i).join("") + chars.slice(i + 1).join(""),
    }
}

/** Display timing, in ms: fade in, hold, fade out (about 2.5 s in all) */
export const TITLE_CARD_MS = 2500
