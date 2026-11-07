// Core types for the Humbug system

import type { IconName } from "../components/Icon"

export interface Point {
    x: number
    y: number
}

export interface Size {
    width: number
    height: number
}

export interface HumbugBase {
    id: string
    type: HumbugType
    position: Point
    rotation: number // in degrees
    locked: boolean
    zIndex: number
    opacity: number // 0.0 to 1.0
    createdAt: number
    updatedAt: number
}

export type HumbugType =
    | "text"
    | "image"
    | "map-pin"
    | "solid-color"
    | "map"
    | "token"
    | "document"

export interface TextHumbug extends HumbugBase {
    type: "text"
    content: string
    fontSize: number
    fontFamily: string
    color: string
    backgroundColor?: string
    textAlign: "left" | "center" | "right"
    size: Size
}

export interface ImageHumbug extends HumbugBase {
    type: "image"
    imageUrl: string
    size: Size
    originalSize: Size
}

export interface MapPinHumbug extends HumbugBase {
    type: "map-pin"
    color: string
    size: number
    label?: string
}

export interface SolidColorHumbug extends HumbugBase {
    type: "solid-color"
    color: string
    size: Size
}

export interface MapHumbug extends HumbugBase {
    type: "map"
    imageUrl: string
    size: Size
    originalSize: Size
    showGrid: boolean
}

export interface TokenHumbug extends HumbugBase {
    type: "token"
    imageUrl: string
    size: Size
    originalSize: Size
    borderColor: string
    borderWidth: number
}

/** A link (e.g. a Notion page) or an attached file, shown as a card */
export interface DocumentHumbug extends HumbugBase {
    type: "document"
    title: string
    /** External http(s) link */
    url?: string
    /** Attached file as a data URL (kept inside saved boards) */
    fileData?: string
    fileName?: string
    mimeType?: string
    note?: string
    size: Size
}

export type Humbug =
    | DocumentHumbug
    | TextHumbug
    | ImageHumbug
    | MapPinHumbug
    | SolidColorHumbug
    | MapHumbug
    | TokenHumbug

export interface ContextMenuOption {
    label: string
    type: HumbugType
    icon: IconName
}

export interface HumbugContextMenuOption {
    label: string
    action:
        | "edit"
        | "lock"
        | "unlock"
        | "bringToFront"
        | "sendToBack"
        | "bringForward"
        | "sendBackward"
        | "delete"
    icon: IconName
}

export interface DragTail {
    humbugId: string
    startPoint: Point
    currentPoint: Point
    markers: Point[]
    distance: number // in grid units
}

export interface HumbugState {
    humbugs: Humbug[]
    selectedHumbugId: string | null
    dragTail: DragTail | null
    contextMenu: {
        isOpen: boolean
        position: Point
    }
    humbugContextMenu: {
        isOpen: boolean
        position: Point
        humbugId: string | null
    }
}
