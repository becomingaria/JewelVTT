import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useHumbugs } from "../board-bridge"
import { cellAt, cellCenter, cellKey, cellsWithin, type Cell } from "../grid"
import { useMapKind } from "../map-kind"
import { fog } from "../services"
import { useStore } from "../store"
import type { BoardOverlayProps } from "../types"
import { isHumbugHidden, useActiveTool, useTableMode } from "../view-state"
import type { Humbug, Point } from "../../types/humbug.types"
import { humbugFootprint } from "../../utils/humbug.utils"
import {
    fmtMiles,
    humbugCell,
    isMarker,
    moveParty,
    partyToken,
    placeMarker,
    setParty,
} from "./actions"
import { mergeDiff, hasPath, type MapDiff } from "./map-data"
import { brushUndoLabel, dab, hexLine } from "./paint"
import { hexPath, worldMatrix } from "./render"
import {
    labelDraft,
    mapStore,
    pushMapUndo,
    TOOL_FEATURES,
    TOOL_TERRAIN,
    TOOL_TRAVEL,
    travelStore,
    uiStore,
} from "./state"
import { isWater } from "./terrain"
import { moveCostMiles, neighboursByDirection } from "./travel"
import { useContainerSize } from "./hooks"

const MY_TOOLS = [TOOL_TERRAIN, TOOL_FEATURES, TOOL_TRAVEL]

/** Topmost visible humbug under a world point (not a map marker) */
function humbugAt(humbugs: readonly Humbug[], p: Point): Humbug | undefined {
    return [...humbugs]
        .filter((h) => !isMarker(h) && !isHumbugHidden(h))
        .sort((a, b) => b.zIndex - a.zIndex)
        .find((h) => {
            const s = humbugFootprint(h)
            return p.x >= h.position.x && p.x <= h.position.x + s.width && p.y >= h.position.y && p.y <= h.position.y + s.height
        })
}

const BRUSH_LABEL: Record<string, string> = {
    river: "Drag across hexes to draw a river",
    road: "Drag across hexes to draw a road",
}

