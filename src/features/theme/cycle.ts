import type { Humbug } from "../../types/humbug.types"

/*
 * Colour cycling: the old palette-shifting trick for water, lava, magic and
 * acid. Stored per humbug in ext.theme.cycle (saved with the board).
 */

export type CycleId = "water" | "lava" | "magic" | "acid"

export const CYCLES: { id: CycleId; label: string }[] = [
    { id: "water", label: "Water" },
    { id: "lava", label: "Lava" },
    { id: "magic", label: "Magic" },
    { id: "acid", label: "Acid" },
]

const IDS = new Set<string>(CYCLES.map((c) => c.id))

/** Only flat colour areas and maps can shimmer */
export const canCycle = (h: Humbug) => h.type === "solid-color" || h.type === "map"

export function cycleOf(h: Humbug): CycleId | null {
    const ext = h.ext?.theme as { cycle?: unknown } | undefined
    const id = ext?.cycle
    return typeof id === "string" && IDS.has(id) ? (id as CycleId) : null
}

/** The humbug's ext with the cycle set (or removed when null) */
export function extWithCycle(h: Humbug, cycle: CycleId | null): Record<string, unknown> | undefined {
    const ext = { ...(h.ext ?? {}) }
    const own = { ...((ext.theme as Record<string, unknown> | undefined) ?? {}) }
    if (cycle) own.cycle = cycle
    else delete own.cycle
    if (Object.keys(own).length) ext.theme = own
    else delete ext.theme
    return Object.keys(ext).length ? ext : undefined
}
