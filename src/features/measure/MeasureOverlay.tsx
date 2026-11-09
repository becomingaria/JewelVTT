import React, { useEffect, useMemo, useRef } from "react"
import type { Point } from "../../types/humbug.types"
import type { GridShape } from "../../utils/board-styles"
import type { BoardOverlayProps } from "../types"
import { useCamera, useHumbugs } from "../board-bridge"
import { cellAt, cellKey, cellPolygon, type Cell } from "../grid"
import { MAP_SCALE, useMapKind } from "../map-kind"
import { useStore } from "../store"
import { useActiveTool, useLayerState, useTableMode } from "../view-state"
import {
    boundsOf,
    canRotate,
    formatUnits,
    pathDistance,
    templateCells,
    templateHandle,
    templateOutline,
    type Template,
} from "./geometry"
import { measurePoints, readMeasurement, templateTitle, tokenName, tokensInTemplate, type MeasureReadout } from "./describe"
import { deleteSelected } from "./actions"
import { attachInput } from "./input"
import { RulerStrip, TemplateStrip } from "./OptionsStrip"
import {
    measurePrefsStore,
    measureStore,
    RULER_TOOL,
    selectedTemplateStore,
    TEMPLATE_TOOL,
    templatesStore,
    type Measurement,
} from "./state"
import "./measure.css"

/*
 * Drawn above the humbugs (overlayZ 50). Everything is projected through
 * camera.worldToScreen, so the ruler and templates sit on the floor in the
 * 2.5D view too. Pointer events stay off except for our own controls; the
 * active tool's input is attached to the board container (see input.ts).
 */

type Project = (p: Point) => Point
const pts = (list: Point[], S: Project) =>
    list
        .map((p) => {
            const s = S(p)
            return `${s.x.toFixed(1)},${s.y.toFixed(1)}`
        })
        .join(" ")

