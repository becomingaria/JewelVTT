import type { LightSource } from "../../types/humbug.types"
import { loadParty, MAX_PARTY, notifyPartyChanged, saveParty, type PartyMember } from "../../utils/party"
import { LIGHT_PRESETS } from "../fog-light/light-store"
import { createPersistentStore } from "../store"
import type { Placing } from "./client"

/*
 * A player's characters: the "My Party" portraits kept in their own app,
 * plus the light and vision each one starts with on the table.
 */

export interface CharacterPrefs {
    /** Light preset id, or "none" */
    light: string
    /** Vision in feet */
    vision: number
}

export const DEFAULT_PREFS: CharacterPrefs = { light: "none", vision: 60 }

export const characterPrefsStore = createPersistentStore<Record<string, CharacterPrefs>>("jewel:net:characters", {})

export const prefsOf = (id: string): CharacterPrefs => ({ ...DEFAULT_PREFS, ...characterPrefsStore.get()[id] })

export function setPrefs(id: string, patch: Partial<CharacterPrefs>) {
    characterPrefsStore.set((all) => ({ ...all, [id]: { ...prefsOf(id), ...patch } }))
}

export const lightOf = (id: string): LightSource | undefined => {
    const p = LIGHT_PRESETS.find((x) => x.id === prefsOf(id).light)
    return p ? { ...p.light } : undefined
}

/** Shrink a picture to a token-sized PNG (keeps the connection light) */
export async function toTokenImage(source: Blob): Promise<string> {
    const bmp = await createImageBitmap(source)
    const scale = Math.min(1, 256 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bmp.width * scale))
    canvas.height = Math.max(1, Math.round(bmp.height * scale))
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/png")
}

/** Everything the GM needs to put this character on the table */
export async function placingFor(m: PartyMember): Promise<Placing> {
    const image = await toTokenImage(await (await fetch(m.imageUrl)).blob())
    return { name: m.name, image, char: m.id, light: lightOf(m.id), vision: prefsOf(m.id).vision }
}

/** Save a new character in this app. Returns an error message, or null. */
export async function addCharacter(name: string, file: Blob): Promise<string | null> {
    const party = await loadParty()
    if (party.length >= MAX_PARTY) return `You can keep up to ${MAX_PARTY} characters. Remove one first.`
    let imageUrl: string
    try {
        imageUrl = await toTokenImage(file)
    } catch {
        return "Couldn't read that picture. Try a PNG or JPEG."
    }
    const member: PartyMember = {
        id: `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        imageUrl,
        name: name.trim().slice(0, 40) || `Character ${party.length + 1}`,
    }
    await saveParty([...party, member])
    notifyPartyChanged()
    return null
}

export async function renameCharacter(id: string, name: string) {
    const clean = name.trim().slice(0, 40)
    if (!clean) return
    const party = await loadParty()
    await saveParty(party.map((m) => (m.id === id ? { ...m, name: clean } : m)))
    notifyPartyChanged()
}

export async function forgetCharacter(id: string) {
    const party = await loadParty()
    await saveParty(party.filter((m) => m.id !== id))
    characterPrefsStore.set((all) => {
        const next = { ...all }
        delete next[id]
        return next
    })
    notifyPartyChanged()
}
