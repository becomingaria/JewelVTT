import React, { useEffect, useRef, useState } from "react"
import type { Spot } from "../types/spot.types"
import type { ScribbleLayer } from "../types/scribble.types"
import { Icon } from "./Icon"
import "./TopBar.css"

interface TopBarProps {
    onSidebarToggle: () => void
    onGoHome: () => void
    spots: Spot[]
    /** Spot whose tab should open in rename mode (e.g. one just created) */
    editingSpotId: string | null
    onEditingSpotChange: (id: string | null) => void
    onSpotSelect: (spot: Spot) => void
    onSpotRename: (id: string, name: string) => void
    onSpotDelete: (id: string) => void
    scribbleLayers: ScribbleLayer[]
    activeScribbleId: string | null
    scribbleDrawing: boolean
    onScribbleSelect: (id: string) => void
    onScribbleToggleVisible: (id: string) => void
    onScribbleDelete: (id: string) => void
}

interface SpotTabProps {
    spot: Spot
    isEditing: boolean
    onSelect: () => void
    onStartEdit: () => void
    onFinishEdit: (name: string | null) => void
    onDelete: () => void
}

/**
 * Rename field. Mounted fresh for every edit, so a draft discarded with
 * Escape can never leak into the next rename.
 */
const SpotNameInput: React.FC<{
    initialName: string
    onFinish: (name: string | null) => void
}> = ({ initialName, onFinish }) => {
    const [draft, setDraft] = useState(initialName)
    const inputRef = useRef<HTMLInputElement>(null)
    // Enter/Escape finish editing; ignore the blur that may follow
    const finishedRef = useRef(false)

    const finish = (name: string | null) => {
        if (finishedRef.current) return
        finishedRef.current = true
        onFinish(name)
    }

    useEffect(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
    }, [])

    return (
        <div className='spot-tab spot-tab-editing'>
            <Icon name='flag' size={18} />
            <input
                ref={inputRef}
                className='spot-tab-input'
                value={draft}
                maxLength={40}
                aria-label='Spot name'
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => finish(draft)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") finish(draft)
                    if (e.key === "Escape") finish(null)
                }}
            />
        </div>
    )
}

const SpotTab: React.FC<SpotTabProps> = ({
    spot,
    isEditing,
    onSelect,
    onStartEdit,
    onFinishEdit,
    onDelete,
}) => {
    if (isEditing) {
        return (
            <SpotNameInput initialName={spot.name} onFinish={onFinishEdit} />
        )
    }

    return (
        <div className='spot-tab'>
            <button
                type='button'
                className='spot-tab-main'
                onClick={onSelect}
                onDoubleClick={onStartEdit}
                onMouseDown={(e) => {
                    // Stop double-click word-selection, which would otherwise
                    // fight the rename field's select-all
                    if (e.detail > 1) e.preventDefault()
                }}
                title={`Go to ${spot.name} (double-click to rename)`}
            >
                <Icon name='flag' size={18} />
                <span className='spot-tab-name'>{spot.name}</span>
            </button>
            <button
                type='button'
                className='spot-tab-delete'
                onClick={onDelete}
                aria-label={`Remove ${spot.name}`}
                title='Remove spot'
            >
                <Icon name='close' size={14} />
            </button>
        </div>
    )
}

export const TopBar: React.FC<TopBarProps> = ({
    onSidebarToggle,
    onGoHome,
    spots,
    editingSpotId,
    onEditingSpotChange,
    onSpotSelect,
    onSpotRename,
    onSpotDelete,
    scribbleLayers,
    activeScribbleId,
    scribbleDrawing,
    onScribbleSelect,
    onScribbleToggleVisible,
    onScribbleDelete,
}) => {
    const tabsRef = useRef<HTMLDivElement>(null)

    // Scroll a newly added / edited tab into view
    useEffect(() => {
        if (!editingSpotId) return
        tabsRef.current
            ?.querySelector(".spot-tab-editing")
            ?.scrollIntoView({ inline: "nearest", block: "nearest" })
    }, [editingSpotId])

    return (
        <div className='top-bar'>
            <div className='top-bar-left'>
                <div className='menu-container'>
                    <button
                        className='hamburger-menu'
                        onClick={onSidebarToggle}
                        aria-label='Menu'
                    >
                        <div className='hamburger-line'></div>
                        <div className='hamburger-line'></div>
                        <div className='hamburger-line'></div>
                    </button>
                </div>
                <button
                    type='button'
                    className='top-bar-icon-button'
                    onClick={onGoHome}
                    aria-label='Go home'
                    title='Go home (centre of the board)'
                >
                    <Icon name='home' size={24} />
                </button>
                <div className='logo-container'>
                    <img
                        src='/jewelvtt.svg'
                        alt='Jewel VTT'
                        className='logo'
                        width={44}
                        height={34}
                    />
                </div>
            </div>

            {spots.length > 0 && (
                <div
                    className='spot-tabs'
                    ref={tabsRef}
                    role='toolbar'
                    aria-label='Saved spots'
                >
                    {spots.map((spot) => (
                        <SpotTab
                            key={spot.id}
                            spot={spot}
                            isEditing={editingSpotId === spot.id}
                            onSelect={() => onSpotSelect(spot)}
                            onStartEdit={() => onEditingSpotChange(spot.id)}
                            onFinishEdit={(name) => {
                                const trimmed = name?.trim()
                                if (trimmed) onSpotRename(spot.id, trimmed)
                                onEditingSpotChange(null)
                            }}
                            onDelete={() => onSpotDelete(spot.id)}
                        />
                    ))}
                </div>
            )}

            {scribbleLayers.length > 0 && (
                <div
                    className='spot-tabs scribble-tabs'
                    role='toolbar'
                    aria-label='Scribble layers'
                >
                    {scribbleLayers.map((layer) => {
                        const active = layer.id === activeScribbleId
                        return (
                            <div
                                key={layer.id}
                                className={`spot-tab scribble-tab ${
                                    active && scribbleDrawing ? "drawing" : ""
                                } ${layer.visible ? "" : "hidden-layer"}`}
                            >
                                <button
                                    type='button'
                                    className='spot-tab-main'
                                    onClick={() => onScribbleSelect(layer.id)}
                                    title={
                                        active && scribbleDrawing
                                            ? "Stop drawing"
                                            : `Draw on ${layer.name}`
                                    }
                                >
                                    <Icon
                                        name='scribble'
                                        size={18}
                                        className={
                                            active && scribbleDrawing
                                                ? "jicon-play"
                                                : ""
                                        }
                                    />
                                    <span className='spot-tab-name'>
                                        {layer.name}
                                    </span>
                                </button>
                                <button
                                    type='button'
                                    className='scribble-tab-eye'
                                    onClick={() =>
                                        onScribbleToggleVisible(layer.id)
                                    }
                                    aria-label={`${
                                        layer.visible ? "Hide" : "Show"
                                    } ${layer.name}`}
                                    aria-pressed={layer.visible}
                                    title={
                                        layer.visible ? "Hide layer" : "Show layer"
                                    }
                                >
                                    <Icon
                                        name={layer.visible ? "eye" : "eye-off"}
                                        size={16}
                                    />
                                </button>
                                <button
                                    type='button'
                                    className='spot-tab-delete'
                                    onClick={() => onScribbleDelete(layer.id)}
                                    aria-label={`Remove ${layer.name}`}
                                    title='Remove layer'
                                >
                                    <Icon name='close' size={14} />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