// ------------------------------------------------------------------ ruler
const Ruler: React.FC<{
    m: Measurement
    shape: GridShape
    rule: "alternate" | "simple"
    perCell: number
    unit: string
    readout: MeasureReadout
    S: Project
}> = ({ m, shape, rule, perCell, unit, readout, S }) => {
    const points = measurePoints(m)
    const screen = points.map(S)
    const { legs } = pathDistance(points, shape, rule)
    const seen = new Set<string>()
    const cells: Cell[] = []
    for (const p of points) {
        const c = cellAt(p, shape)
        if (!seen.has(cellKey(c))) {
            seen.add(cellKey(c))
            cells.push(c)
        }
    }
    const end = screen[screen.length - 1]
    let running = 0
    return (
        <>
            <svg className='measure-svg' aria-hidden='true'>
                <g className='measure-ruler-cells'>
                    {cells.map((c) => (
                        <polygon key={cellKey(c)} points={pts(cellPolygon(c, shape), S)} />
                    ))}
                </g>
                {screen.slice(1).map((b, i) => {
                    const a = screen[i]
                    const len = Math.hypot(b.x - a.x, b.y - a.y)
                    const block = Math.max(4, len / Math.max(1, legs[i]))
                    return (
                        <g key={i} className='measure-ruler-leg'>
                            <line className='measure-ruler-under' x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                            <line className='measure-ruler-base' x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                            <line
                                className='measure-ruler-blocks'
                                x1={a.x}
                                y1={a.y}
                                x2={b.x}
                                y2={b.y}
                                strokeDasharray={`${block.toFixed(2)} ${block.toFixed(2)}`}
                            />
                        </g>
                    )
                })}
                {screen.map((p, i) => {
                    const r = i === 0 ? 7 : 5
                    return (
                        <g key={i} className={i === 0 ? "measure-pin is-start" : "measure-pin"}>
                            <rect x={p.x - r - 2} y={p.y - r - 2} width={(r + 2) * 2} height={(r + 2) * 2} className='measure-pin-under' />
                            <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} className='measure-pin-top' />
                        </g>
                    )
                })}
            </svg>
            {/* Running totals at the waypoints */}
            {screen.length > 2 &&
                screen.slice(1, -1).map((p, i) => {
                    running += legs[i]
                    return (
                        <div key={i} className='measure-chip' style={{ left: p.x + 10, top: p.y - 30 }} aria-hidden='true'>
                            {formatUnits(running * perCell, unit)}
                        </div>
                    )
                })}
            {screen.length > 1 && end && (
                <div className='measure-label' style={{ left: end.x + 16, top: end.y + 12 }} aria-hidden='true'>
                    <div className='measure-label-main'>
                        <strong>{readout.unitsText}</strong> <span>{readout.cellsText}</span>
                    </div>
                    {readout.speedText && (
                        <div className={`measure-label-speed${readout.over ? " is-over" : ""}`}>
                            <span className='measure-bar'>
                                <span style={{ width: `${Math.min(100, (readout.speedUsed ?? 0) * 100)}%` }} />
                            </span>
                            <span>
                                {readout.over ? "▲ " : ""}
                                {readout.speedText}
                                {readout.over ? " (over)" : ""}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </>
    )
}

// -------------------------------------------------------------- templates
const TemplateShapeSvg: React.FC<{
    t: Template
    cells: Cell[]
    shape: GridShape
    perCell: number
    selected: boolean
    showHandle: boolean
    S: Project
}> = ({ t, cells, shape, perCell, selected, showHandle, S }) => {
    const outline = pts(templateOutline(t, perCell), S)
    const o = S(t.origin)
    const h = showHandle && canRotate(t.shape) ? S(templateHandle(t, perCell)) : null
    return (
        <g className={`measure-tpl${selected ? " is-selected" : ""}`}>
            <g className='measure-tpl-cells'>
                {cells.map((c) => (
                    <polygon key={cellKey(c)} points={pts(cellPolygon(c, shape), S)} />
                ))}
            </g>
            <polygon className='measure-tpl-fill' points={outline} />
            <polygon className='measure-tpl-hatch' points={outline} fill='url(#measure-hatch)' />
            <polygon className='measure-tpl-edge-under' points={outline} />
            <polygon className='measure-tpl-edge' points={outline} />
            {t.shape !== "burst" && t.shape !== "square" && (
                <rect className='measure-tpl-origin' x={o.x - 5} y={o.y - 5} width={10} height={10} />
            )}
            {h && (
                <>
                    <line className='measure-handle-arm' x1={o.x} y1={o.y} x2={h.x} y2={h.y} />
                    <rect className='measure-handle' x={h.x - 7} y={h.y - 7} width={14} height={14} />
                </>
            )}
        </g>
    )
}

const MAX_LISTED = 8

const TemplateCard: React.FC<{
    t: Template
    cells: Cell[]
    shape: GridShape
    perCell: number
    unit: string
    S: Project
    width: number
}> = ({ t, cells, shape, perCell, unit, S, width }) => {
    const humbugs = useHumbugs()
    useLayerState()
    useTableMode() // hidden tokens change with these
    const inside = tokensInTemplate(t, shape, perCell, humbugs, cells)
    const b = boundsOf(templateOutline(t, perCell).map(S))
    const left = Math.max(8, Math.min(b.x2 + 10, width - 230))
    const top = Math.max(8, b.y1)
    return (
        <div className='measure-card' style={{ left, top }} data-measure-ui>
            <div className='measure-card-head'>
                <span className='measure-card-title'>{templateTitle(t, unit)}</span>
                <button type='button' className='measure-x' aria-label='Delete template' title='Delete template (Delete)' onClick={deleteSelected}>
                    ×
                </button>
            </div>
            <div className='measure-card-body'>
                {cells.length} {shape === "hex" ? "hexes" : "squares"}
                {inside.length ? (
                    <ul>
                        {inside.slice(0, MAX_LISTED).map((h) => (
                            <li key={h.id}>{tokenName(h)}</li>
                        ))}
                        {inside.length > MAX_LISTED && <li>and {inside.length - MAX_LISTED} more</li>}
                    </ul>
                ) : (
                    <div className='measure-card-empty'>No tokens inside</div>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------- overlay
export const MeasureOverlay: React.FC<BoardOverlayProps> = ({ camera }) => {
    const tool = useActiveTool()
    const kind = useMapKind()
    const scale = MAP_SCALE[kind]
    const shape = camera.gridShape
    const m = useStore(measureStore)
    const templates = useStore(templatesStore)
    const selectedId = useStore(selectedTemplateStore)
    const prefs = useStore(measurePrefsStore)
    const humbugs = useHumbugs()
    const shared = useCamera()
    const container = camera.container ?? shared?.container ?? null

    // Input: only while one of our tools is active
    const camRef = useRef(camera)
    useEffect(() => {
        camRef.current = camera
    })
    const inputTool = tool === RULER_TOOL || tool === TEMPLATE_TOOL ? tool : null
    useEffect(() => {
        if (!inputTool || !container) return
        return attachInput(container, inputTool, () => camRef.current)
    }, [inputTool, container])

    const cellsById = useMemo(
        () => new Map(templates.map((t) => [t.id, templateCells(t, shape, scale.perCell)])),
        [templates, shape, scale.perCell]
    )

    const S: Project = (p) => camera.worldToScreen(p.x, p.y)
    const readout = m ? readMeasurement(m, shape, prefs.rule, scale, humbugs) : null
    const selected = tool === TEMPLATE_TOOL ? templates.find((t) => t.id === selectedId) : undefined
    const width = container?.clientWidth ?? 800

    return (
        <div className='measure-overlay'>
            {templates.length > 0 && (
                <svg className='measure-svg' aria-hidden='true'>
                    <defs>
                        <pattern id='measure-hatch' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'>
                            <rect className='measure-hatch-line' x='0' y='0' width='2.5' height='8' />
                        </pattern>
                    </defs>
                    {templates.map((t) => (
                        <TemplateShapeSvg
                            key={t.id}
                            t={t}
                            cells={cellsById.get(t.id) ?? []}
                            shape={shape}
                            perCell={scale.perCell}
                            selected={t.id === selected?.id}
                            showHandle={t.id === selected?.id}
                            S={S}
                        />
                    ))}
                </svg>
            )}
            {m && readout && tool === RULER_TOOL && (
                <Ruler m={m} shape={shape} rule={prefs.rule} perCell={scale.perCell} unit={scale.unit} readout={readout} S={S} />
            )}
            {selected && (
                <TemplateCard
                    t={selected}
                    cells={cellsById.get(selected.id) ?? []}
                    shape={shape}
                    perCell={scale.perCell}
                    unit={scale.unit}
                    S={S}
                    width={width}
                />
            )}
            {tool === RULER_TOOL && <RulerStrip shape={shape} readout={m && measurePoints(m).length > 1 ? readout : null} />}
            {tool === TEMPLATE_TOOL && <TemplateStrip scale={scale} />}
        </div>
    )
}
