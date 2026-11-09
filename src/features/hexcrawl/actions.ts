import {
    addHumbugs,
    humbugBase,
    humbugsStore,
    updateHumbugs,
} from "../board-bridge"
import { cellAt, cellCenter, cellDistance, cellKey, cellNeighbors, type Cell } from "../grid"
import { fog, logEvent, rollDice } from "../services"
import { playSfx } from "../sound"
import type { Humbug, ImageHumbug } from "../../types/humbug.types"
import { humbugFootprint } from "../../utils/humbug.utils"
import { showToast } from "../../utils/toast"
import { hasPath } from "./map-data"
import { MARKER_SIZE, markerDataUrl, markerInfo, type MarkerExt, type MarkerKind } from "./markers"
import { changeTravel, mapStore, travelResultStore, travelStore } from "./state"
import { isWater, terrainDef } from "./terrain"
import {
    afterMove,
    dayBudget,
    DIRECTION_NAMES,
    directionTo,
    encounterChance,
    hexNumber,
    isEncounter,
    milesCovered,
    moveCostMiles,
    progressFor,
    terrainName,
    type DayProgress,
} from "./travel"
import { WEATHER_KINDS, weatherFor, type WeatherKind } from "./weather"

// ---------------------------------------------------------------- helpers
interface HexExt {
    marker?: MarkerExt["marker"]
    label?: string
    number?: string
    generated?: boolean
    travel?: Partial<DayProgress>
}

export const hexExt = (h: Humbug): HexExt | undefined => h.ext?.hexcrawl as HexExt | undefined

export const isMarker = (h: Humbug) => !!hexExt(h)?.marker

export const humbugCentre = (h: Humbug) => {
    const s = humbugFootprint(h)
    return { x: h.position.x + s.width / 2, y: h.position.y + s.height / 2 }
}

export const humbugCell = (h: Humbug): Cell => cellAt(humbugCentre(h), "hex")

export function partyToken(): Humbug | undefined {
    const id = travelStore.get().partyId
    return id ? humbugsStore.get().find((h) => h.id === id) : undefined
}

export const partyName = (h: Humbug | undefined) =>
    !h ? "" : h.type === "token" && h.name ? h.name : "The party"

/** Weather in force today (null until rolled) */
export function todaysWeather(): WeatherKind | null {
    const t = travelStore.get()
    return t.weather && t.weather.day === t.day ? (WEATHER_KINDS[t.weather.id] ?? null) : null
}

export const todaysBudget = () => dayBudget(todaysWeather()?.pace ?? 1)

export function todaysProgress(h = partyToken()): DayProgress {
    return progressFor(h ? hexExt(h)?.travel : undefined, travelStore.get().day)
}

// ------------------------------------------------------------------ party
export function setParty(h: Humbug) {
    if (isMarker(h)) {
        showToast("That's a map marker. Pick the party's token instead.", "error")
        return
    }
    if (travelStore.get().partyId === h.id) return
    changeTravel({ partyId: h.id }, "Choose travelling party")
    showToast(`${partyName(h)} will travel. Click a neighbouring hex to move.`)
}

