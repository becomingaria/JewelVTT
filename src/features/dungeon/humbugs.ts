import type { Humbug, ImageHumbug, TextHumbug } from "../../types/humbug.types"
import { humbugBase, updateHumbugs } from "../board-bridge"
import { SQUARE, type Cell } from "../grid"
import {
    FEATURE_ID,
    isHiddenState,
    type DungeonExt,
    type StampId,
    type StampState,
} from "./model"
import { spriteUrl } from "./sprites"

/*
 * Doors, traps, secret doors and dressing are ordinary image humbugs (so
 * they drag, select, undo and use layers for free) carrying
 * ext.dungeon = { stamp, state }. Hidden secret doors and traps live on the
 * GM layer, which keeps them out of Table Mode.
 */

/** One entry in the stamp palette */
export interface PaletteEntry {
    id: string
    label: string
    stamp: StampId
    state?: StampState
}

export const PALETTE: PaletteEntry[] = [
    { id: "door", label: "Door", stamp: "door", state: "closed" },
    { id: "secret", label: "Secret door", stamp: "secret", state: "hidden" },
    { id: "portcullis", label: "Portcullis", stamp: "door", state: "portcullis" },
    { id: "trap", label: "Trap", stamp: "trap", state: "hidden" },
    { id: "stairs-up", label: "Stairs up", stamp: "stairs-up" },
    { id: "stairs-down", label: "Stairs down", stamp: "stairs-down" },
    { id: "trapdoor", label: "Trapdoor", stamp: "trapdoor" },
    { id: "pillar", label: "Pillar", stamp: "pillar" },
    { id: "statue", label: "Statue", stamp: "statue" },
    { id: "chest", label: "Chest", stamp: "chest" },
    { id: "altar", label: "Altar", stamp: "altar" },
    { id: "well", label: "Well", stamp: "well" },
    { id: "fountain", label: "Fountain", stamp: "fountain" },
    { id: "table", label: "Table", stamp: "table" },
    { id: "bed", label: "Bed", stamp: "bed" },
    { id: "barrel", label: "Barrel", stamp: "barrel" },
    { id: "crate", label: "Crate", stamp: "crate" },
    { id: "rubble", label: "Rubble", stamp: "rubble" },
    { id: "web", label: "Cobweb", stamp: "web" },
    { id: "bones", label: "Bones", stamp: "bones" },
]

/** The fog-light extras without a manual "Blocks sight" (the door's state decides) */
function withoutBlocksSight(v: unknown): Record<string, unknown> | undefined {
    if (!v || typeof v !== "object") return undefined
    const rest = { ...(v as Record<string, unknown>) }
    delete rest.blocksSight
    return Object.keys(rest).length ? rest : undefined
}

export const dungeonExt = (h: Humbug): DungeonExt | undefined => {
    const d = h.ext?.[FEATURE_ID] as DungeonExt | undefined
    return d && typeof d === "object" && "stamp" in d ? d : undefined
}

const cellTopLeft = (c: Cell) => ({ x: c.col * SQUARE, y: c.row * SQUARE })

/** A stamp humbug filling one grid square */
export function stampHumbug(stamp: StampId, state: StampState | undefined, cell: Cell, rotation = 0): ImageHumbug {
    const ext: DungeonExt = state ? { stamp, state } : { stamp }
    return {
        ...humbugBase(cellTopLeft(cell)),
        type: "image",
        rotation,
        imageUrl: spriteUrl(stamp, state),
        size: { width: SQUARE, height: SQUARE },
        originalSize: { width: SQUARE, height: SQUARE },
        layer: isHiddenState(stamp, state) ? "gm" : "objects",
        ext: { [FEATURE_ID]: ext },
    }
}

/** Classic room number, top-left of its room */
export function labelHumbug(room: number, cell: Cell): TextHumbug {
    return {
        ...humbugBase(cellTopLeft(cell)),
        type: "text",
        content: String(room),
        fontSize: 13,
        fontFamily: "var(--jv-font-mono, ui-monospace, monospace)",
        color: "#1b1b24",
        backgroundColor: "transparent",
        textAlign: "left",
        size: { width: SQUARE, height: SQUARE },
        layer: "objects",
        ext: { [FEATURE_ID]: { stamp: "label", room } satisfies DungeonExt },
    }
}

/** Change a stamp's state: sprite, layer and ext together, one undo step.
 *  A door's own "Blocks sight" setting is cleared, so opening it lets sight through. */
export function setStampState(h: Humbug, state: StampState) {
    const d = dungeonExt(h)
    if (!d || d.stamp === "label" || h.type !== "image") return
    const ext: DungeonExt = { ...d, state }
    updateHumbugs([
        {
            id: h.id,
            changes: {
                imageUrl: spriteUrl(d.stamp, state),
                layer: isHiddenState(d.stamp, state) ? "gm" : "objects",
                ext: { ...h.ext, [FEATURE_ID]: ext, "fog-light": withoutBlocksSight(h.ext?.["fog-light"]) },
            } as Partial<Humbug>,
        },
    ])
}
