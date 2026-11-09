import React, { useEffect } from "react"
import { useBoardSlice } from "../../utils/board-store"
import { useActiveTool } from "../view-state"
import { FRAME_TOOL_ID, framesStore, openFramesPanel, stopPresenting, useFrames, type Frame } from "./state"
import { FramesPanel } from "./FramesPanel"
import { PresentHud } from "./PresentHud"
import { ShapePicker } from "./ShapePicker"
import { TableModeChrome } from "./TableModeChrome"

const isFrame = (f: unknown): f is Frame => {
    const x = f as Partial<Frame> | null
    return (
        !!x &&
        typeof x.id === "string" &&
        typeof x.title === "string" &&
        [x.x, x.y, x.width, x.height].every((n) => typeof n === "number" && Number.isFinite(n))
    )
}

/** Mounted once: saves frames with the board and hosts the panels and HUDs */
export const TableSlidesLayer: React.FC = () => {
    const frames = useFrames()
    const tool = useActiveTool()

    useBoardSlice<Frame[]>("table-slides:frames", frames, (v) =>
        framesStore.set(Array.isArray(v) ? v.filter(isFrame) : [])
    )

    // The frame tool brings its panel along (without taking focus)
    useEffect(() => {
        if (tool === FRAME_TOOL_ID) openFramesPanel(false)
    }, [tool])

    // A different board was opened: stop presenting the old one
    useEffect(() => {
        const onLoaded = () => stopPresenting()
        window.addEventListener("jewel:boardLoaded", onLoaded)
        return () => window.removeEventListener("jewel:boardLoaded", onLoaded)
    }, [])

    return (
        <>
            <FramesPanel />
            <ShapePicker />
            <TableModeChrome />
            <PresentHud />
        </>
    )
}
