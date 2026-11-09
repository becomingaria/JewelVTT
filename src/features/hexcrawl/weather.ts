/*
 * Daily overland weather: an original 2d6 table per climate and season.
 * Some weather slows travel (pace < 1 shrinks the day's movement).
 * Pure data, no DOM.
 */

import type { Glyph } from "./pixels"

export type Climate = "temperate" | "cold" | "arid" | "tropical"
export type Season = "spring" | "summer" | "autumn" | "winter"

export const CLIMATES: { id: Climate; label: string }[] = [
    { id: "temperate", label: "Temperate" },
    { id: "cold", label: "Cold" },
    { id: "arid", label: "Arid" },
    { id: "tropical", label: "Tropical" },
]

export const SEASONS: { id: Season; label: string }[] = [
    { id: "spring", label: "Spring" },
    { id: "summer", label: "Summer" },
    { id: "autumn", label: "Autumn" },
    { id: "winter", label: "Winter" },
]

export type WeatherIcon = "sun" | "partly" | "cloud" | "fog" | "rain" | "storm" | "wind" | "heat" | "snow" | "frost"

export interface WeatherKind {
    id: string
    label: string
    /** One line of flavour / rules for the table */
    detail: string
    icon: WeatherIcon
    /** Fraction of a normal day's movement */
    pace: number
}

const K = (id: string, label: string, detail: string, icon: WeatherIcon, pace = 1): WeatherKind => ({
    id,
    label,
    detail,
    icon,
    pace,
})

export const WEATHER_KINDS: Record<string, WeatherKind> = Object.fromEntries(
    [
        K("clear", "Clear skies", "Good marching weather; long sight lines.", "sun"),
        K("fair", "Fair and breezy", "Scattered clouds and a light wind.", "partly"),
        K("overcast", "Overcast", "Grey and still. Nothing to slow you.", "cloud"),
        K("mist", "Morning mist", "Low mist until midday; landmarks hard to spot early on.", "fog"),
        K("fog", "Thick fog", "Hard to keep a bearing. Movement ×¾.", "fog", 0.75),
        K("drizzle", "Light rain", "Damp packs and dripping hoods.", "rain"),
        K("rain", "Steady rain", "Mud and swollen streams. Movement ×¾.", "rain", 0.75),
        K("storm", "Thunderstorm", "Lightning and downpour. Movement ×½; seek shelter.", "storm", 0.5),
        K("gale", "Strong winds", "Gusts that tug at cloaks and tents. Movement ×¾.", "wind", 0.75),
        K("hot", "Hot and dry", "Water runs low faster than usual.", "heat"),
        K("scorching", "Scorching heat", "Travel at dawn and dusk only. Movement ×½.", "heat", 0.5),
        K("duststorm", "Dust storm", "Stinging grit; shelter or go blind. Movement ×½.", "wind", 0.5),
        K("chill", "Cold snap", "Frost on the bedrolls; fires are a must.", "frost"),
        K("bitter", "Bitter cold", "Exposed skin numbs. Movement ×¾.", "frost", 0.75),
        K("snow", "Snowfall", "Soft snow covers tracks. Movement ×¾.", "snow", 0.75),
        K("blizzard", "Blizzard", "White-out and howling wind. Movement ×½.", "snow", 0.5),
        K("humid", "Hot and humid", "Sweat and biting insects.", "heat"),
        K("showers", "Warm showers", "Short, heavy bursts of rain.", "rain"),
        K("downpour", "Torrential downpour", "Rivers burst their banks. Movement ×½.", "storm", 0.5),
    ].map((k) => [k.id, k])
)

/** [highest 2d6 total for this row, weather id] in ascending order */
type Table = [number, string][]

const TABLES: Record<Climate, Record<Season, Table>> = {
    temperate: {
        spring: [[3, "storm"], [5, "rain"], [7, "drizzle"], [9, "fair"], [11, "clear"], [12, "mist"]],
        summer: [[2, "storm"], [4, "hot"], [9, "clear"], [11, "fair"], [12, "showers"]],
        autumn: [[3, "gale"], [5, "rain"], [7, "overcast"], [9, "fair"], [11, "mist"], [12, "fog"]],
        winter: [[2, "blizzard"], [4, "snow"], [7, "chill"], [9, "overcast"], [11, "fog"], [12, "clear"]],
    },
    cold: {
        spring: [[3, "snow"], [5, "chill"], [8, "overcast"], [10, "fair"], [12, "mist"]],
        summer: [[2, "gale"], [5, "overcast"], [8, "fair"], [11, "clear"], [12, "rain"]],
        autumn: [[3, "snow"], [5, "bitter"], [8, "chill"], [10, "overcast"], [12, "fog"]],
        winter: [[3, "blizzard"], [6, "snow"], [9, "bitter"], [11, "chill"], [12, "clear"]],
    },
    arid: {
        spring: [[2, "duststorm"], [4, "gale"], [9, "clear"], [11, "hot"], [12, "showers"]],
        summer: [[3, "duststorm"], [6, "scorching"], [10, "hot"], [12, "clear"]],
        autumn: [[2, "duststorm"], [5, "hot"], [10, "clear"], [11, "fair"], [12, "gale"]],
        winter: [[2, "gale"], [4, "chill"], [9, "clear"], [11, "fair"], [12, "drizzle"]],
    },
    tropical: {
        spring: [[3, "downpour"], [6, "showers"], [9, "humid"], [11, "fair"], [12, "mist"]],
        summer: [[4, "downpour"], [7, "storm"], [10, "humid"], [12, "showers"]],
        autumn: [[2, "storm"], [5, "showers"], [9, "humid"], [11, "fair"], [12, "clear"]],
        winter: [[2, "showers"], [5, "humid"], [10, "clear"], [12, "fair"]],
    },
}

