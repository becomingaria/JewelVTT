/*
 * Overland terrain types: colours, travel cost and encounter odds.
 *
 * Pure data (no DOM), so the generator and travel maths can be checked
 * outside the browser.
 */

export type TerrainId =
    | "plains"
    | "grassland"
    | "forest"
    | "jungle"
    | "hills"
    | "mountains"
    | "swamp"
    | "desert"
    | "tundra"
    | "water"
    | "ocean"
    | "badlands"

/** Pixel palette roles used by the tile glyphs (see tiles.ts) */
export interface TerrainPalette {
    base: string
    /** Dither partner for the base colour */
    alt: string
    /** Glyph outline / ink */
    ink: string
    fill: string
    light: string
    dark: string
}

export interface TerrainDef {
    id: TerrainId
    label: string
    /** Movement cost multiplier (1 = clear ground). Infinity = not on foot. */
    cost: number
    /** Encounter chance: N in 6 */
    encounter: number
    palette: TerrainPalette
    /** Text colour that reads on this terrain (hex coordinates) */
    textInk: string
}

const P = (
    base: string,
    alt: string,
    ink: string,
    fill = alt,
    light = base,
    dark = ink
): TerrainPalette => ({ base, alt, ink, fill, light, dark })

export const TERRAINS: TerrainDef[] = [
    {
        id: "plains",
        label: "Plains",
        cost: 1,
        encounter: 1,
        palette: P("#ddd595", "#d2ca86", "#8a8538", "#bdb56c", "#ece6b4"),
        textInk: "#3d3a14",
    },
    {
        id: "grassland",
        label: "Grassland",
        cost: 1,
        encounter: 1,
        palette: P("#a3c873", "#97bd67", "#3f6a22", "#6f9c45", "#c2df92"),
        textInk: "#1f3a0e",
    },
    {
        id: "forest",
        label: "Forest",
        cost: 1.5,
        encounter: 2,
        palette: P("#86ad60", "#7aa255", "#1d3a14", "#3f7a2c", "#74b04c", "#2b5a1f"),
        textInk: "#10240a",
    },
    {
        id: "jungle",
        label: "Jungle",
        cost: 2,
        encounter: 2,
        palette: P("#4c8a40", "#437f38", "#0e2c14", "#246628", "#5aa646", "#16461c"),
        textInk: "#f2f7e8",
    },
    {
        id: "hills",
        label: "Hills",
        cost: 1.5,
        encounter: 2,
        palette: P("#c4b676", "#b8aa69", "#5a4520", "#a28c52", "#ddd09a", "#7a6634"),
        textInk: "#33270c",
    },
    {
        id: "mountains",
        label: "Mountains",
        cost: 2,
        encounter: 3,
        palette: P("#a99c84", "#9d9078", "#33281f", "#8a7b66", "#f4f2ec", "#5b4f43"),
        textInk: "#1e1711",
    },
    {
        id: "swamp",
        label: "Swamp",
        cost: 2,
        encounter: 2,
        palette: P("#76906a", "#6a845e", "#25331b", "#4f7c86", "#9fbfa8", "#3d5a35"),
        textInk: "#121c0c",
    },
    {
        id: "desert",
        label: "Desert",
        cost: 1.5,
        encounter: 1,
        palette: P("#ecd38f", "#e2c77f", "#a37a36", "#d4b066", "#f8e8b8"),
        textInk: "#4a3510",
    },
    {
        id: "tundra",
        label: "Tundra / snow",
        cost: 1.5,
        encounter: 1,
        palette: P("#e6eef2", "#d8e2e8", "#5f7480", "#b7c7d0", "#ffffff"),
        textInk: "#22323a",
    },
    {
        id: "water",
        label: "Lake / water",
        cost: Infinity,
        encounter: 1,
        palette: P("#74acdb", "#6aa3d4", "#2c5c92", "#5590c6", "#c4e2f6"),
        textInk: "#0e2846",
    },
    {
        id: "ocean",
        label: "Ocean",
        cost: Infinity,
        encounter: 1,
        palette: P("#2f5e98", "#2a578e", "#a6c6ea", "#3d6ea8", "#d2e6fa", "#1e4272"),
        textInk: "#f0f6ff",
    },
    {
        id: "badlands",
        label: "Badlands",
        cost: 1.5,
        encounter: 2,
        palette: P("#c97e4c", "#bd7242", "#5e2c14", "#b0603a", "#e09a68", "#8a4426"),
        textInk: "#2a1006",
    },
]

export const TERRAIN_IDS = TERRAINS.map((t) => t.id)

const BY_ID = new Map(TERRAINS.map((t) => [t.id, t]))

export const isTerrainId = (v: unknown): v is TerrainId =>
    typeof v === "string" && BY_ID.has(v as TerrainId)

export const terrainDef = (id: TerrainId): TerrainDef => BY_ID.get(id) ?? TERRAINS[0]

/** Unpainted hexes travel and roll like open ground */
export const OPEN_GROUND = {
    label: "open ground",
    cost: 1,
    encounter: 1,
}

export const isWater = (id: TerrainId | undefined) => id === "water" || id === "ocean"
