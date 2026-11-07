import { STORES, idbGet, idbSet } from "./idb"

/** A player character token kept ready in the menu ("My Party") */
export interface PartyMember {
    id: string
    imageUrl: string
    name: string
}

export const MAX_PARTY = 8
const PARTY_KEY = "party"

/** Kept per browser (not per board): your party follows you between boards */
export const loadParty = async (): Promise<PartyMember[]> =>
    (await idbGet<PartyMember[]>(STORES.settings, PARTY_KEY).catch(() => undefined)) ?? []

export const saveParty = (members: PartyMember[]) =>
    idbSet(STORES.settings, PARTY_KEY, members).catch(() => {})

/**
 * Dice-pip arrangement for 1..8 tokens on a 3×3 grid of slots (-1, 0, 1),
 * read left-to-right, top-to-bottom like a die face.
 */
export function pipLayout(count: number): [number, number][] {
    const C: [number, number] = [0, 0]
    const TL: [number, number] = [-1, -1], TR: [number, number] = [1, -1]
    const BL: [number, number] = [-1, 1], BR: [number, number] = [1, 1]
    const ML: [number, number] = [-1, 0], MR: [number, number] = [1, 0]
    const TM: [number, number] = [0, -1], BM: [number, number] = [0, 1]
    const layouts: [number, number][][] = [
        [],
        [C],
        [TL, BR],
        [TL, C, BR],
        [TL, TR, BL, BR],
        [TL, TR, C, BL, BR],
        [TL, TR, ML, MR, BL, BR],
        [TL, TR, ML, C, MR, BL, BR],
        [TL, TM, TR, ML, MR, BL, BM, BR],
    ]
    return layouts[Math.max(0, Math.min(MAX_PARTY, count))]
}
