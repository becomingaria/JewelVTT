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

    useEffect(() => registerFogApi(fogApi), [])

    return active && FOG_KINDS.includes(kind) ? <FogBrushStrip /> : null
}