/** Look up the weather for a 2d6 total */
export function weatherFor(climate: Climate, season: Season, total: number): WeatherKind {
    const table = TABLES[climate]?.[season] ?? TABLES.temperate.spring
    const row = table.find(([max]) => total <= max) ?? table[table.length - 1]
    return WEATHER_KINDS[row[1]]
}

/** Every row of a table, for the help text / tests */
export const weatherTable = (climate: Climate, season: Season) => TABLES[climate][season]

// ------------------------------------------------------------- pixel icons
// 12×12, drawn as SVG in the HUD. y sun · w cloud · g cloud shade · b rain ·
// l lightning · s snow · k ink · r heat
export const WEATHER_ICON_PALETTE: Record<string, string> = {
    y: "#f2b632",
    o: "#d9822b",
    w: "#f4f4f4",
    g: "#a9b4c2",
    b: "#3c78d8",
    l: "#ffe14a",
    s: "#ffffff",
    k: "#2a2a3a",
    r: "#e0562a",
}

export const WEATHER_ICONS: Record<WeatherIcon, Glyph> = {
    sun: [
        ".....y......",
        "..y..y..y...",
        "...y.y.y....",
        "....kkk.....",
        "yy.kyyyk.yy.",
        "...kyoyk....",
        "....kkk.....",
        "...y.y.y....",
        "..y..y..y...",
        ".....y......",
    ],
    partly: [
        "..y.y.......",
        "...kkk......",
        "y.kyyyk.....",
        "..kykkkk....",
        "...kwwwwk...",
        "..kwwwwwwkk.",
        ".kwwwwwwwwwk",
        ".kggggggggk.",
        "..kkkkkkkk..",
    ],
    cloud: [
        "....kkk.....",
        "...kwwwk....",
        "..kwwwwwkk..",
        ".kwwwwwwwwk.",
        "kwwwwwwwwwwk",
        "kggggggggggk",
        ".kkkkkkkkkk.",
    ],
    fog: [
        "............",
        ".kkkkkkk....",
        "............",
        "...kkkkkkkk.",
        "............",
        "kkkkkkkk....",
        "............",
        "..kkkkkkkkk.",
    ],
    rain: [
        "....kkk.....",
        "...kwwwk....",
        "..kwwwwwkk..",
        ".kwwwwwwwwk.",
        "kggggggggggk",
        ".kkkkkkkkkk.",
        "..b...b...b.",
        ".b...b...b..",
        "b...b...b...",
    ],
    storm: [
        "....kkk.....",
        "...kgggk....",
        "..kgggggkk..",
        ".kggggggggk.",
        "kggggggggggk",
        ".kkkklkkkkk.",
        "..b.ll..b...",
        ".b..lll.b...",
        "b.....l.....",
        "......l.....",
    ],
    wind: [
        "......kk....",
        "kkkkkkk.k...",
        "........k...",
        "kkkkkkkkk...",
        "............",
        "kkkkkkkkkk..",
        "..........k.",
        "kkkkkk..kk..",
        "......kk....",
    ],
    heat: [
        ".....y......",
        "..y..y..y...",
        "....kkk.....",
        "y..kyyyk..y.",
        "...kyoyk....",
        "....kkk.....",
        "............",
        ".r..r..r..r.",
        "r..r..r..r..",
        ".r..r..r..r.",
    ],
    snow: [
        "....kkk.....",
        "...kwwwk....",
        "..kwwwwwkk..",
        ".kwwwwwwwwk.",
        "kggggggggggk",
        ".kkkkkkkkkk.",
        "..k...k...k.",
        ".kgk.kgk.kgk",
        "..k...k...k.",
    ],
    frost: [
        ".....k......",
        "..k..k..k...",
        "...k.k.k....",
        "....kgk.....",
        "kkkkgsgkkkk.",
        "....kgk.....",
        "...k.k.k....",
        "..k..k..k...",
        ".....k......",
    ],
}
