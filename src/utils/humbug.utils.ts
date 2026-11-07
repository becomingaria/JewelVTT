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

export function generateId(): string {
    return `humbug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
