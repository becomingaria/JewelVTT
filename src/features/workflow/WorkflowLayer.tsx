import React, { useEffect } from "react"
import { useBoardSlice } from "../../utils/board-store"
import { useStore } from "../store"
import {
    DEFAULT_LAYER_STATE,
    layerStateStore,
    useLayerState,
    type LayerId,
    type LayerState,
} from "../view-state"
import { AlignBar } from "./AlignBar"
import { CommandPalette } from "./CommandPalette"
import { LayersPanel } from "./LayersPanel"
import { alignBarOpenStore, defaultsOfferStore, paletteOpenStore } from "./state"
import "./workflow.css"

/** Mounted once at the app root: saves layer state, hosts panels and dialogs */
export const WorkflowLayer: React.FC = () => {
    const layers = useLayerState()
    const paletteOpen = useStore(paletteOpenStore)
    const alignOpen = useStore(alignBarOpenStore)

    // Layer visibility/locks are part of the board (files and autosave)
    useBoardSlice<Record<LayerId, LayerState>>("workflow:layers", layers, (saved) => {
        const next = { ...DEFAULT_LAYER_STATE }
        for (const id of Object.keys(next) as LayerId[]) {
            if (saved?.[id]) next[id] = { ...next[id], ...saved[id] }
        }
        layerStateStore.set(next)
    })

    // A brand-new board starts with every layer shown and unlocked. (A
    // loaded board brings its own layer state through the slice above.)
    useEffect(() => {
        const closeTransient = () => {
            alignBarOpenStore.set(false)
            defaultsOfferStore.set(null)
        }
        const reset = () => {
            layerStateStore.set(DEFAULT_LAYER_STATE)
            closeTransient()
        }
        window.addEventListener("clearBoard", reset)
        window.addEventListener("jewel:boardLoaded", closeTransient)
        return () => {
            window.removeEventListener("clearBoard", reset)
            window.removeEventListener("jewel:boardLoaded", closeTransient)
        }
    }, [])

    return (
        <>
            <LayersPanel />
            {alignOpen && <AlignBar />}
            {paletteOpen && <CommandPalette />}
        </>
    )
}
