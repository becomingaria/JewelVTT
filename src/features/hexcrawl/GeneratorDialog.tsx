import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef } from "react"
import { addHumbugs, humbugsStore, removeHumbugs, undoGroup } from "../board-bridge"
import { cellCenter, cellKey, parseCellKey } from "../grid"
import { fog, logEvent } from "../services"
import { useStore } from "../store"
import { showToast } from "../../utils/toast"
import { flyTo } from "../../utils/view-events"
import { HEX_R, HEX_W } from "../../utils/humbug.utils"
import { hexExt, humbugCell, markerHumbug } from "./actions"
import {
    DEFAULT_SETTINGS,
    generateOverland,
    generatedArea,
    LIMITS,
    randomSeed,
    type GeneratedMap,
    type GeneratorSettings,
} from "./generator"
import { useDialogFocus } from "./hooks"
import { parseEdgeKey } from "./map-data"
import { MARKERS } from "./markers"
import { changeMap, generatorOpenStore, mapStore, setUi, travelStore, uiStore } from "./state"
import { TERRAINS, terrainDef } from "./terrain"
import { hexNumber } from "./travel"
import { CLIMATES, type Climate } from "./weather"

type GenUi = GeneratorSettings & { replace: boolean; fog: boolean }

const GEN_DEFAULTS: GenUi = { ...DEFAULT_SETTINGS, replace: true, fog: false }

const SETTLEMENT = new Set(MARKERS.filter((m) => m.group === "settlement").map((m) => m.kind))

function drawPreview(canvas: HTMLCanvasElement, s: GeneratorSettings, g: GeneratedMap) {
    const dpr = window.devicePixelRatio || 1
    const W = canvas.clientWidth || 320
    const H = canvas.clientHeight || 220
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    const ctx = canvas.getContext("2d")!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = "#e6d4aa"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const o = cellCenter(s.origin, "hex")
    const worldW = (s.width + 0.5) * HEX_W
    const worldH = (s.height - 1) * HEX_R * 1.5 + HEX_R * 2
    const k = Math.min(W / worldW, H / worldH) * 0.96
    const ox = (W - worldW * k) / 2 - (o.x - HEX_W / 2) * k
    const oy = (H - worldH * k) / 2 - (o.y - HEX_R) * k
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy)
    const byTerrain = new Map<string, Path2D>()
    for (const [key, t] of Object.entries(g.cells)) {
        const c = cellCenter(parseCellKey(key), "hex")
        let p = byTerrain.get(t)
        if (!p) byTerrain.set(t, (p = new Path2D()))
        for (let i = 0; i < 6; i++) {
            const a = ((60 * i - 90) * Math.PI) / 180
            const x = c.x + (HEX_R + 0.4) * Math.cos(a)
            const y = c.y + (HEX_R + 0.4) * Math.sin(a)
            if (i === 0) p.moveTo(x, y)
            else p.lineTo(x, y)
        }
        p.closePath()
    }
    for (const [t, p] of byTerrain) {
        ctx.fillStyle = terrainDef(t as never).palette.base
        ctx.fill(p)
    }
    const line = (edges: string[], colour: string, width: number, dash: number[] = []) => {
        ctx.beginPath()
        for (const e of edges) {
            const [a, b] = parseEdgeKey(e).map((c) => cellCenter(c, "hex"))
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
        }
        ctx.setLineDash(dash)
        ctx.strokeStyle = colour
        ctx.lineWidth = width
        ctx.stroke()
        ctx.setLineDash([])
    }
    line(g.rivers, "#1d5aa6", 5)
    line(g.roads, "#5a3412", 4, [8, 6])
    for (const m of g.markers) {
        const c = cellCenter(m.cell, "hex")
        ctx.fillStyle = SETTLEMENT.has(m.kind) ? "#ffffff" : "#1a1410"
        ctx.strokeStyle = SETTLEMENT.has(m.kind) ? "#1a1410" : "#ffffff"
        ctx.lineWidth = 3
        if (SETTLEMENT.has(m.kind)) {
            ctx.fillRect(c.x - 9, c.y - 9, 18, 18)
            ctx.strokeRect(c.x - 9, c.y - 9, 18, 18)
        } else {
            // Sites are diamonds, so they differ by shape as well as colour
            ctx.beginPath()
            ctx.moveTo(c.x, c.y - 11)
            ctx.lineTo(c.x + 11, c.y)
            ctx.lineTo(c.x, c.y + 11)
            ctx.lineTo(c.x - 11, c.y)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
        }
    }
}

