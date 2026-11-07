import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { Spot } from "../types/spot.types"
import type { ScribbleLayer } from "../types/scribble.types"
import type { ViewMode } from "../utils/projection"
import type { Scene } from "../utils/use-local-boards"
import type { ScribbleExportFormat } from "../utils/scribble-art"

const EXPORT_OPTIONS: { format: ScribbleExportFormat; label: string; hint: string }[] = [
    { format: "png-transparent", label: "PNG · transparent", hint: "Just the lines" },
    { format: "png-white", label: "PNG · white", hint: "Lines on white" },
    { format: "svg", label: "SVG", hint: "Sharp at any size" },
]

/** Small export menu anchored under a tab button (portalled: tabs scroll) */
const ExportMenu: React.FC<{
    anchor: HTMLElement
    onPick: (format: ScribbleExportFormat) => void
    onClose: () => void
}> = ({ anchor, onPick, onClose }) => {
    const ref = useRef<HTMLDivElement>(null)
    const rect = anchor.getBoundingClientRect()
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose()
        }
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
        window.addEventListener("mousedown", onDown)
        window.addEventListener("keydown", onKey)
        return () => {
            window.removeEventListener("mousedown", onDown)
            window.removeEventListener("keydown", onKey)
        }
    }, [anchor, onClose])
    return createPortal(
        <div
            ref={ref}
            className='layer-export-menu'
            role='menu'
            style={{ top: rect.bottom + 6, left: Math.max(8, rect.left + rect.width / 2 - 100) }}
        >
            <div className='layer-export-title'>Export layer</div>
            {EXPORT_OPTIONS.map((o) => (
                <button key={o.format} type='button' role='menuitem' onClick={() => onPick(o.format)}>
                    <span>{o.label}</span>
                    <small>{o.hint}</small>
                </button>
            ))}
        </div>,
        document.body
    )
}
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
    onScribbleExport: (id: string, format: ScribbleExportFormat) => void
    viewMode: ViewMode
    onViewModeChange: (mode: ViewMode) => void
    scenes: Scene[]
    activeSceneId: string | null
    onSceneSelect: (id: string) => void
    onSceneClose: (id: string) => void
}

/** Prepared scene tabs: click to switch boards, × to close */
const SceneTabs: React.FC<{
    scenes: Scene[]
    activeSceneId: string | null
    onSelect: (id: string) => void
    onClose: (id: string) => void
}> = ({ scenes, activeSceneId, onSelect, onClose }) => {
    // Closing a scene with unsaved changes takes a second click
    const [confirmId, setConfirmId] = useState<string | null>(null)
    useEffect(() => {
        if (!confirmId) return
        const t = window.setTimeout(() => setConfirmId(null), 3000)
        return () => window.clearTimeout(t)
    }, [confirmId])

    return (
        <div className='spot-tabs scene-tabs' role='tablist' aria-label='Prepared scenes'>
            {scenes.map((scene) => {
                const active = scene.id === activeSceneId
                const confirming = confirmId === scene.id
                return (
                    <div key={scene.id} className={`spot-tab scene-tab ${active ? "active" : ""}`}>
                        <button
                            type='button'
                            role='tab'
                            aria-selected={active}
                            className='spot-tab-main'
                            onClick={() => onSelect(scene.id)}
                            title={
                                scene.fileName
                                    ? `${scene.fileName}${scene.dirty ? " (unsaved changes)" : ""}`
                                    : "Not saved to the folder yet"
                            }
                        >
                            <Icon name='map' size={18} className={active ? "jicon-play" : ""} />
                            <span className={`spot-tab-name ${scene.fileName ? "" : "unsaved-name"}`}>
                                {scene.name}
                            </span>
                            {scene.dirty && <span className='scene-dirty' aria-label='Unsaved changes' />}
                        </button>
                        {confirming ? (
                            <button
                                type='button'
                                className='scene-discard'
                                onClick={() => {
                                    setConfirmId(null)
                                    onClose(scene.id)
                                }}
                            >
                                Discard?
                            </button>
                        ) : (
                            <button
                                type='button'
                                className='spot-tab-delete'
                                aria-label={`Close ${scene.name}`}
                                title='Close scene'
                                onClick={() => (scene.dirty ? setConfirmId(scene.id) : onClose(scene.id))}
                            >
                                <Icon name='close' size={14} />
                            </button>
                        )}
                    </div>
                )
            })}
        </div>
    )
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
    onScribbleExport,
    viewMode,
    onViewModeChange,
    scenes,
    activeSceneId,
    onSceneSelect,
    onSceneClose,
}) => {
    const tabsRef = useRef<HTMLDivElement>(null)
    const [exportFor, setExportFor] = useState<{ id: string; anchor: HTMLElement } | null>(null)

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

            {scenes.length > 0 && (
                <SceneTabs
                    scenes={scenes}
                    activeSceneId={activeSceneId}
                    onSelect={onSceneSelect}
                    onClose={onSceneClose}
                />
            )}

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
                                    className={`scribble-tab-eye scribble-tab-export ${
                                        exportFor?.id === layer.id ? "open" : ""
                                    }`}
                                    onClick={(e) => {
                                        const anchor = e.currentTarget
                                        setExportFor((cur) =>
                                            cur?.id === layer.id ? null : { id: layer.id, anchor }
                                        )
                                    }}
                                    aria-label={`Export ${layer.name}`}
                                    aria-haspopup='menu'
                                    aria-expanded={exportFor?.id === layer.id}
                                    title='Export this layer as an image'
                                >
                                    <Icon name='export' size={16} />
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

            {exportFor && (
                <ExportMenu
                    anchor={exportFor.anchor}
                    onClose={() => setExportFor(null)}
                    onPick={(format) => {
                        onScribbleExport(exportFor.id, format)
                        setExportFor(null)
                    }}
                />
            )}

            <div
                className={`view-toggle ${viewMode === "iso" ? "is-iso" : ""}`}
                role='radiogroup'
                aria-label='Camera view'
                title='Switch view (V)'
            >
                <span className='view-toggle-thumb' aria-hidden='true' />
                <button
                    type='button'
                    role='radio'
                    aria-checked={viewMode === "2d"}
                    onClick={() => onViewModeChange("2d")}
                >
                    2D
                </button>
                <button
                    type='button'
                    role='radio'
                    aria-checked={viewMode === "iso"}
                    onClick={() => onViewModeChange("iso")}
                >
                    2.5D
                </button>
            </div>
        </div>
    )
}
