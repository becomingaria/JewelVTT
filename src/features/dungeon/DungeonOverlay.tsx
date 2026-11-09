import React, { useEffect, useState } from "react"
import type { BoardOverlayProps } from "../types"
import { addHumbugs, viewCentreWorld } from "../board-bridge"
import { cellAt, cellKey, SQUARE, type Cell } from "../grid"
import { MAP_SCALE, useMapKind } from "../map-kind"
import { playSfx } from "../sound"
import { useStore } from "../store"
import { useActiveTool } from "../view-state"
import { PALETTE, stampHumbug } from "./humbugs"
import { ROOMS_TOOL, STAMP_TOOL } from "./model"
import { spriteUrl } from "./sprites"
import { editFloor, pickedStampStore, roomModeStore, type RoomMode } from "./state"

/*
 * Pointer and keyboard input for the room tool and stamp placement. Only
 * mounted while one of those tools is active; the rest of the time the
 * board gets every event as usual.
 */

interface Drag {
    start: Cell
    end: Cell
    /** Corridor bend: true = go across first, then up/down (fixed on first move) */
    across: boolean | null
}

const sameCell = (a: Cell | null, b: Cell | null) => !!a && !!b && a.col === b.col && a.row === b.row

function rectCells(a: Cell, b: Cell): Cell[] {
    const out: Cell[] = []
    for (let row = Math.min(a.row, b.row); row <= Math.max(a.row, b.row); row++)
        for (let col = Math.min(a.col, b.col); col <= Math.max(a.col, b.col); col++) out.push({ col, row })
    return out
}

function corridorCells(a: Cell, b: Cell, across: boolean): Cell[] {
    const out: Cell[] = []
    const bend = across ? { col: b.col, row: a.row } : { col: a.col, row: b.row }
    const walk = (p: Cell, q: Cell) => {
        const dc = Math.sign(q.col - p.col)
        const dr = Math.sign(q.row - p.row)
        let { col, row } = p
        out.push({ col, row })
        while (col !== q.col || row !== q.row) {
            col += dc
            row += dr
            out.push({ col, row })
        }
    }
    walk(a, bend)
    walk(bend, b)
    return out
}

const dragCells = (d: Drag, shape: RoomMode) =>
    shape === "corridor" ? corridorCells(d.start, d.end, d.across ?? true) : rectCells(d.start, d.end)

export const DungeonOverlay: React.FC<BoardOverlayProps> = ({ camera }) => {
    const tool = useActiveTool()
    const active = tool === ROOMS_TOOL || tool === STAMP_TOOL
    if (!active) return null
    return <DungeonInput camera={camera} stampMode={tool === STAMP_TOOL} />
}