/** Pointer input for the terrain, feature and travel tools, plus hover hints */
export const HexOverlay: React.FC<BoardOverlayProps> = ({ camera }) => {
    const tool = useActiveTool()
    const kind = useMapKind()
    const ui = useStore(uiStore)
    const map = useStore(mapStore)
    const travel = useStore(travelStore)
    const humbugs = useHumbugs()
    const tableMode = useTableMode()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const size = useContainerSize(camera.container)
    const [hover, setHover] = useState<Cell | null>(null)
    const [shiftHeld, setShiftHeld] = useState(false)
    const stroke = useRef<{ diff: MapDiff; last: Cell; pointer: number } | null>(null)

    const active = kind === "hexcrawl" && !!tool && MY_TOOLS.includes(tool)

    // Shift is "hold to pan": let the board have the pointer meanwhile
    useEffect(() => {
        if (!active) return
        // Keys say when Shift goes down/up; pointer moves correct any missed key-up
        const key = (e: KeyboardEvent | PointerEvent) => setShiftHeld(e.shiftKey)
        const blur = () => setShiftHeld(false)
        window.addEventListener("keydown", key)
        window.addEventListener("keyup", key)
        window.addEventListener("pointermove", key, true)
        window.addEventListener("blur", blur)
        return () => {
            window.removeEventListener("keydown", key)
            window.removeEventListener("keyup", key)
            window.removeEventListener("pointermove", key, true)
            window.removeEventListener("blur", blur)
        }
    }, [active])

    const endStroke = useCallback(() => {
        const s = stroke.current
        stroke.current = null
        if (!s) return
        pushMapUndo(s.diff, brushUndoLabel(uiStore.get().brush))
    }, [])

    // Tool switched mid-stroke: keep what was painted as one undo step
    useEffect(() => {
        if (tool !== TOOL_TERRAIN) endStroke()
    }, [tool, endStroke])

    const toWorld = (e: React.PointerEvent) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        return camera.containerToWorld(e.clientX - r.left, e.clientY - r.top)
    }

    const onPointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0 || e.shiftKey) return
        const world = toWorld(e)
        const cell = cellAt(world, "hex")
        e.preventDefault()
        if (tool === TOOL_TERRAIN) {
            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
            const { brush, size: s } = uiStore.get()
            stroke.current = { diff: dab(brush, s, cell, null), last: cell, pointer: e.pointerId }
        } else if (tool === TOOL_FEATURES) {
            const { marker, autoNumber } = uiStore.get()
            placeMarker(cell, marker, labelDraft.get(), autoNumber)
            labelDraft.set("")
        } else if (tool === TOOL_TRAVEL) {
            const party = partyToken()
            if (!party) {
                const h = humbugAt(humbugs, world)
                if (h) setParty(h)
                return
            }
            moveParty(cell)
        }
    }

    const onPointerMove = (e: React.PointerEvent) => {
        const cell = cellAt(toWorld(e), "hex")
        setHover((h) => (h && cellKey(h) === cellKey(cell) ? h : cell))
        const s = stroke.current
        if (!s || s.pointer !== e.pointerId || cellKey(cell) === cellKey(s.last)) return
        const { brush, size: sz } = uiStore.get()
        let prev = s.last
        for (const c of hexLine(s.last, cell)) {
            s.diff = mergeDiff(s.diff, dab(brush, sz, c, prev))
            prev = c
        }
        s.last = cell
    }

    const onPointerUp = (e: React.PointerEvent) => {
        if (stroke.current?.pointer === e.pointerId) endStroke()
    }

    // ---------------------------------------------------------- hints
    const party = active && tool === TOOL_TRAVEL ? partyToken() : undefined
    useLayoutEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const dpr = window.devicePixelRatio || 1
        const W = Math.round(size.w * dpr)
        const H = Math.round(size.h * dpr)
        if (canvas.width !== W) canvas.width = W
        if (canvas.height !== H) canvas.height = H
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, W, H)
        if (!active) return
        const m = worldMatrix(camera)
        const toWorldCtx = () => ctx.setTransform(dpr * m.a, dpr * m.b, dpr * m.c, dpr * m.d, dpr * m.e, dpr * m.f)
        const outline = (cells: Cell[], colour: string, width: number, fill?: string) => {
            toWorldCtx()
            ctx.beginPath()
            cells.forEach((c) => hexPath(ctx, c))
            if (fill) {
                ctx.fillStyle = fill
                ctx.fill()
            }
            ctx.setLineDash([])
            ctx.strokeStyle = colour
            ctx.lineWidth = width / camera.scale
            ctx.stroke()
        }
        const text = (p: Point, s: string, strong: boolean) => {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            const q = camera.worldToScreen(p.x, p.y)
            ctx.font = `700 ${Math.round(Math.max(10, Math.min(14, 32 * camera.scale * 0.3)))}px ui-monospace, monospace`
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            const w = ctx.measureText(s).width + 8
            ctx.fillStyle = strong ? "#2a1e14" : "rgba(247, 239, 220, 0.95)"
            ctx.fillRect(q.x - w / 2, q.y - 9, w, 18)
            ctx.strokeStyle = "#2a1e14"
            ctx.lineWidth = 1
            ctx.strokeRect(q.x - w / 2 + 0.5, q.y - 8.5, w - 1, 17)
            ctx.fillStyle = strong ? "#fff6e0" : "#2a1e14"
            ctx.fillText(s, q.x, q.y + 0.5)
        }

        if (tool === TOOL_TRAVEL && party) {
            const at = humbugCell(party)
            outline([at], "#2a1e14", 3.5)
            outline([at], "#ffd84a", 1.6)
            for (const { cell } of neighboursByDirection(at)) {
                const hidden = tableMode && fog.enabled() && !fog.isRevealed(cell)
                const t = map.cells[cellKey(cell)]
                const isHover = !!hover && cellKey(hover) === cellKey(cell)
                outline([cell], "#2a1e14", isHover ? 3 : 1.5, isHover ? "rgba(255, 216, 74, 0.25)" : undefined)
                const c = cellCenter(cell, "hex")
                const label = hidden
                    ? "?"
                    : isWater(t)
                      ? "✕"
                      : `${fmtMiles(moveCostMiles(t, hasPath(map, "road", at, cell)))} mi`
                text(c, label, isHover)
            }
        } else if (hover) {
            if (tool === TOOL_TERRAIN) {
                const b = ui.brush
                const cells = b === "river" || b === "road" || b === "erase-paths" ? [hover] : cellsWithin(hover, ui.size - 1, "hex")
                outline(cells, "#2a1e14", 2.5)
                outline(cells, "#fff6e0", 1)
            } else if (tool === TOOL_FEATURES) {
                outline([hover], "#2a1e14", 2.5, "rgba(255, 246, 224, 0.3)")
            } else if (tool === TOOL_TRAVEL) {
                outline([hover], "#2a1e14", 2)
            }
        }
    }, [active, tool, camera, size, hover, ui.brush, ui.size, map, party, tableMode, travel])

    if (!active) return null
    const title =
        tool === TOOL_TERRAIN
            ? (BRUSH_LABEL[ui.brush] ?? "Click or drag to paint hexes")
            : tool === TOOL_FEATURES
              ? "Click a hex to place the marker"
              : party
                ? "Click a neighbouring hex to travel"
                : "Click the party's token to choose it"
    return (
        <div
            className='hx-overlay'
            style={{ pointerEvents: shiftHeld ? "none" : "auto", cursor: "crosshair" }}
            title={title}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => setHover(null)}
        >
            <canvas ref={canvasRef} aria-hidden='true' style={{ width: size.w, height: size.h }} />
        </div>
    )
}
