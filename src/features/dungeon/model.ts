/*
 * Shared vocabulary for the dungeon feature: stamps, their states and the
 * data stored on humbugs as ext.dungeon.
 */

export const FEATURE_ID = "dungeon"

/** Dock tool / board mode ids */
export const ROOMS_TOOL = "dungeon-rooms"
export const STAMP_TOOL = "dungeon-stamp"
export const PALETTE_TOOL = "dungeon-palette"

export type StaticStampId =
    | "stairs-up"
    | "stairs-down"
    | "pillar"
    | "statue"
    | "chest"
    | "altar"
    | "well"
    | "rubble"
    | "web"
    | "bones"
    | "table"
    | "bed"
    | "barrel"
    | "crate"
    | "fountain"
    | "trapdoor"

/** Stamps that change state from the right-click menu */
export type StatefulStampId = "door" | "secret" | "trap"

export type StampId = StaticStampId | StatefulStampId

export type DoorState = "open" | "closed" | "locked" | "barred" | "portcullis"
export type SecretState = "hidden" | "found"
export type TrapState = "hidden" | "armed" | "sprung"
export type StampState = DoorState | SecretState | TrapState

/** Stored on humbugs as ext.dungeon */
export interface DungeonExt {
    stamp: StampId | "label"
    state?: StampState
    /** Room number (labels only) */
    room?: number
}

/** States that belong on the GM-only layer */
export const isHiddenState = (stamp: StampId | "label", state?: StampState) =>
    (stamp === "secret" || stamp === "trap") && state === "hidden"
