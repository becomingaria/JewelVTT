import type { ScribbleLayer, ScribbleStroke } from "../types/scribble.types"
import { SCRIBBLE_OPACITY } from "../types/scribble.types"

/*
 * Shared scribble drawing: the board overlay and layer exports use the same
 * smoothing and graphite grain, so an export looks like what's on the board.
 */

/** Smooth a stroke's points into an SVG path (quadratic curves through midpoints) */
export function strokePath(pts: number[]) {
    if (pts.length < 2) return ""
    let d = `M${pts[0]} ${pts[1]}`
    if (pts.length === 2) return d + `l0.01 0` // a dot
    for (let i = 2; i < pts.length - 2; i += 2) {
        const mx = (pts[i] + pts[i + 2]) / 2
        const my = (pts[i + 1] + pts[i + 3]) / 2
        d += `Q${pts[i]} ${pts[i + 1]} ${mx} ${my}`
    }
    d += `L${pts[pts.length - 2]} ${pts[pts.length - 1]}`
    return d
}

/** Graphite grain: thins strokes in a fine noisy pattern */
export const GRAIN_FILTER_ID = "scribble-grain"
const grainFilterMarkup = `<filter id="${GRAIN_FILTER_ID}" x="-5%" y="-5%" width="110%" height="110%">
<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="noise"/>
<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 2.1" result="grain"/>
<feComposite in="SourceGraphic" in2="grain" operator="in"/>
</filter>`

export type ScribbleExportFormat = "png-transparent" | "png-white" | "svg"

/** Pixels per world unit in exports (2 = crisp on high-DPI screens and print) */
const EXPORT_SCALE = 2
const PADDING = 24 // world units around the drawing
const MAX_PX = 8000

function strokesBounds(strokes: ScribbleStroke[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const s of strokes) {
        const half = s.size / 2
        for (let i = 0; i < s.points.length; i += 2) {
            minX = Math.min(minX, s.points[i] - half)
            maxX = Math.max(maxX, s.points[i] + half)
            minY = Math.min(minY, s.points[i + 1] - half)
            maxY = Math.max(maxY, s.points[i + 1] + half)
        }
    }
    return {
        x: minX - PADDING,
        y: minY - PADDING,
        w: maxX - minX + PADDING * 2,
        h: maxY - minY + PADDING * 2,
    }
}

const escapeXml = (s: string) =>
    s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!)

/** The layer as a standalone SVG document, cropped to its strokes */
export function layerSvg(layer: ScribbleLayer, background: "transparent" | "white", scale = EXPORT_SCALE) {
    const b = strokesBounds(layer.strokes)
    const fit = Math.min(scale, MAX_PX / b.w, MAX_PX / b.h)
    const width = Math.max(1, Math.round(b.w * fit))
    const height = Math.max(1, Math.round(b.h * fit))
    const paths = layer.strokes
        .map(
            (s) =>
                `<path d="${strokePath(s.points)}" stroke="${escapeXml(s.color)}" stroke-width="${s.size}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        )
        .join("")
    const bg = background === "white" ? `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#ffffff"/>` : ""
    return {
        width,
        height,
        svg:
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}">` +
            `<title>${escapeXml(layer.name)}</title><defs>${grainFilterMarkup}</defs>${bg}` +
            `<g opacity="${SCRIBBLE_OPACITY}" filter="url(#${GRAIN_FILTER_ID})">${paths}</g></svg>`,
    }
}

const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Scribble"

function download(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Export a scribble layer as PNG (transparent or white background) or SVG.
 * Resolves to the downloaded file name, or null if the layer is empty.
 */
export async function exportScribbleLayer(
    layer: ScribbleLayer,
    format: ScribbleExportFormat
): Promise<string | null> {
    if (!layer.strokes.length) return null
    const base = safeFileName(layer.name)
    const white = format === "png-white"
    const { svg, width, height } = layerSvg(layer, white ? "white" : "transparent")

    if (format === "svg") {
        const fileName = `${base}.svg`
        download(new Blob([svg], { type: "image/svg+xml" }), fileName)
        return fileName
    }

    // Rasterise the SVG (grain filter included) onto a canvas
    const img = new Image()
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    try {
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject(new Error("Couldn't draw the layer"))
            img.src = svgUrl
        })
    } finally {
        URL.revokeObjectURL(svgUrl)
    }
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")!
    if (white) {
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, width, height)
    }
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"))
    if (!blob) throw new Error("Couldn't create the image")
    const fileName = `${base}${white ? " (white)" : ""}.png`
    download(blob, fileName)
    return fileName
}
