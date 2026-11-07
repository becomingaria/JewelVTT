/** One pencil stroke in world coordinates */
export interface ScribbleStroke {
    id: string
    color: string
    /** Line width in world units */
    size: number
    /** Flat list of world coordinates: x0, y0, x1, y1, ... */
    points: number[]
}

/** A drawing layer the user can show/hide or remove from the top bar */
export interface ScribbleLayer {
    id: string
    name: string
    visible: boolean
    strokes: ScribbleStroke[]
}

export type ScribbleTool = "pencil" | "eraser"

export interface ScribbleSettings {
    tool: ScribbleTool
    color: string
    size: number
}

/** Pencil marks are drawn at half opacity, as asked for in the design */
export const SCRIBBLE_OPACITY = 0.5

export const SCRIBBLE_COLORS = [
    { name: "Graphite", value: "#2b2b30" },
    { name: "Red", value: "#c0392b" },
    { name: "Blue", value: "#2471a3" },
    { name: "Green", value: "#1e8449" },
    { name: "Purple", value: "#6c2fcf" },
    { name: "White", value: "#ffffff" },
]

export const SCRIBBLE_SIZES = [
    { name: "Fine", value: 2 },
    { name: "Medium", value: 4 },
    { name: "Bold", value: 9 },
]
