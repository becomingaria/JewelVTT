import type {
    Humbug,
    HumbugType,
    Point,
    TextHumbug,
    ImageHumbug,
    MapPinHumbug,
    SolidColorHumbug,
    MapHumbug,
    TokenHumbug,
} from "../types/humbug.types"

/**
 * A map pin's size in world units. Pins are meant to store a number, but
 * older boards saved a { width, height } object, so accept both.
 */
export function pinSize(h: MapPinHumbug): number {
    const s = h.size as unknown
    if (typeof s === "number" && Number.isFinite(s)) return s
    if (s && typeof s === "object" && "width" in s) {
        const w = Number((s as { width: number }).width)
        if (Number.isFinite(w) && w > 0) return w
    }
    return 32
}

export function generateId(): string {
    return `humbug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// ---- Hex grid (pointy-top, as wide as a square; matches the board drawing)
export const HEX_W = 32
export const HEX_R = HEX_W / Math.sqrt(3) // centre-to-corner
export const HEX_ROW = 1.5 * HEX_R // vertical distance between rows

const hexRowShift = (row: number) => (((row % 2) + 2) % 2 ? HEX_W / 2 : 0)

/** Centre of the hex containing (or nearest to) a world point */
export function nearestHexCenter(x: number, y: number): Point & { row: number } {
    const r0 = Math.round(y / HEX_ROW)
    let best = { x: 0, y: 0, row: 0 }
    let bestD = Infinity
    for (let row = r0 - 1; row <= r0 + 1; row++) {
        const shift = hexRowShift(row)
        const col = Math.round((x - shift) / HEX_W)
        const cx = col * HEX_W + shift
        const cy = row * HEX_ROW
        const d = (cx - x) ** 2 + (cy - y) ** 2
        if (d < bestD) {
            bestD = d
            best = { x: cx, y: cy, row }
        }
    }
    return best
}

/** Footprint of any humbug in world units */
export function humbugFootprint(h: Humbug): { width: number; height: number } {
    return h.type === "map-pin" ? { width: pinSize(h), height: pinSize(h) } : h.size
}

/**
 * Snap a humbug's top-left position for the current grid: square grids snap
 * the corner to grid lines; hex grids put the humbug's centre on a hex centre.
 */
export function snapForGrid(
    position: Point,
    size: { width: number; height: number },
    shape: "square" | "hex"
): Point {
    if (shape !== "hex") return snapToGrid(position, 32)
    const c = nearestHexCenter(position.x + size.width / 2, position.y + size.height / 2)
    return { x: c.x - size.width / 2, y: c.y - size.height / 2 }
}

/**
 * One arrow-key step on the hex grid. Left/right move a whole hex; up/down
 * move to the next row, leaning toward the held left/right key or
 * zig-zagging so repeated presses keep going straight.
 */
export function hexStep(dx: number, dy: number, centerY: number): Point {
    if (!dy) return { x: Math.sign(dx) * HEX_W, y: 0 }
    const row = Math.round(centerY / HEX_ROW)
    const lean = dx ? Math.sign(dx) : (((row % 2) + 2) % 2 ? -1 : 1) * Math.sign(dy)
    return { x: (lean * HEX_W) / 2, y: Math.sign(dy) * HEX_ROW }
}

export function snapToGrid(point: Point, gridSize: number): Point {
    return {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize,
    }
}

export function createDefaultHumbug(type: HumbugType, position: Point): Humbug {
    const baseHumbug = {
        id: generateId(),
        position,
        rotation: 0,
        locked: false,
        zIndex: 100, // Start at 100 to leave room for background elements
        opacity: 1.0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    }

    switch (type) {
        case "text": {
            const textHumbug: TextHumbug = {
                ...baseHumbug,
                type: "text",
                content: "New Text",
                fontSize: 16,
                fontFamily: "Arial, sans-serif",
                color: "#000000",
                backgroundColor: "transparent",
                textAlign: "left",
                size: { width: 120, height: 40 },
            }
            return textHumbug
        }

        case "image": {
            const imageHumbug: ImageHumbug = {
                ...baseHumbug,
                type: "image",
                imageUrl: "/api/placeholder/100/100", // Placeholder image
                size: { width: 100, height: 100 },
                originalSize: { width: 100, height: 100 },
            }
            return imageHumbug
        }

        case "map-pin": {
            const mapPinHumbug: MapPinHumbug = {
                ...baseHumbug,
                type: "map-pin",
                color: "#ff0000",
                size: 24,
                label: "Pin",
            }
            return mapPinHumbug
        }

        case "solid-color": {
            const solidColorHumbug: SolidColorHumbug = {
                ...baseHumbug,
                type: "solid-color",
                color: "#007acc",
                size: { width: 100, height: 100 },
            }
            return solidColorHumbug
        }

        case "map": {
            const mapHumbug: MapHumbug = {
                ...baseHumbug,
                type: "map",
                imageUrl: "/api/placeholder/1000/1000", // Large placeholder for maps
                size: { width: 1000, height: 1000 }, // 10x larger than regular images
                originalSize: { width: 1000, height: 1000 },
                showGrid: true,
            }
            return mapHumbug
        }

        case "token": {
            const tokenHumbug: TokenHumbug = {
                ...baseHumbug,
                type: "token",
                imageUrl: "/api/placeholder/32/32", // Standard grid-aligned size placeholder
                size: { width: 32, height: 32 },
                originalSize: { width: 32, height: 32 },
                borderColor: "#007acc",
                borderWidth: 2, // Adjusted for smaller size
            }
            return tokenHumbug
        }

        case "document": {
            return {
                ...baseHumbug,
                type: "document",
                title: "New document",
                size: { width: 240, height: 96 },
            }
        }

        default:
            throw new Error(`Unknown humbug type: ${type}`)
    }
}

export function calculateDistance(point1: Point, point2: Point): number {
    const dx = point2.x - point1.x
    const dy = point2.y - point1.y
    return Math.sqrt(dx * dx + dy * dy)
}

export function calculateAngle(center: Point, point: Point): number {
    const dx = point.x - center.x
    const dy = point.y - center.y
    return Math.atan2(dy, dx) * (180 / Math.PI)
}

export function boundingBox(
    humbugs: Humbug[]
): { min: Point; max: Point } | null {
    if (humbugs.length === 0) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    humbugs.forEach((humbug) => {
        minX = Math.min(minX, humbug.position.x)
        minY = Math.min(minY, humbug.position.y)
        maxX = Math.max(maxX, humbug.position.x)
        maxY = Math.max(maxY, humbug.position.y)
    })

    return {
        min: { x: minX, y: minY },
        max: { x: maxX, y: maxY },
    }
}
