import React, { useEffect } from "react"
import { useBoardSlice } from "../../utils/board-store"
import { useMapKind } from "../map-kind"
import { useStore } from "../store"
import { activeToolStore, useActiveTool, useTableMode } from "../view-state"
import { GeneratorPanel } from "./GeneratorPanel"
import { ROOMS_TOOL, STAMP_TOOL } from "./model"
import { RoomStrip } from "./RoomStrip"
import { StampPalette } from "./StampPalette"
import { StarterPanel } from "./StarterPanel"
import { floorStore, paletteOpenStore, panelStore } from "./state"
import type { FloorSet } from "./walls"
import "./dungeon.css"

const toArray = (s: FloorSet) => [...s]
const toSet = (stored: unknown): FloorSet =>
    new Set(Array.isArray(stored) ? stored.filter((k): k is string => typeof k === "string") : [])

/** Mounted once: saves the floor with the board and shows the dungeon panels */
export const DungeonLayer: React.FC = () => {
    const floor = useStore(floorStore)
    const kind = useMapKind()
    const tool = useActiveTool()
    const tableMode = useTableMode()
    const paletteOpen = useStore(paletteOpenStore)
    const panel = useStore(panelStore)

    useBoardSlice<FloorSet, string[]>(
        "dungeon:floor",
        floor,
        (v) => floorStore.set(v ?? new Set()),
        { serialize: toArray, deserialize: toSet }
    )

    // The floor and stamp tools only exist on dungeon maps
    useEffect(() => {
        if (kind === "dungeon") return
        const t = activeToolStore.get()
        if (t === ROOMS_TOOL || t === STAMP_TOOL) activeToolStore.set(null)
    }, [kind])

    // Editing chrome stays out of the players' view
    if (tableMode) return null

    return (
        <>
            {tool === ROOMS_TOOL && kind === "dungeon" && <RoomStrip />}
            {paletteOpen && kind === "dungeon" && <StampPalette />}
            {panel === "generator" && <GeneratorPanel />}
            {panel === "starters" && <StarterPanel />}
        </>
    )
}
