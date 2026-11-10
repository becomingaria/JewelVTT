import React from "react"
import type {
    Point,
    HumbugContextMenuOption,
    Humbug,
} from "../types/humbug.types"
import { Icon } from "./Icon"
import { FEATURES } from "../features/registry"
import { FeatureIcon } from "../features/host/FeatureIcon"
import { PLAYER_ALLOWED, netRoleStore } from "../features/view-state"
import "./HumbugContextMenu.css"

interface HumbugContextMenuProps {
    position: Point
    isOpen: boolean
    humbug: Humbug | null
    onClose: () => void
    onAction: (action: string, humbugId: string) => void
    /** The token's image is already in "My Party" */
    inParty?: boolean
    /** Focus the first option on open (keyboard users arriving from the radial menu's "More…") */
    autoFocus?: boolean
}

export const HumbugContextMenu: React.FC<HumbugContextMenuProps> = ({
    position,
    isOpen,
    humbug,
    onClose,
    onAction,
    inParty = false,
    autoFocus = false,
}) => {
    if (!isOpen || !humbug) return null

    const player = netRoleStore.get() === "player"
    const getContextMenuOptions = (): HumbugContextMenuOption[] => {
        // A connected player only gets light and vision (feature items below)
        if (player) return []
        const baseOptions: HumbugContextMenuOption[] = [
            { label: "Edit", action: "edit", icon: "edit" },
            ...(humbug.type === "token"
                ? [
                      inParty
                          ? { label: "Remove from Party", action: "removeFromParty" as const, icon: "token" as const }
                          : { label: "Add to Party", action: "addToParty" as const, icon: "token" as const },
                  ]
                : []),
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
                    {options.map((option, i) => (
                        <button
                            key={option.action}
                            autoFocus={autoFocus && i === 0}
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
                    {/* Entries contributed by features (light, HP, layers...) */}
                    {FEATURES.flatMap((f) => f.humbugMenu ?? [])
                        .filter((item) => (!item.when || item.when(humbug)) && (!player || PLAYER_ALLOWED.menu(item.id)))
                        .map((item) => (
                            <button
                                key={item.id}
                                className='humbug-context-menu-option'
                                onClick={() => {
                                    item.run(humbug)
                                    onClose()
                                }}
                            >
                                <span className='option-icon'>
                                    <FeatureIcon icon={item.icon} />
                                </span>
                                <span className='option-label'>{item.label}</span>
                            </button>
                        ))}
                </div>
            </div>
        </>
    )
}
