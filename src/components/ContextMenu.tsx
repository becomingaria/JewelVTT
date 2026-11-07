import React, { useLayoutEffect, useRef, useState } from "react"
import type {
    Point,
    HumbugType,
    ContextMenuOption,
} from "../types/humbug.types"
import { Icon } from "./Icon"
import "./ContextMenu.css"

interface ContextMenuProps {
    position: Point
    isOpen: boolean
    onClose: () => void
    onCreateHumbug: (type: HumbugType, position: Point) => void
    snapToGrid: boolean
    onToggleSnapToGrid: () => void
    onGoHome: () => void
    onAddSpot: (position: Point) => void
}

const CONTEXT_MENU_OPTIONS: ContextMenuOption[] = [
    { label: "Text Box", type: "text", icon: "text" },
    { label: "Image", type: "image", icon: "image" },
    { label: "Map", type: "map", icon: "map" },
    { label: "Token", type: "token", icon: "token" },
    { label: "Map Pin", type: "map-pin", icon: "pin" },
    { label: "Solid Color", type: "solid-color", icon: "swatch" },
    { label: "Document / Link", type: "document", icon: "document" },
]

export const ContextMenu: React.FC<ContextMenuProps> = ({
    position,
    isOpen,
    onClose,
    onCreateHumbug,
    snapToGrid,
    onToggleSnapToGrid,
    onGoHome,
    onAddSpot,
}) => {
    const menuRef = useRef<HTMLDivElement>(null)
    const [placement, setPlacement] = useState(position)

    // Keep the menu inside the board: flip/shift it when it would overflow
    useLayoutEffect(() => {
        const menu = menuRef.current
        const bounds = menu?.offsetParent as HTMLElement | null
        if (!menu || !bounds) return
        const margin = 8
        const { offsetWidth: w, offsetHeight: h } = menu
        let { x, y } = position
        if (x + w + margin > bounds.clientWidth) x = Math.max(margin, x - w)
        if (y + h + margin > bounds.clientHeight)
            y = Math.max(margin, bounds.clientHeight - h - margin)
        setPlacement({ x, y })
    }, [position, isOpen])

    if (!isOpen) return null

    const handleOptionClick = (type: HumbugType) => {
        onCreateHumbug(type, position)
        onClose()
    }

    return (
        <>
            {/* Backdrop to close menu */}
            <div className='context-menu-backdrop' onClick={onClose} />

            {/* Context Menu */}
            <div
                ref={menuRef}
                className='context-menu'
                style={{
                    left: placement.x,
                    top: placement.y,
                }}
            >
                <div className='context-menu-header'>
                    <span>Add Humbug</span>
                </div>
                <div className='context-menu-options'>
                    {CONTEXT_MENU_OPTIONS.map((option) => (
                        <button
                            key={option.type}
                            className='context-menu-option'
                            onClick={() => handleOptionClick(option.type)}
                        >
                            <span className='option-icon'>
                                <Icon name={option.icon} />
                            </span>
                            <span className='option-label'>{option.label}</span>
                        </button>
                    ))}
                </div>

                <div className='context-menu-separator' />

                <div className='context-menu-options'>
                    <button
                        className='context-menu-option'
                        onClick={() => {
                            onAddSpot(position)
                            onClose()
                        }}
                    >
                        <span className='option-icon'>
                            <Icon name='flag' />
                        </span>
                        <span className='option-label'>Snap to Spot</span>
                    </button>
                    <button
                        className='context-menu-option'
                        onClick={() => {
                            onGoHome()
                            onClose()
                        }}
                    >
                        <span className='option-icon'>
                            <Icon name='home' />
                        </span>
                        <span className='option-label'>Go Home</span>
                    </button>
                </div>

                <div className='context-menu-separator' />

                <div className='context-menu-options'>
                    <button
                        className='context-menu-option toggle-option'
                        onClick={(e) => {
                            e.stopPropagation()
                            onToggleSnapToGrid()
                        }}
                    >
                        <span className='option-icon'>
                            <Icon
                                name='grid'
                                className={snapToGrid ? "" : "is-off"}
                            />
                        </span>
                        <span className='option-label'>Snap to Grid</span>
                        <span className='toggle-indicator'>
                            {snapToGrid ? "ON" : "OFF"}
                        </span>
                    </button>
                </div>
            </div>
        </>
    )
}
