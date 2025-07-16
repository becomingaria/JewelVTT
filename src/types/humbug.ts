// Core types for the Humbug system
export interface Point {
    x: number
    y: number
}

export type HumbugType = "text" | "image" | "map-pin" | "solid-color"

export interface Humbug {
    id: string
    type: HumbugType
    position: Point
    rotation: number // degrees
    locked: boolean
    zIndex: number
    content: HumbugContent
    createdAt: string
    updatedAt: string
}

export interface HumbugContent {
    // For text type
    text?: string
    fontSize?: number
    fontFamily?: string
    fontWeight?: string
    color?: string

    // For image type
    imageUrl?: string
    imageWidth?: number
    imageHeight?: number

    // For map-pin type
    pinColor?: string
    pinSize?: number

    // For solid-color type
    backgroundColor?: string
    width?: number
    height?: number
}

export interface ContextMenuProps {
    position: Point
    onClose: () => void
    onCreateHumbug: (type: HumbugType, position: Point) => void
}

export interface HumbugModalProps {
    humbug: Humbug | null
    isOpen: boolean
    onClose: () => void
    onSave: (humbug: Humbug) => void
    onDelete: (id: string) => void
}