const DungeonInput: React.FC<BoardOverlayProps & { stampMode: boolean }> = ({ camera, stampMode }) => {
    const { mode } = useStore(roomModeStore)
    const picked = useStore(pickedStampStore)
    const kind = useMapKind()
    const entry = PALETTE.find((p) => p.id === picked) ?? null

    const [drag, setDrag] = useState<Drag | null>(null)
    const [alt, setAlt] = useState(false)
    const [shift, setShift] = useState(false)
    const [hover, setHover] = useState<Cell | null>(null)
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
    /** Keyboard cursor and the corner fixed with Enter */
    const [cursor, setCursor] = useState<Cell | null>(null)
    const [anchor, setAnchor] = useState<Cell | null>(null)
    const [announce, setAnnounce] = useState("")

    // Alt = erase; Shift = let the board pan underneath
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            setAlt(e.altKey)
            setShift(e.shiftKey)
        }
        const onBlur = () => {
            setAlt(false)
            setShift(false)
        }
        window.addEventListener("keydown", onKey)
        window.addEventListener("keyup", onKey)
        window.addEventListener("blur", onBlur)
        return () => {
            window.removeEventListener("keydown", onKey)
            window.removeEventListener("keyup", onKey)
            window.removeEventListener("blur", onBlur)
        }
    }, [])

    const erase = !stampMode && (mode === "erase" || alt)
    const shape: RoomMode = mode === "corridor" ? "corridor" : "room"

    const cellFromEvent = (e: React.PointerEvent) => {
        const r = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - r.left
        const y = e.clientY - r.top
        setPointer({ x, y })
        return cellAt(camera.containerToWorld(x, y), "square")
    }

    const commit = (d: Drag, eraseIt: boolean) => {
        const keys = dragCells(d, shape).map(cellKey)
        const changed = eraseIt
            ? editFloor([], keys, "Erase floor")
            : editFloor(keys, [], shape === "corridor" ? "Draw corridor" : "Draw room")
        if (changed) {
            playSfx("place")
            setAnnounce(`${eraseIt ? "Erased" : "Added"} ${keys.length} square${keys.length === 1 ? "" : "s"}`)
        }
    }

    const placeStamp = (cell: Cell) => {
        if (!entry) return
        addHumbugs([stampHumbug(entry.stamp, entry.state, cell)])
        playSfx("place")
        setAnnounce(`Placed ${entry.label}`)
    }

    // ---------------------------------------------------------- pointer
    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        const cell = cellFromEvent(e)
        if (stampMode) return placeStamp(cell)
        e.currentTarget.setPointerCapture(e.pointerId)
        setDrag({ start: cell, end: cell, across: null })
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const cell = cellFromEvent(e)
        if (!sameCell(cell, hover)) setHover(cell)
        if (!drag || sameCell(cell, drag.end)) return
        const across =
            drag.across ?? Math.abs(cell.col - drag.start.col) >= Math.abs(cell.row - drag.start.row)
        setDrag({ ...drag, end: cell, across })
    }

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!drag) return
        commit(drag, mode === "erase" || e.altKey)
        setDrag(null)
    }

    // --------------------------------------------------------- keyboard
    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const moves: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
        }
        const here = cursor ?? cellAt(viewCentreWorld(), "square")
        const step = moves[e.key]
        if (step) {
            e.preventDefault()
            e.stopPropagation()
            setCursor({ col: here.col + step[0], row: here.row + step[1] })
            return
        }
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            e.stopPropagation()
            if (stampMode) return placeStamp(here)
            if (!anchor) {
                setCursor(here)
                setAnchor(here)
                setAnnounce("Corner set. Move to the opposite corner and press Enter.")
                return
            }
            commit(
                { start: anchor, end: here, across: Math.abs(here.col - anchor.col) >= Math.abs(here.row - anchor.row) },
                erase
            )
            setAnchor(null)
            return
        }
        if (e.key === "Escape" && anchor) {
            // First Esc drops the half-drawn shape; the next one ends the tool
            e.preventDefault()
            e.stopPropagation()
            setAnchor(null)
        }
    }

    // ---------------------------------------------------------- preview
    const o = camera.worldToScreen(0, 0)
    const ex = camera.worldToScreen(1000, 0)
    const ey = camera.worldToScreen(0, 1000)
    const matrix = `matrix(${(ex.x - o.x) / 1000} ${(ex.y - o.y) / 1000} ${(ey.x - o.x) / 1000} ${(ey.y - o.y) / 1000} ${o.x} ${o.y})`

    const keyDrag: Drag | null = anchor && cursor ? { start: anchor, end: cursor, across: null } : null
    const shown = drag ?? keyDrag
    const previewCells = shown && !stampMode ? dragCells(shown, shape) : []
    const target = cursor ?? hover

    let label: string | null = null
    if (shown && !stampMode) {
        const s = MAP_SCALE[kind]
        const w = Math.abs(shown.end.col - shown.start.col) + 1
        const h = Math.abs(shown.end.row - shown.start.row) + 1
        label =
            shape === "corridor"
                ? `${erase ? "Erase" : "Corridor"} ${previewCells.length} squares (${previewCells.length * s.perCell} ${s.unit})`
                : `${erase ? "Erase" : "Room"} ${w} × ${h} (${w * s.perCell} × ${h * s.perCell} ${s.unit})`
    }

    const help = stampMode
        ? `Placing ${entry?.label ?? "stamps"}. Click a square, or use the arrow keys and Enter. Esc to stop.`
        : "Floor tool. Drag to draw, hold Alt to erase. Keyboard: arrow keys move the cursor, Enter sets a corner, Enter again draws. Esc to stop."

    return (
        <div
            className={`dgn-input ${erase ? "dgn-input--erase" : ""}`}
            style={{ pointerEvents: shift && !drag ? "none" : "auto" }}
            tabIndex={0}
            role='application'
            aria-label={help}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
            onPointerLeave={() => setHover(null)}
            onKeyDown={onKeyDown}
            onBlur={() => {
                setCursor(null)
                setAnchor(null)
            }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <svg className='dgn-preview' aria-hidden='true'>
                <defs>
                    <pattern id='dgn-erase-hatch' width='8' height='8' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'>
                        <rect width='8' height='8' fill='var(--jv-danger, #b3302a)' opacity='0.18' />
                        <path d='M0 0v8' stroke='var(--jv-danger, #b3302a)' strokeWidth='3' opacity='0.55' />
                    </pattern>
                </defs>
                <g transform={matrix}>
                    {previewCells.map((c) => (
                        <rect
                            key={`${c.col},${c.row}`}
                            x={c.col * SQUARE}
                            y={c.row * SQUARE}
                            width={SQUARE}
                            height={SQUARE}
                            className={erase ? "dgn-cell-erase" : "dgn-cell-add"}
                        />
                    ))}
                    {stampMode && entry && target && (
                        <image
                            href={spriteUrl(entry.stamp, entry.state)}
                            x={target.col * SQUARE}
                            y={target.row * SQUARE}
                            width={SQUARE}
                            height={SQUARE}
                            opacity={0.65}
                            style={{ imageRendering: "pixelated" }}
                        />
                    )}
                    {cursor && (
                        <rect
                            x={cursor.col * SQUARE}
                            y={cursor.row * SQUARE}
                            width={SQUARE}
                            height={SQUARE}
                            className='dgn-cursor'
                        />
                    )}
                </g>
            </svg>
            {label && pointer && drag && (
                <div className='dgn-drag-label' style={{ left: pointer.x + 16, top: pointer.y + 16 }}>
                    {label}
                </div>
            )}
            {label && keyDrag && <div className='dgn-drag-label dgn-drag-label--corner'>{label}</div>}
            <div className='dgn-sr' aria-live='polite'>
                {announce}
            </div>
        </div>
    )
}
