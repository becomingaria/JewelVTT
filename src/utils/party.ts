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

/** Fired after the party changes outside the menu (e.g. "Add to Party") */
export const PARTY_CHANGED_EVENT = "jewel:partyChanged"

// Other open Jewel VTT tabs hear about changes too (the party is shared
// browser storage, so a tab that isn't told would show an old party and
// could overwrite the real one)
const partyChannel =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("jewel-vtt-party") : null

/** Tell this tab and every other open tab that the party changed */
export function notifyPartyChanged() {
    window.dispatchEvent(new CustomEvent(PARTY_CHANGED_EVENT))
    partyChannel?.postMessage("changed")
}

/** Run `listener` whenever the party changes in this or another tab */
export function onPartyChanged(listener: () => void) {
    const fromOtherTab = () => listener()
    window.addEventListener(PARTY_CHANGED_EVENT, listener)
    partyChannel?.addEventListener("message", fromOtherTab)
    return () => {
        window.removeEventListener(PARTY_CHANGED_EVENT, listener)
        partyChannel?.removeEventListener("message", fromOtherTab)
    }
}

/** A readable name for a token image: its file name, or "Party member N" */
function nameFromImage(imageUrl: string, fallbackIndex: number) {
    if (!/^(data|blob):/.test(imageUrl)) {
        try {
            const file = decodeURIComponent(new URL(imageUrl, window.location.href).pathname.split("/").pop() ?? "")
            const name = file.replace(/\.[^.]+$/, "").trim()
            if (name) return name
        } catch {
            /* fall through */
        }
    }
    return `Party member ${fallbackIndex}`
}

/** Add a token image to the party. Duplicates and a full party are refused. */
export async function addToParty(imageUrl: string): Promise<"added" | "exists" | "full"> {
    const party = await loadParty()
    if (party.some((m) => m.imageUrl === imageUrl)) return "exists"
    if (party.length >= MAX_PARTY) return "full"
    const member: PartyMember = {
        id: `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        imageUrl,
        name: nameFromImage(imageUrl, party.length + 1),
    }
    await saveParty([...party, member])
    notifyPartyChanged()
    return "added"
}

/** Remove a token image from the party */
export async function removeFromParty(imageUrl: string): Promise<boolean> {
    const party = await loadParty()
    const next = party.filter((m) => m.imageUrl !== imageUrl)
    if (next.length === party.length) return false
    await saveParty(next)
    notifyPartyChanged()
    return true
}