function summary(g: GeneratedMap) {
    const vals = Object.values(g.cells)
    const parts = TERRAINS.map((t) => [t.label, vals.filter((v) => v === t.id).length] as const)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([l, n]) => `${l} ${Math.round((n / vals.length) * 100)}%`)
    const settle = g.markers.filter((m) => SETTLEMENT.has(m.kind)).length
    return `${parts.join(", ")}. ${settle} settlements, ${g.markers.length - settle} sites, ${g.rivers.length ? "rivers" : "no rivers"}${g.roads.length ? " and roads" : ""}.`
}

function applyGenerated(s: GenUi, g: GeneratedMap) {
    const area = generatedArea(s)
    const areaKeys = new Set(area.map(cellKey))
    const m = mapStore.get()
    const touches = (e: string) => e.split("|").some((k) => areaKeys.has(k))
    const paths = (existing: Record<string, true>, fresh: string[]) => {
        const out: Record<string, boolean> = {}
        for (const e of Object.keys(existing)) if (touches(e)) out[e] = false
        for (const e of fresh) out[e] = true
        return out
    }
    let fogNote = ""
    // Terrain, old/new markers and fog: all one undo step
    undoGroup("Generate overland map", () => {
        changeMap(
            {
                cells: Object.fromEntries(area.map((c) => [cellKey(c), g.cells[cellKey(c)]])),
                rivers: paths(m.rivers, g.rivers),
                roads: paths(m.roads, g.roads),
            },
            "Generate overland map"
        )
        if (s.replace) {
            const old = humbugsStore
                .get()
                .filter((h) => hexExt(h)?.generated && areaKeys.has(cellKey(humbugCell(h))))
                .map((h) => h.id)
            if (old.length) removeHumbugs(old)
        }
        if (g.markers.length)
            addHumbugs(
                g.markers.map((mk) =>
                    markerHumbug(mk.cell, { marker: mk.kind, label: mk.label, number: hexNumber(mk.cell), generated: true })
                )
            )
        if (s.fog) {
            fog.hide(area)
            if (!fog.enabled()) fogNote = " Fog isn't available on this board, so nothing was hidden."
        }
    })
    // The map's climate drives the weather table from now on
    travelStore.set((t) => ({ ...t, climate: s.climate }))

    const first = cellCenter(s.origin, "hex")
    const last = cellCenter({ col: s.origin.col + s.width - 1, row: s.origin.row + s.height - 1 }, "hex")
    const w = window.innerWidth - 160
    const h = window.innerHeight - 160
    const zoom = Math.max(0.1, Math.min(3, Math.min(w / (last.x - first.x + HEX_W * 2), h / (last.y - first.y + HEX_R * 4))))
    flyTo({ x: (first.x + last.x) / 2, y: (first.y + last.y) / 2, zoom })

    logEvent({
        kind: "system",
        text: `Generated a ${s.width}×${s.height} ${s.climate} overland map (seed “${s.seed}”).`,
    })
    showToast(`Map generated (hexes ${hexNumber(s.origin)}–${hexNumber({ col: s.origin.col + s.width - 1, row: s.origin.row + s.height - 1 })}). Undo takes it back.${fogNote}`)
}

const NumberField: React.FC<{
    label: string
    value: number
    min: number
    max: number
    onChange: (n: number) => void
}> = ({ label, value, min, max, onChange }) => (
    <label className='hx-field'>
        <span>{label}</span>
        <input
            type='number'
            min={min}
            max={max}
            value={value}
            onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, Math.round(n))))
            }}
        />
    </label>
)

