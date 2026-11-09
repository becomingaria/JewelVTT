import React, { useLayoutEffect, useRef } from "react"
import { parseCellKey } from "../grid"
import type { Dungeon } from "./generator"
import { mapColours } from "./render"
import { isHatched, traceWalls } from "./walls"

/** Small preview of a generated dungeon (generator dialog, starter list) */
export const Minimap: React.FC<{ dungeon: Dungeon; width: number; height: number; label: string }> = ({
    dungeon,
    width,
    height,
    label,
}) => {
    const ref = useRef<HTMLCanvasElement>(null)

    useLayoutEffect(() => {
        const canvas = ref.current
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
        const col = mapColours()
        const { width: W, height: H, floor, placements } = dungeon
        const s = Math.min(width / (W + 2), height / (H + 2))
        const ox = (width - W * s) / 2
        const oy = (height - H * s) / 2
        ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy)
        ctx.clearRect(-ox / s, -oy / s, width / s, height / s)

        // Hatched band as a tone, then paper floor, then walls
        ctx.fillStyle = col.ink
        ctx.globalAlpha = 0.22
        for (let r = -2; r < H + 2; r++)
            for (let c = -2; c < W + 2; c++) if (isHatched(floor, c, r)) ctx.fillRect(c, r, 1, 1)
        ctx.globalAlpha = 1
        ctx.fillStyle = col.paper
        for (const k of floor) {
            const { col: c, row: r } = parseCellKey(k)
            ctx.fillRect(c, r, 1.02, 1.02)
        }
        ctx.strokeStyle = col.ink
        ctx.lineWidth = Math.max(0.16, 1.4 / s)
        ctx.lineCap = "square"
        ctx.beginPath()
        for (const w of traceWalls(floor)) {
            ctx.moveTo(w.x1, w.y1)
            ctx.lineTo(w.x2, w.y2)
        }
        ctx.stroke()

        // Doors as bars across the passage, other things as small marks
        for (const p of placements) {
            if (p.stamp === "door" || p.stamp === "secret") {
                ctx.fillStyle = p.stamp === "secret" ? "#b3302a" : "#7a4a1f"
                if (p.rotation === 0) ctx.fillRect(p.col, p.row + 0.3, 1, 0.4)
                else ctx.fillRect(p.col + 0.3, p.row, 0.4, 1)
            } else if (p.stamp === "stairs-up" || p.stamp === "stairs-down") {
                ctx.fillStyle = col.ink
                ctx.beginPath()
                const up = p.stamp === "stairs-up"
                ctx.moveTo(p.col + 0.5, p.row + (up ? 0.15 : 0.85))
                ctx.lineTo(p.col + 0.9, p.row + (up ? 0.85 : 0.15))
                ctx.lineTo(p.col + 0.1, p.row + (up ? 0.85 : 0.15))
                ctx.fill()
            } else if (p.stamp === "label" && s >= 7) {
                ctx.fillStyle = col.ink
                ctx.font = `bold 0.8px ui-monospace, monospace`
                ctx.textBaseline = "top"
                ctx.fillText(String(p.room), p.col + 0.1, p.row + 0.1)
            } else if (p.stamp === "trap") {
                ctx.fillStyle = "#b3302a"
                ctx.fillRect(p.col + 0.3, p.row + 0.3, 0.4, 0.4)
            }
        }
    }, [dungeon, width, height])

    return <canvas ref={ref} className='dgn-minimap' style={{ width, height }} role='img' aria-label={label} />
}
