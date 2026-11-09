import React, { useEffect } from "react"
import { humbugsStore, selectionStore, useHumbugs } from "../board-bridge"
import { useMapKind } from "../map-kind"
import { useStore } from "../store"
import { useActiveTool, useTableMode } from "../view-state"
import { useBoardSlice } from "../../utils/board-store"
import { isMarker, setParty } from "./actions"
import { FeaturePanel, TerrainPalette } from "./BuildPanels"
import { GeneratorDialog } from "./GeneratorDialog"
import { LabelDialog } from "./LabelDialog"
import { EMPTY_MAP, sanitizeCells, sanitizeEdges, type HexMap } from "./map-data"
import {
    DEFAULT_TRAVEL,
    mapStore,
    sanitizeTravel,
    setUi,
    TOOL_FEATURES,
    TOOL_TERRAIN,
    TOOL_TRAVEL,
    travelResultStore,
    travelStore,
    uiStore,
} from "./state"
import { TravelHud } from "./TravelHud"
import "./hexcrawl.css"

/** Saves the hex map and travel state with the board */
function useHexSlices() {
    const map = useStore(mapStore)
    const travel = useStore(travelStore)
    useBoardSlice("hexcrawl:terrain", map.cells, (cells) =>
        mapStore.set((m) => ({ ...m, cells: sanitizeCells(cells) }))
    )
    useBoardSlice<Pick<HexMap, "rivers" | "roads">, { rivers: string[]; roads: string[] }>(
        "hexcrawl:paths",
        { rivers: map.rivers, roads: map.roads },
        (p) =>
            mapStore.set((m) => ({
                ...m,
                rivers: p?.rivers ?? {},
                roads: p?.roads ?? {},
            })),
        {
            serialize: (p) => ({ rivers: Object.keys(p.rivers), roads: Object.keys(p.roads) }),
            deserialize: (s) => ({ rivers: sanitizeEdges(s?.rivers), roads: sanitizeEdges(s?.roads) }),
        }
    )
    useBoardSlice("hexcrawl:travel", travel, (t) => {
        travelStore.set(t ? sanitizeTravel(t) : DEFAULT_TRAVEL)
        travelResultStore.set(null)
    })

    // New board: start from a blank map
    useEffect(() => {
        const clear = () => {
            mapStore.set(EMPTY_MAP)
            travelStore.set(DEFAULT_TRAVEL)
            travelResultStore.set(null)
        }
        window.addEventListener("clearBoard", clear)
        return () => window.removeEventListener("clearBoard", clear)
    }, [])
}

/** App-level pieces: saving, tool panels, the travel HUD and dialogs */
export const HexLayer: React.FC = () => {
    useHexSlices()
    const kind = useMapKind()
    const tool = useActiveTool()
    const tableMode = useTableMode()
    const travel = useStore(travelStore)
    const { hudHidden } = useStore(uiStore)
    const humbugs = useHumbugs()
    const partyExists = !!travel.partyId && humbugs.some((h) => h.id === travel.partyId)

    // Picking the travel tool: show the HUD, and adopt a selected token as
    // the party if there isn't one yet
    useEffect(() => {
        if (tool !== TOOL_TRAVEL) return
        if (uiStore.get().hudHidden) setUi({ hudHidden: false })
        const t = travelStore.get()
        const all = humbugsStore.get()
        if (t.partyId && all.some((h) => h.id === t.partyId)) return
        const sel = selectionStore.get()
        const h = sel.length === 1 ? all.find((x) => x.id === sel[0]) : undefined
        if (h && !isMarker(h)) setParty(h)
    }, [tool])

    const hex = kind === "hexcrawl"
    return (
        <>
            {hex && !tableMode && tool === TOOL_TERRAIN && <TerrainPalette />}
            {hex && !tableMode && tool === TOOL_FEATURES && <FeaturePanel />}
            {hex && (tool === TOOL_TRAVEL || (partyExists && !hudHidden)) && <TravelHud />}
            <GeneratorDialog />
            <LabelDialog />
        </>
    )
}