/** Overland generator (Shift+X) */
export const GeneratorDialog: React.FC = () => {
    const open = useStore(generatorOpenStore)
    const ui = useStore(uiStore)
    const ref = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const s: GenUi = { ...GEN_DEFAULTS, ...ui.gen }
    if (!s.seed) s.seed = "jewel"
    const set = (patch: Partial<GenUi>) => setUi({ gen: { ...s, ...patch } })
    const close = useCallback(() => generatorOpenStore.set(false), [])
    useDialogFocus(open, ref, close)

    const deferred = useDeferredValue(s)
    const key = JSON.stringify([deferred.seed, deferred.width, deferred.height, deferred.climate, deferred.water, deferred.mountains, deferred.settlements, deferred.dungeons, deferred.roads])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures every input
    const map = useMemo(() => (open ? generateOverland(deferred) : null), [open, key])

    useEffect(() => {
        if (canvasRef.current && map) drawPreview(canvasRef.current, deferred, map)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map])

    if (!open) return null
    return (
        <div className='hx-backdrop' onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <div ref={ref} className='hx-panel hx-dialog' role='dialog' aria-modal='true' aria-labelledby='hx-gen-title'>
                <header className='hx-dialog-head'>
                    <h2 id='hx-gen-title' className='hx-title'>Generate overland map</h2>
                    <button type='button' className='hx-btn hx-btn--icon' aria-label='Close' onClick={close}>✕</button>
                </header>
                <div className='hx-dialog-body'>
                    <div className='hx-gen-form'>
                        <div className='hx-row'>
                            <label className='hx-field hx-grow'>
                                <span>Seed</span>
                                <input data-autofocus type='text' value={s.seed} maxLength={60} onChange={(e) => set({ seed: e.target.value })} />
                            </label>
                            <button type='button' className='hx-btn' onClick={() => set({ seed: randomSeed() })}>
                                Random
                            </button>
                        </div>
                        <div className='hx-row'>
                            <NumberField label='Width (hexes)' value={s.width} min={LIMITS.width[0]} max={LIMITS.width[1]} onChange={(width) => set({ width })} />
                            <NumberField label='Height (hexes)' value={s.height} min={LIMITS.height[0]} max={LIMITS.height[1]} onChange={(height) => set({ height })} />
                        </div>
                        <label className='hx-field'>
                            <span>Climate</span>
                            <select value={s.climate} onChange={(e) => set({ climate: e.target.value as Climate })}>
                                {CLIMATES.map((c) => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>
                        </label>
                        <label className='hx-field'>
                            <span>Water level: {Math.round(s.water * 100)}%</span>
                            <input type='range' min={0} max={60} step={5} value={Math.round(s.water * 100)} onChange={(e) => set({ water: Number(e.target.value) / 100 })} />
                        </label>
                        <label className='hx-field'>
                            <span>Mountains: {Math.round(s.mountains * 100)}%</span>
                            <input type='range' min={0} max={40} step={2} value={Math.round(s.mountains * 100)} onChange={(e) => set({ mountains: Number(e.target.value) / 100 })} />
                        </label>
                        <div className='hx-row'>
                            <NumberField label='Settlements' value={s.settlements} min={LIMITS.settlements[0]} max={LIMITS.settlements[1]} onChange={(settlements) => set({ settlements })} />
                            <NumberField label='Dungeons & sites' value={s.dungeons} min={LIMITS.dungeons[0]} max={LIMITS.dungeons[1]} onChange={(dungeons) => set({ dungeons })} />
                        </div>
                        <label className='hx-check'>
                            <input type='checkbox' checked={s.roads} onChange={(e) => set({ roads: e.target.checked })} />
                            Roads between settlements
                        </label>
                        <label className='hx-check'>
                            <input type='checkbox' checked={s.replace} onChange={(e) => set({ replace: e.target.checked })} />
                            Replace markers from an earlier generated map
                        </label>
                        <label className='hx-check'>
                            <input type='checkbox' checked={s.fog} onChange={(e) => set({ fog: e.target.checked })} />
                            Hide everything with fog (needs fog of war)
                        </label>
                    </div>
                    <figure className='hx-gen-preview'>
                        <canvas ref={canvasRef} role='img' aria-label='Preview of the generated map' />
                        <figcaption aria-live='polite'>
                            {map ? summary(map) : ""}
                            <span className='hx-legend'>
                                <span className='hx-key hx-key--settlement' aria-hidden='true' /> settlement
                                <span className='hx-key hx-key--site' aria-hidden='true' /> site
                                <span className='hx-key hx-key--river' aria-hidden='true' /> river
                                <span className='hx-key hx-key--road' aria-hidden='true' /> road
                            </span>
                            <span className='hx-muted'>
                                Fills hexes {hexNumber(s.origin)} to {hexNumber({ col: s.origin.col + s.width - 1, row: s.origin.row + s.height - 1 })}, replacing any terrain there.
                            </span>
                        </figcaption>
                    </figure>
                </div>
                <footer className='hx-dialog-foot'>
                    <button type='button' className='hx-btn' onClick={close}>Cancel</button>
                    <button
                        type='button'
                        className='hx-btn hx-btn--primary'
                        onClick={() => {
                            applyGenerated(s, generateOverland(s))
                            close()
                        }}
                    >
                        Generate
                    </button>
                </footer>
            </div>
        </div>
    )
}
