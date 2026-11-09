import React, { useEffect, useState } from "react"
import type { BoardOverlayProps } from "../types"
import { cameraStore, GRID_SIZE } from "../board-bridge"
import { useActiveTool, useTableMode } from "../view-state"
import type { Point } from "../../types/humbug.types"
import {
    addFrame,
    commitFrames,
    FRAME_TOOL_ID,
    framesStore,
    MIN_FRAME,
    nextSlide,
    patchFrameLive,
    prevSlide,
    requestRename,
    useFrames,
    usePresent,
    type Frame,
    type Rect,
} from "./state"
import { FrameOutlines, FrameTab } from "./FramesUnderlay"

/** Pointer -> world point through the live camera */
function toWorld(e: { clientX: number; clientY: number }): Point | null {
    const cam = cameraStore.get()
    const el = cam?.container
    if (!cam || !el) return null
    const r = el.getBoundingClientRect()
    return cam.containerToWorld(e.clientX - r.left, e.clientY - r.top)
}

/** Half-square snapping keeps frames tidy; hold Alt for free placement */
const snap = (v: number, free: boolean) => (free ? v : Math.round(v / (GRID_SIZE / 2)) * (GRID_SIZE / 2))

/** Rect spanning two corners; keeps `fixed` in place and the minimum size */
function spanRect(fixed: Point, moving: Point, min = 0): Rect {
    const w = Math.max(min, Math.abs(moving.x - fixed.x))
    const h = Math.max(min, Math.abs(moving.y - fixed.y))
    return {
        x: moving.x < fixed.x ? fixed.x - w : fixed.x,
        y: moving.y < fixed.y ? fixed.y - h : fixed.y,
        width: w,
        height: h,
    }
}

/** Track a mouse drag in world units until release */
function trackDrag(e: React.MouseEvent, onMove: (p: Point, d: Point, ev: MouseEvent) => void, onUp: () => void) {
    e.preventDefault()
    e.stopPropagation()
    const start = toWorld(e)
    if (!start) return
    const move = (ev: MouseEvent) => {
        const p = toWorld(ev)
        if (p) onMove(p, { x: p.x - start.x, y: p.y - start.y }, ev)
    }
    const up = () => {
        window.removeEventListener("mousemove", move)
        window.removeEventListener("mouseup", up)
        onUp()
    }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", up)
}

type Corner = "nw" | "ne" | "se" | "sw"
const CORNERS: Corner[] = ["nw", "ne", "se", "sw"]

const cornerOf = (f: Rect, c: Corner): Point => ({
    x: c === "nw" || c === "sw" ? f.x : f.x + f.width,
    y: c === "nw" || c === "ne" ? f.y : f.y + f.height,
})
const OPPOSITE: Record<Corner, Corner> = { nw: "se", ne: "sw", se: "nw", sw: "ne" }

