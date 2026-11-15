import type { Humbug } from "../../types/humbug.types"
import { snapshotBoard } from "../../utils/board-store"
import { humbugFootprint } from "../../utils/humbug.utils"
import { cellAt, cellKey, cellsWithin, parseCellKey, type CellKey } from "../grid"
import { effectiveFog } from "../fog-light/effective-fog"
import { fogShape, isRevealedKey, serializeFog } from "../fog-light/fog-store"
import { isHumbugHidden, layerStateStore } from "../view-state"
import { NET_EXT, PRIVATE_SLICES, type NetExt } from "./protocol"

/*
 * What players may see. Built on the GM's machine, so hidden things never
 * leave it:
 * - GM-only and hidden-layer objects are dropped
 * - with fog on, objects (other than maps) under the fog are dropped, and
 *   cell-based maps (dungeon floors, hex terrain, paint) are cut down to
 *   what's visible plus a 2-cell margin (so walls draw right at the edge)
 * - hidden reveal layers aren't sent; the fog is sent as players see it
 * - monsters' exact HP become a rough bar
 * Map images are sent whole (they're one picture); the fog covers them.
 */

export const ownerOf = (h: Humbug): string | undefined =>
    (h.ext?.[NET_EXT] as NetExt | undefined)?.owner

const isPartyToken = (h: Humbug) =>
    h.type === "token" &&
    (!!ownerOf(h) || (h.ext?.tracker as { side?: string } | undefined)?.side === "party")

interface Visibility {
    on: boolean
    see: (k: CellKey) => boolean
    near: (k: CellKey) => boolean
    shape: ReturnType<typeof fogShape>
}

function visibility(): Visibility {
    const fog = effectiveFog()
    const shape = fogShape()
    const see = (k: CellKey) => isRevealedKey(fog, k)
    const memo = new Map<CellKey, boolean>()
    const near = (k: CellKey) => {
        let v = memo.get(k)
        if (v === undefined) {
            v = see(k) || cellsWithin(parseCellKey(k), 2, shape).some((c) => see(cellKey(c)))
            memo.set(k, v)
        }
        return v
    }
    return { on: fog.enabled, see, near, shape }
}

/** Is any part of this humbug in sight? */
function humbugVisible(h: Humbug, vis: Visibility): boolean {
    const size = humbugFootprint(h)
    const pts = [
        { x: h.position.x + size.width / 2, y: h.position.y + size.height / 2 },
        { x: h.position.x + 2, y: h.position.y + 2 },
        { x: h.position.x + size.width - 2, y: h.position.y + 2 },
        { x: h.position.x + 2, y: h.position.y + size.height - 2 },
        { x: h.position.x + size.width - 2, y: h.position.y + size.height - 2 },
    ]
    return pts.some((p) => vis.see(cellKey(cellAt(p, vis.shape))))
}

function filterHumbugs(humbugs: Humbug[], vis: Visibility): Humbug[] {
    const layers = layerStateStore.get()
    const out: Humbug[] = []
    for (const h of humbugs) {
        if (isHumbugHidden(h, layers, true)) continue
        if (vis.on && h.type !== "map" && !ownerOf(h) && !humbugVisible(h, vis)) continue
        let copy: Humbug = h
        // Monsters: a rough bar instead of exact numbers
        if (h.type === "token" && h.hp && !isPartyToken(h)) {
            const ratio = h.hp.max > 0 ? Math.max(0, Math.min(1, h.hp.current / h.hp.max)) : 0
            copy = { ...h, hp: { current: Math.ceil(ratio * 10), max: 10 } }
        }
        out.push(copy)
    }
    return out
}

const keepCells = (keys: string[], vis: Visibility) => (vis.on ? keys.filter((k) => vis.near(k)) : keys)

/** The board as players may see it (before per-player touches) */
export function buildPlayerBoard(): Record<string, unknown> {
    const board = snapshotBoard().board
    const vis = visibility()
    const out: Record<string, unknown> = {}
    const keptIds = new Set<string>()

    for (const [key, value] of Object.entries(board)) {
        if (PRIVATE_SLICES.has(key)) continue
        switch (key) {
            case "humbugs": {
                const list = filterHumbugs((value as Humbug[]) ?? [], vis)
                list.forEach((h) => keptIds.add(h.id))
                out[key] = list
                break
            }
            case "fog-light:fog":
                out[key] = serializeFog(effectiveFog())
                break
            case "fog-light:reveals":
                out[key] = []
                break
            case "dungeon:floor":
                out[key] = keepCells((value as string[]) ?? [], vis)
                break
            case "paintGrid": {
                const grid = (value as Record<string, string>) ?? {}
                out[key] =
                    vis.on && vis.shape === "square"
                        ? Object.fromEntries(Object.entries(grid).filter(([k]) => vis.near(k)))
                        : grid
                break
            }
            case "hexcrawl:terrain": {
                const cells = (value as Record<string, string>) ?? {}
                out[key] = vis.on ? Object.fromEntries(Object.entries(cells).filter(([k]) => vis.near(k))) : cells
                break
            }
            case "hexcrawl:paths": {
                const p = (value as { rivers?: string[]; roads?: string[] }) ?? {}
                const edge = (e: string) => e.split("|").every((k) => vis.near(k))
                out[key] = vis.on
                    ? { rivers: (p.rivers ?? []).filter(edge), roads: (p.roads ?? []).filter(edge) }
                    : p
                break
            }
            case "dice:audit":
                // The GM's secret rolls stay with the GM
                out[key] = ((value as { secret?: boolean }[]) ?? []).filter((e) => !e?.secret)
                break
            case "scribbles":
                // Only drawings the GM is showing
                out[key] = ((value as { visible?: boolean }[]) ?? []).filter((l) => l.visible)
                break
            default:
                out[key] = value
        }
    }

    // Connectors only between things players can see
    const connectors = out.connectors as { from?: { humbugId?: string }; to?: { humbugId?: string } }[] | undefined
    if (Array.isArray(connectors)) {
        out.connectors = connectors.filter(
            (c) => (!c.from?.humbugId || keptIds.has(c.from.humbugId)) && (!c.to?.humbugId || keptIds.has(c.to.humbugId))
        )
    }
    return out
}

/** One player's copy: only their own tokens are movable (and not while frozen) */
export function personalize(board: Record<string, unknown>, deviceId: string, frozen = false): Record<string, unknown> {
    const humbugs = board.humbugs as Humbug[] | undefined
    if (!humbugs) return board
    return {
        ...board,
        humbugs: humbugs.map((h) => {
            const free = ownerOf(h) === deviceId && !frozen
            return free === !h.locked ? h : { ...h, locked: !free }
        }),
    }
}
