import type { HumbugType, Point } from "../types/humbug.types"

/*
 * Window events for camera navigation, following the app's existing
 * CustomEvent pattern (exportBoard, clearBoard, ...). The whiteboard owns the
 * viewport, so other components ask it to move rather than set it directly.
 */

export const FLY_TO_EVENT = "jewel:flyTo"
export const ADD_SPOT_EVENT = "jewel:addSpot"

export interface FlyToDetail {
    /** World coordinate to centre on */
    x: number
    y: number
    /** Target zoom; keeps the current zoom when omitted */
    zoom?: number
}

export const HOME: FlyToDetail = { x: 0, y: 0, zoom: 1 }

export function flyTo(detail: FlyToDetail) {
    window.dispatchEvent(new CustomEvent(FLY_TO_EVENT, { detail }))
}

export function goHome() {
    flyTo(HOME)
}

/** Ask the app to create a new spot at a world position */
export function requestAddSpot(world: Point) {
    window.dispatchEvent(new CustomEvent(ADD_SPOT_EVENT, { detail: world }))
}

// ---- Hotkey-driven board actions (handled by HumbugManager, which knows
// the pointer position and selection)
export const CREATE_AT_CURSOR_EVENT = "jewel:createAtCursor"
export const SPOT_AT_CURSOR_EVENT = "jewel:spotAtCursor"
export const DELETE_SELECTION_EVENT = "jewel:deleteSelection"
export const SELECT_ALL_EVENT = "jewel:selectAll"

export function createAtCursor(type: HumbugType) {
    window.dispatchEvent(new CustomEvent(CREATE_AT_CURSOR_EVENT, { detail: type }))
}

export const dispatchBoardEvent = (name: string) =>
    window.dispatchEvent(new CustomEvent(name))

/**
 * Middle-mouse marquee finished: the rectangle in board-container screen
 * coordinates (so selection matches what you see in 2D and 2.5D alike)
 */
export const AREA_SELECT_EVENT = "jewel:areaSelect"
export interface AreaSelectDetail {
    x1: number
    y1: number
    x2: number
    y2: number
    /** Shift held: add to the current selection */
    additive: boolean
}

/** Drop the party's tokens around the middle of the screen */
export const ADD_PARTY_EVENT = "jewel:addParty"