/** Frame tool: drag empty board to add a frame, drag tabs to move, corners to resize */
const FrameEditor: React.FC<BoardOverlayProps> = ({ camera }) => {
    const frames = useFrames()
    const [draft, setDraft] = useState<Rect | null>(null)
    const [shiftHeld, setShiftHeld] = useState(false)

    // Shift lets the board pan straight through the tool
    useEffect(() => {
        const on = (e: KeyboardEvent) => setShiftHeld(e.shiftKey)
        const off = () => setShiftHeld(false)
        window.addEventListener("keydown", on)
        window.addEventListener("keyup", on)
        window.addEventListener("blur", off)
        return () => {
            window.removeEventListener("keydown", on)
            window.removeEventListener("keyup", on)
            window.removeEventListener("blur", off)
        }
    }, [])

    const onBackgroundDown = (e: React.MouseEvent) => {
        if (e.button !== 0 || e.shiftKey || e.target !== e.currentTarget) return
        const a0 = toWorld(e)
        if (!a0) return
        const a = { x: snap(a0.x, e.altKey), y: snap(a0.y, e.altKey) }
        let rect: Rect | null = null
        trackDrag(
            e,
            (p, _d, ev) => {
                rect = spanRect(a, { x: snap(p.x, ev.altKey), y: snap(p.y, ev.altKey) })
                setDraft(rect)
            },
            () => {
                setDraft(null)
                const r = rect as Rect | null
                if (r && r.width >= MIN_FRAME && r.height >= MIN_FRAME) addFrame(r)
            }
        )
    }

    const onTabDown = (e: React.MouseEvent, f: Frame) => {
        if (e.button !== 0 || e.shiftKey) return
        const prev = framesStore.get()
        trackDrag(
            e,
            (_p, d, ev) => patchFrameLive(f.id, { x: snap(f.x + d.x, ev.altKey), y: snap(f.y + d.y, ev.altKey) }),
            () => {
                const now = framesStore.get()
                const cur = now.find((x) => x.id === f.id)
                if (cur && (cur.x !== f.x || cur.y !== f.y)) commitFrames(now, "Move frame", prev)
            }
        )
    }

    const onCornerDown = (e: React.MouseEvent, f: Frame, c: Corner) => {
        if (e.button !== 0 || e.shiftKey) return
        const prev = framesStore.get()
        const fixed = cornerOf(f, OPPOSITE[c])
        const from = cornerOf(f, c)
        trackDrag(
            e,
            (_p, d, ev) =>
                patchFrameLive(
                    f.id,
                    spanRect(fixed, { x: snap(from.x + d.x, ev.altKey), y: snap(from.y + d.y, ev.altKey) }, MIN_FRAME)
                ),
            () => {
                const now = framesStore.get()
                const cur = now.find((x) => x.id === f.id)
                if (cur && (cur.x !== f.x || cur.y !== f.y || cur.width !== f.width || cur.height !== f.height)) {
                    commitFrames(now, "Resize frame", prev)
                }
            }
        )
    }

    return (
        <div
            className={`ts-editor ${shiftHeld ? "ts-editor--pan" : ""}`}
            onMouseDown={onBackgroundDown}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Outlines above the humbugs so frames stay visible while editing */}
            <FrameOutlines frames={frames} camera={camera} className='ts-editor-outlines' />
            {draft && <FrameOutlines frames={[{ id: "draft", title: "", ...draft }]} camera={camera} className='ts-editor-draft' />}
            {frames.map((f, i) => (
                <React.Fragment key={f.id}>
                    <FrameTab
                        frame={f}
                        index={i}
                        camera={camera}
                        className='ts-frame-tab--grab'
                        title='Drag to move · double-click to rename'
                        onMouseDown={(e) => onTabDown(e, f)}
                        onDoubleClick={() => requestRename(f.id)}
                    />
                    {CORNERS.map((c) => {
                        const p = camera.worldToScreen(cornerOf(f, c).x, cornerOf(f, c).y)
                        return (
                            <div
                                key={c}
                                className={`ts-corner ts-corner--${c}`}
                                style={{ left: p.x, top: p.y }}
                                title='Drag to resize'
                                onMouseDown={(e) => onCornerDown(e, f, c)}
                            />
                        )
                    })}
                </React.Fragment>
            ))}
            <div className='ts-editor-hint' role='status'>
                Drag to add a frame · drag a tab to move · corners resize · <kbd>Esc</kbd> to finish
            </div>
        </div>
    )
}

/** While presenting: the whole board is one big "next" button */
const PresentCatcher: React.FC = () => (
    <div
        className='ts-present-catcher'
        aria-hidden='true'
        onMouseDown={(e) => e.button === 0 && e.preventDefault()}
        onClick={(e) => {
            e.stopPropagation()
            nextSlide()
        }}
        onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            prevSlide()
        }}
    />
)

export const FramesOverlay: React.FC<BoardOverlayProps> = ({ camera }) => {
    const present = usePresent()
    const tool = useActiveTool()
    const tableMode = useTableMode()
    if (present) return <PresentCatcher />
    if (tool !== FRAME_TOOL_ID || tableMode) return null
    return <FrameEditor camera={camera} />
}
