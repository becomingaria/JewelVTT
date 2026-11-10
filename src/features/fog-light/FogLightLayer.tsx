import React, { useEffect } from "react"
import { useBoardSlice } from "../../utils/board-store"
import { registerFogApi } from "../services"
import { useStore } from "../store"
import { useActiveTool } from "../view-state"
import { useMapKind } from "../map-kind"
import { FOG_KINDS, FOG_TOOL_ID } from "./ids"
import {
    EMPTY_FOG,
    deserializeFog,
    fogApi,
    fogStore,
    serializeFog,
    type FogSaved,
    type FogState,
} from "./fog-store"
import { darknessStore, parseDarkness, type Darkness } from "./light-store"
import { FogBrushStrip } from "./FogBrushStrip"
import { cellKey } from "../grid"
import { isRevealedKey, fogShape } from "./fog-store"
import { effectiveFog } from "./effective-fog"
import { deserializeReveals, revealLayersStore, serializeReveals, type RevealLayer } from "./reveal-store"
import { recomputeVision, setVisionShapeSource } from "./vision"

/** App-level: saves fog and darkness with the board, shows the brush strip */
export const FogLightLayer: React.FC = () => {
    const fog = useStore(fogStore)
    const darkness = useStore(darknessStore)
    const active = useActiveTool() === FOG_TOOL_ID
    const kind = useMapKind()

    useBoardSlice<FogState, FogSaved>("fog-light:fog", fog, (v) => fogStore.set(v ?? EMPTY_FOG), {
        serialize: serializeFog,
        deserialize: deserializeFog,
    })
    useBoardSlice<Darkness>("fog-light:darkness", darkness, (v) => darknessStore.set(parseDarkness(v)))
    const reveals = useStore(revealLayersStore)
    useBoardSlice<readonly RevealLayer[], unknown>(
        "fog-light:reveals",
        reveals,
        (v) => revealLayersStore.set(v ?? []),
        { serialize: serializeReveals, deserialize: deserializeReveals }
    )

    useEffect(() => {
        // Vision cells live on the fog's grid
        setVisionShapeSource(() => fogShape())
        const unsubscribe = fogStore.subscribe(recomputeVision)
        // Other features see the fog as players do: reveal layers and vision included
        registerFogApi({
            ...fogApi,
            isRevealed: (cell) => {
                const s = effectiveFog()
                return !s.enabled || isRevealedKey(s, cellKey(cell))
            },
        })
        return unsubscribe
    }, [])

    return active && FOG_KINDS.includes(kind) ? <FogBrushStrip /> : null
}
