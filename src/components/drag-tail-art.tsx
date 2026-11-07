import React from "react"
import type { Point } from "../types/humbug.types"
import type { DragTailStyleId } from "../utils/drag-tail-styles"

export interface TailGeometry {
    start: Point
    end: Point
    /** Screen points, one per grid square travelled */
    marks: Point[]
    /** Distance in grid squares */
    distance: number
    /** Scale factor for previews (1 on the board) */
    s?: number
    /** Show the distance label */
    label?: boolean
}

const FEET_PER_SQUARE = 5

/** Outlined text that stays readable on any board style */
function outlinedText(x: number, y: number, text: string, size = 14, color = "white") {
    return (
        <>
            <text x={x} y={y} fontSize={size} fontWeight='bold' className='drag-tail-distance'
                stroke='rgba(0,0,0,0.65)' strokeWidth={3} strokeLinejoin='round' fill='none'>
                {text}
            </text>
            <text x={x} y={y} fontSize={size} fontWeight='bold' className='drag-tail-distance' fill={color}>
                {text}
            </text>
        </>
    )
}

const distanceText = (d: number) =>
    `${d.toFixed(1)} sq · ${Math.round(d * FEET_PER_SQUARE)} ft`

/**
 * Draw a drag tail in one of the six styles. Shared by the board and the
 * style picker previews (which pass a small `s` scale and no label).
 */
