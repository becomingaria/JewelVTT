import { useEffect, useState } from "react"
import { tokenColour } from "./world-texture"
import type { FogLook } from "./render-fog"
import type { DarkLook } from "./render-light"
import type { Darkness } from "./light-store"

/** Bumps when the theme / contrast settings on <html> change */
export function useThemeTick(): number {
    const [tick, setTick] = useState(0)
    useEffect(() => {
        const mo = new MutationObserver(() => setTick((t) => t + 1))
        mo.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme", "data-high-contrast", "class"],
        })
        return () => mo.disconnect()
    }, [])
    return tick
}

export function fogLook(el: Element, table: boolean): FogLook {
    return {
        table,
        gmFog: tokenColour(el, "--jv-fog", "#2a2638"),
        gmHatch: tokenColour(el, "--jv-fog-hatch", "#0e0c16"),
        stone: tokenColour(el, "--jv-fog-stone", "#3b3746"),
    }
}

/**
 * How dark unlit areas are. The GM view stays lighter so the GM can work;
 * Table Mode is fully dark.
 */
const DARK_ALPHA: Record<Exclude<Darkness, "daylight">, { gm: number; table: number }> = {
    dim: { gm: 0.35, table: 0.6 },
    dark: { gm: 0.6, table: 1 },
}

export function darkLook(el: Element, darkness: Darkness, table: boolean): DarkLook | null {
    if (darkness === "daylight") return null
    const a = DARK_ALPHA[darkness]
    return { alpha: table ? a.table : a.gm, colour: tokenColour(el, "--jv-darkness", "#07060c") }
}
