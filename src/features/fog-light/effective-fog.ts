import type { CellKey } from "../grid"
import { useStore } from "../store"
import { fogStore, isRevealedKey, type FogState } from "./fog-store"
import { revealLayersStore, type RevealLayer } from "./reveal-store"
import { visionStore } from "./vision"

/*
 * What the fog actually covers: the painted fog, minus cells on visible
 * reveal layers, minus what the party's tokens can see. The renderer, the
 * shared fog API and multiplayer filtering all use this.
 */

let memo: {
    base: FogState
    layers: readonly RevealLayer[]
    vision: ReadonlySet<CellKey>
    out: FogState
} | null = null

export function effectiveFog(
    base: FogState = fogStore.get(),
    layers: readonly RevealLayer[] = revealLayersStore.get(),
    vision: ReadonlySet<CellKey> = visionStore.get()
): FogState {
    if (memo && memo.base === base && memo.layers === layers && memo.vision === vision) return memo.out
    let out = base
    const shown = layers.filter((l) => l.visible && l.cells.size)
    if (base.enabled && (shown.length || vision.size)) {
        const cells = new Set(base.cells)
        const reveal = (k: CellKey) => (base.inverted ? cells.delete(k) : cells.add(k))
        for (const l of shown) l.cells.forEach(reveal)
        vision.forEach(reveal)
        out = { ...base, cells }
    }
    memo = { base, layers, vision, out }
    return out
}

export function useEffectiveFog(): FogState {
    const base = useStore(fogStore)
    const layers = useStore(revealLayersStore)
    const vision = useStore(visionStore)
    return effectiveFog(base, layers, vision)
}

/** Is this cell visible through the fog right now (for everyone)? */
export const isCellVisible = (k: CellKey): boolean => {
    const f = effectiveFog()
    return !f.enabled || isRevealedKey(f, k)
}