export function renderTail(style: DragTailStyleId, g: TailGeometry): React.ReactNode {
    const { start, end, marks, distance } = g
    const s = g.s ?? 1
    const angle = Math.atan2(end.y - start.y, end.x - start.x)
    const perp = angle + Math.PI / 2
    const len = Math.hypot(end.x - start.x, end.y - start.y)
    const label = g.label !== false && (
        outlinedText(end.x + 12 * s, end.y - 12 * s, distanceText(distance))
    )

    switch (style) {
        case "footprints": {
            const step = 16 * s
            const prints = Math.max(1, Math.floor(len / step))
            return (
                <g className='tail-footprints'>
                    {Array.from({ length: prints }, (_, i) => {
                        const t = (i + 0.5) / prints
                        const side = i % 2 === 0 ? 1 : -1
                        const x = start.x + (end.x - start.x) * t + Math.cos(perp) * 5 * s * side
                        const y = start.y + (end.y - start.y) * t + Math.sin(perp) * 5 * s * side
                        const deg = (angle * 180) / Math.PI + 90
                        return (
                            <g key={i} transform={`translate(${x} ${y}) rotate(${deg}) scale(${s})`}
                                style={{ animationDelay: `${i * 40}ms` }} className='tail-print'>
                                <ellipse cx={0} cy={-2} rx={3} ry={4.5} fill='#3b2a1a' opacity={0.75} />
                                <ellipse cx={0} cy={4.5} rx={2.3} ry={2} fill='#3b2a1a' opacity={0.75} />
                            </g>
                        )
                    })}
                    {label}
                </g>
            )
        }

        case "arrow": {
            const head = 12 * s
            const hx = end.x - Math.cos(angle) * head
            const hy = end.y - Math.sin(angle) * head
            const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
            return (
                <g className='tail-arrow'>
                    <line x1={start.x} y1={start.y} x2={hx} y2={hy} stroke='rgba(0,0,0,0.45)' strokeWidth={7 * s} strokeLinecap='round' />
                    <line x1={start.x} y1={start.y} x2={hx} y2={hy} stroke='#f5b041' strokeWidth={4 * s} strokeLinecap='round' />
                    <polygon
                        points={`${end.x},${end.y} ${hx + Math.cos(perp) * head * 0.6},${hy + Math.sin(perp) * head * 0.6} ${hx - Math.cos(perp) * head * 0.6},${hy - Math.sin(perp) * head * 0.6}`}
                        fill='#f5b041' stroke='rgba(0,0,0,0.5)' strokeWidth={1.5 * s} strokeLinejoin='round'
                    />
                    {g.label !== false && distance > 0.5 && (
                        <g transform={`translate(${mid.x} ${mid.y})`}>
                            <rect x={-44} y={-12} width={88} height={22} rx={11} fill='#2c2437' opacity={0.9} />
                            <text x={0} y={4} textAnchor='middle' fontSize={12} fontWeight='bold' fill='#fff' className='drag-tail-distance'>
                                {distanceText(distance)}
                            </text>
                        </g>
                    )}
                </g>
            )
        }

        case "breadcrumbs":
            return (
                <g className='tail-breadcrumbs'>
                    <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke='rgba(255,255,255,0.35)' strokeWidth={2 * s} strokeDasharray={`${2 * s} ${6 * s}`} strokeLinecap='round' />
                    {marks.map((m, i) => (
                        <g key={i} className='tail-crumb' style={{ animationDelay: `${i * 30}ms` }}>
                            <circle cx={m.x} cy={m.y} r={6 * s} fill='#e67e22' opacity={0.25} />
                            <circle cx={m.x} cy={m.y} r={3.5 * s} fill='#f39c12' stroke='#7e4a0c' strokeWidth={1.2 * s} />
                        </g>
                    ))}
                    <circle cx={start.x} cy={start.y} r={4 * s} fill='#7e4a0c' />
                    {label}
                </g>
            )

        case "magic": {
            const sparkles = marks.length ? marks : [end]
            return (
                <g className='tail-magic'>
                    <defs>
                        <linearGradient id={`magic-grad-${s}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} gradientUnits='userSpaceOnUse'>
                            <stop offset='0%' stopColor='#6c2fcf' stopOpacity={0} />
                            <stop offset='100%' stopColor='#c39bff' stopOpacity={1} />
                        </linearGradient>
                    </defs>
                    <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={`url(#magic-grad-${s})`} strokeWidth={8 * s} strokeLinecap='round' opacity={0.45} />
                    <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={`url(#magic-grad-${s})`} strokeWidth={2.5 * s} strokeLinecap='round' />
                    {sparkles.map((m, i) => {
                        const off = ((i * 37) % 11) - 5
                        const x = m.x + Math.cos(perp) * off * s
                        const y = m.y + Math.sin(perp) * off * s
                        const r = (2 + (i % 3)) * s
                        return (
                            <path key={i} className='tail-sparkle' style={{ animationDelay: `${(i * 110) % 900}ms` }}
                                d={`M${x} ${y - r * 2}L${x + r * 0.5} ${y - r * 0.5}L${x + r * 2} ${y}L${x + r * 0.5} ${y + r * 0.5}L${x} ${y + r * 2}L${x - r * 0.5} ${y + r * 0.5}L${x - r * 2} ${y}L${x - r * 0.5} ${y - r * 0.5}Z`}
                                fill={i % 2 ? "#fff3b0" : "#e8d7ff"} />
                        )
                    })}
                    {g.label !== false && outlinedText(end.x + 12, end.y - 12, distanceText(distance), 14, "#f1e6ff")}
                </g>
            )
        }

        case "chalk":
            return (
                <g className='tail-chalk'>
                    <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke='#fdfefe' strokeWidth={5 * s} strokeLinecap='round' opacity={0.85}
                        filter='url(#tail-chalk-rough)' />
                    {marks.map((m, i) => {
                        // Tally: four short marks, then a slash on every fifth
                        const fifth = (i + 1) % 5 === 0
                        const a = fifth ? perp + 0.9 : perp
                        const l = (fifth ? 11 : 7) * s
                        return (
                            <line key={i} x1={m.x - Math.cos(a) * l} y1={m.y - Math.sin(a) * l}
                                x2={m.x + Math.cos(a) * l} y2={m.y + Math.sin(a) * l}
                                stroke='#fdfefe' strokeWidth={2.5 * s} strokeLinecap='round' opacity={0.9}
                                filter='url(#tail-chalk-rough)' />
                        )
                    })}
                    {label}
                </g>
            )

        case "ruler":
        default:
            return (
                <g className='tail-ruler'>
                    <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke='black' strokeWidth={5 * s} strokeDasharray={`${5 * s},${5 * s}`} opacity={0.6} className='tail-dash' />
                    <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke='white' strokeWidth={3 * s} strokeDasharray={`${5 * s},${5 * s}`} opacity={0.9} className='tail-dash' />
                    {marks.map((m, i) => {
                        const l = 8 * s
                        const x1 = m.x - Math.cos(perp) * l, y1 = m.y - Math.sin(perp) * l
                        const x2 = m.x + Math.cos(perp) * l, y2 = m.y + Math.sin(perp) * l
                        return (
                            <g key={i}>
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke='black' strokeWidth={4 * s} opacity={0.6} />
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke='white' strokeWidth={2 * s} opacity={0.9} />
                                {g.label !== false && (i + 1) % 5 === 0 && (
                                    outlinedText(m.x, m.y - 12, String(i + 1), 12)
                                )}
                            </g>
                        )
                    })}
                    <circle cx={start.x} cy={start.y} r={6 * s} fill='black' opacity={0.6} />
                    <circle cx={start.x} cy={start.y} r={4 * s} fill='white' opacity={0.9} />
                    <circle cx={end.x} cy={end.y} r={5 * s} fill='black' opacity={0.6} />
                    <circle cx={end.x} cy={end.y} r={3 * s} fill='white' opacity={0.9} />
                    {label}
                </g>
            )
    }
}

/** Shared SVG filters used by the tail styles */
export const tailDefs = () => (
    <defs>
        <filter id='tail-chalk-rough' x='-10%' y='-10%' width='120%' height='120%'>
            <feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' seed='7' result='n' />
            <feDisplacementMap in='SourceGraphic' in2='n' scale='3' />
        </filter>
    </defs>
)