/** Move the party one hex. Returns false (with a message) when it can't. */
export function moveParty(to: Cell): boolean {
    const h = partyToken()
    if (!h) {
        showToast("Choose the party first: select its token, then press “Use selected token”.", "error")
        return false
    }
    const from = humbugCell(h)
    if (cellDistance(from, to, "hex") !== 1) {
        showToast("The party moves one hex at a time. Pick a hex next to it.")
        return false
    }
    const map = mapStore.get()
    const terrain = map.cells[cellKey(to)]
    if (isWater(terrain)) {
        showToast(`The party can't cross ${terrainDef(terrain!).label.toLowerCase()} on foot.`, "error")
        playSfx("error")
        return false
    }
    const travel = travelStore.get()
    const road = hasPath(map, "road", from, to)
    const cost = moveCostMiles(terrain, road)
    const budget = todaysBudget()
    const next = afterMove(todaysProgress(h), cost)
    const forced = next.used > budget

    // Position and today's progress change together: one undo step
    const size = humbugFootprint(h)
    const c = cellCenter(to, "hex")
    updateHumbugs([
        {
            id: h.id,
            changes: {
                position: { x: c.x - size.width / 2, y: c.y - size.height / 2 },
                ext: { ...h.ext, hexcrawl: { ...hexExt(h), travel: next } },
            },
        },
    ])

    fog.reveal([to, ...cellNeighbors(to, "hex")])

    const where = terrainName(terrain)
    const dir = DIRECTION_NAMES[directionTo(from, to)]
    let encounter = false
    let rollText = ""
    if (travel.checks) {
        const chance = encounterChance(terrain)
        const roll = rollDice("1d6", { label: `Encounter check: ${where} (${chance} in 6)`, log: false })
        encounter = isEncounter(roll.total, chance)
        rollText = `rolled ${roll.total}, ${chance} in 6`
    }
    logEvent({
        kind: "travel",
        text: `Day ${travel.day}: ${partyName(h)} travels ${dir}${road ? " by road" : ""} into ${where} (hex ${hexNumber(to)}).`,
        detail: `${fmtMiles(next.used)} of ${fmtMiles(budget)} miles of movement used today${forced ? ", forced march" : ""}.${rollText ? ` Encounter check ${rollText}.` : ""}`,
    })
    if (encounter) {
        logEvent({ kind: "encounter", text: `Encounter in the ${where} at hex ${hexNumber(to)} (${rollText}).` })
        playSfx("alert")
    } else playSfx("place")

    const parts = [`Entered ${where} (${hexNumber(to)})${road ? " by road" : ""}: ${fmtMiles(cost)} miles of movement.`]
    if (travel.checks) parts.push(encounter ? `Encounter! (${rollText})` : `No encounter (${rollText}).`)
    if (forced) parts.push("Forced march: past the day's movement.")
    travelResultStore.set({ text: parts.join(" "), encounter })
    return true
}

export const fmtMiles = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

// ---------------------------------------------------------------- weather
function rollWeatherFor(day: number) {
    const t = travelStore.get()
    const roll = rollDice("2d6", { label: `Weather (${t.climate}, ${t.season})`, log: false })
    const w = weatherFor(t.climate, t.season, roll.total)
    return { w, entry: { id: w.id, roll: roll.total, day } }
}

export function rollTodaysWeather() {
    const t = travelStore.get()
    const { w, entry } = rollWeatherFor(t.day)
    changeTravel({ weather: entry }, "Roll weather")
    logEvent({ kind: "weather", text: `Day ${t.day} weather: ${w.label}.`, detail: w.detail })
}

/** End the travel day: camp, advance the day and roll tomorrow's weather */
export function makeCamp() {
    const t = travelStore.get()
    const h = partyToken()
    const p = todaysProgress(h)
    const nextDay = t.day + 1
    const { w, entry } = rollWeatherFor(nextDay)
    changeTravel({ day: nextDay, weather: entry }, "Make camp")
    logEvent({
        kind: "travel",
        text: `Day ${t.day} ends: ${h ? partyName(h) : "the party"} makes camp after ${p.hexes} ${p.hexes === 1 ? "hex" : "hexes"} (${milesCovered(p)} miles).`,
    })
    logEvent({ kind: "weather", text: `Day ${nextDay} weather: ${w.label}.`, detail: w.detail })
    travelResultStore.set({ text: `Camped. Day ${nextDay} begins: ${w.label}.`, encounter: false })
    playSfx("turn")
}

// ---------------------------------------------------------------- markers
export function markerHumbug(cell: Cell, ext: MarkerExt): ImageHumbug {
    const c = cellCenter(cell, "hex")
    return {
        ...humbugBase({ x: c.x - MARKER_SIZE / 2, y: c.y - MARKER_SIZE / 2 }),
        type: "image",
        imageUrl: markerDataUrl(ext.marker),
        size: { width: MARKER_SIZE, height: MARKER_SIZE },
        originalSize: { width: 72, height: 72 },
        ext: { hexcrawl: ext },
    }
}

export function placeMarker(cell: Cell, kind: MarkerKind, label: string, withNumber: boolean) {
    addHumbugs([
        markerHumbug(cell, {
            marker: kind,
            label: label.trim() || undefined,
            number: withNumber ? hexNumber(cell) : undefined,
        }),
    ])
    playSfx("place")
    return markerInfo(kind).label
}
