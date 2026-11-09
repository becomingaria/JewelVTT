/*
 * Overland travel maths (OSR style), pure so it can be checked in Node.
 *
 * A party covers 24 miles of clear ground a day: 4 hexes of 6 miles.
 * Entering a hex spends 6 miles × the terrain's cost multiplier from the
 * day's budget (forest, hills, desert ×1.5; mountains, swamp, jungle ×2).
 * Following a road between the two hexes halves the cost. Weather can
 * shrink the budget (pace).
 */

import { cellCenter, cellNeighbors, type Cell } from "../grid"
import { OPEN_GROUND, terrainDef, type TerrainId } from "./terrain"

export const MILES_PER_HEX = 6
export const BASE_MILES_PER_DAY = 24
export const ROAD_FACTOR = 0.5

/** Movement cost multiplier for entering a hex */
export function moveMultiplier(terrain: TerrainId | undefined, road: boolean): number {
    const base = terrain ? terrainDef(terrain).cost : OPEN_GROUND.cost
    return road ? base * ROAD_FACTOR : base
}

/** Budget miles spent entering a hex */
export const moveCostMiles = (terrain: TerrainId | undefined, road: boolean) =>
    MILES_PER_HEX * moveMultiplier(terrain, road)

/** The day's movement budget in miles of clear ground */
export const dayBudget = (pace = 1) => BASE_MILES_PER_DAY * pace

/** Encounter chance, N in 6 */
export const encounterChance = (terrain: TerrainId | undefined) =>
    terrain ? terrainDef(terrain).encounter : OPEN_GROUND.encounter

export const terrainName = (terrain: TerrainId | undefined) =>
    terrain ? terrainDef(terrain).label.toLowerCase() : OPEN_GROUND.label

/** Marching watches of the travel day (4 hours each), then camp */
export const WATCHES = ["Morning", "Midday", "Afternoon", "Evening"] as const
export type Watch = (typeof WATCHES)[number]

export function watchFor(used: number, budget: number): Watch {
    if (budget <= 0 || used >= budget) return "Evening"
    return WATCHES[Math.min(2, Math.floor((used / budget) * 3))]
}

/** Today's progress, kept on the party token (ext.hexcrawl.travel) */
export interface DayProgress {
    day: number
    /** Budget miles spent */
    used: number
    hexes: number
}

export const freshDay = (day: number): DayProgress => ({ day, used: 0, hexes: 0 })

/** Progress for `day`, or a fresh one if the stored progress is from another day */
export function progressFor(stored: Partial<DayProgress> | undefined, day: number): DayProgress {
    if (!stored || stored.day !== day) return freshDay(day)
    return { day, used: Number(stored.used) || 0, hexes: Number(stored.hexes) || 0 }
}

export function afterMove(p: DayProgress, costMiles: number): DayProgress {
    return { ...p, used: p.used + costMiles, hexes: p.hexes + 1 }
}

/** Miles actually covered (each hex is 6 miles across) */
export const milesCovered = (p: DayProgress) => p.hexes * MILES_PER_HEX

/** Encounter if the d6 shows the chance or lower */
export const isEncounter = (roll: number, chance: number) => roll >= 1 && roll <= chance

/** "0304": column then row, two digits each (negative numbers keep a minus) */
export function hexNumber(c: Cell): string {
    const f = (n: number) => (n < 0 ? "-" + String(-n).padStart(2, "0") : String(n).padStart(2, "0"))
    return f(c.col) + f(c.row)
}

export type Direction = "NE" | "E" | "SE" | "SW" | "W" | "NW"
export const DIRECTION_NAMES: Record<Direction, string> = {
    NE: "north-east",
    E: "east",
    SE: "south-east",
    SW: "south-west",
    W: "west",
    NW: "north-west",
}

/** Compass direction between two neighbouring hexes (pointy-top) */
export function directionTo(from: Cell, to: Cell): Direction {
    const a = cellCenter(from, "hex")
    const b = cellCenter(to, "hex")
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (Math.abs(dy) < 1e-6) return dx > 0 ? "E" : "W"
    if (dy < 0) return dx > 0 ? "NE" : "NW"
    return dx > 0 ? "SE" : "SW"
}

/** The six neighbours in clockwise order from north-east */
export function neighboursByDirection(c: Cell): { dir: Direction; cell: Cell }[] {
    const order: Direction[] = ["NE", "E", "SE", "SW", "W", "NW"]
    const list = cellNeighbors(c, "hex").map((n) => ({ dir: directionTo(c, n), cell: n }))
    return order.map((d) => list.find((n) => n.dir === d)!)
}
