import React from "react"
import type {
    Point,
    HumbugContextMenuOption,
    Humbug,
} from "../types/humbug.types"
import { Icon } from "./Icon"
import "./HumbugContextMenu.css"

interface HumbugContextMenuProps {
    position: Point
    isOpen: boolean
    humbug: Humbug | null
    onClose: () => void
    onAction: (action: string, humbugId: string) => void
}

export const HumbugContextMenu: React.FC<HumbugContextMenuProps> = ({
    position,
    isOpen,
    humbug,
    onClose,
    onAction,
}) => {
    if (!isOpen || !humbug) return null

    const getContextMenuOptions = (): HumbugContextMenuOption[] => {
        const baseOptions: HumbugContextMenuOption[] = [
            { label: "Edit", action: "edit", icon: "edit" },
            {
                label: humbug.locked ? "Unlock" : "Lock",
                action: humbug.locked ? "unlock" : "lock",
                icon: humbug.locked ? "unlock" : "lock",
            },
            { label: "Bring to Front", action: "bringToFront", icon: "to-front" },
            { label: "Send to Back", action: "sendToBack", icon: "to-back" },
            { label: "Bring Forward", action: "bringForward", icon: "forward" },
            { label: "Send Backward", action: "sendBackward", icon: "backward" },
            { label: "Delete", action: "delete", icon: "trash" },
        ]

        return baseOptions
    }

    const handleOptionClick = (action: string) => {
        onAction(action, humbug.id)
        onClose()
    }

    const options = getContextMenuOptions()

    return (
        <>
            {/* Backdrop to close menu */}
            <div className='humbug-context-menu-backdrop' onClick={onClose} />

            {/* Context Menu */}
            <div
                className='humbug-context-menu'
                style={{
                    left: position.x,
                    top: position.y,
                }}
            >
                <div className='humbug-context-menu-header'>
                    <span>Humbug Options</span>
                </div>
                <div className='humbug-context-menu-options'>
                    {options.map((option) => (
                        <button
                            key={option.action}
                            className={`humbug-context-menu-option ${
                                option.action === "delete" ? "danger" : ""
                            }`}
                            onClick={() => handleOptionClick(option.action)}
                        >
                            <span className='option-icon'>
                                <Icon name={option.icon} />
                            </span>
                            <span className='option-label'>{option.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </>
    )
}
