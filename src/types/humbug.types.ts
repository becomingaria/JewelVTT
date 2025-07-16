// Core types for the Humbug system

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

export type Humbug =
    | TextHumbug
    | ImageHumbug
    | MapPinHumbug
    | SolidColorHumbug
    | MapHumbug
    | TokenHumbug

export interface ContextMenuOption {
    label: string
    type: HumbugType
    icon: string
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
    icon: string
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
