import React, { useEffect, useRef, useState } from "react"
import { Icon } from "../../components/Icon"
import { useStore } from "../store"
import { useTableMode } from "../view-state"
import {
    addFrameFromView,
    currentViewRect,
    deleteFrame,
    goToFrame,
    panelFocusStore,
    panelStore,
    renameFrame,
    renameRequestStore,
    reorderFrame,
    setFrameRect,
    startPresenting,
    useFrames,
    usePanel,
    usePresent,
    type Frame,
} from "./state"
import { DownIcon, FitViewIcon, GoIcon, UpIcon } from "./icons"

/** Title field: commits on Enter / blur, Esc puts the old title back */
const TitleField: React.FC<{ frame: Frame; index: number }> = ({ frame, index }) => {
    const [value, setValue] = useState(frame.title)
    const [prevTitle, setPrevTitle] = useState(frame.title)
    // Follow outside changes (undo, rename on the board)
    if (prevTitle !== frame.title) {
        setPrevTitle(frame.title)
        setValue(frame.title)
    }
    return (
        <input
            className='ts-row-title'
            data-frame-id={frame.id}
            value={value}
            aria-label={`Title of frame ${index + 1}`}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => (value.trim() ? renameFrame(frame.id, value) : setValue(frame.title))}
            onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur()
                if (e.key === "Escape") {
                    e.stopPropagation()
                    setValue(frame.title)
                    requestAnimationFrame(() => (e.target as HTMLInputElement).blur())
                }
            }}
        />
    )
}

/**
 * Docked panel listing the board's frames in presentation order: rename,
 * reorder (drag the number, the arrow buttons, or Alt+↑/↓), go to, fit to
 * the current view, delete, and add one from the current view.
 */
export const FramesPanel: React.FC = () => {
    const panel = usePanel()
    const frames = useFrames()
    const tableMode = useTableMode()
    const present = usePresent()
    const focusTick = useStore(panelFocusStore)
    const renameId = useStore(renameRequestStore)
    const headingRef = useRef<HTMLHeadingElement>(null)
    const returnFocus = useRef<HTMLElement | null>(null)
    const [drag, setDrag] = useState<{ from: number; over: number } | null>(null)
    const visible = panel.open && !tableMode && !present

    // Opened on purpose (command / button): move focus in
    useEffect(() => {
        if (!focusTick || !visible) return
        returnFocus.current = document.activeElement as HTMLElement | null
        headingRef.current?.focus()
        // Only on an explicit open, not every re-show
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusTick])

    // Double-clicked a frame tab: focus its title field
    useEffect(() => {
        if (!renameId || !visible) return
        const el = document.querySelector<HTMLInputElement>(`.ts-panel input[data-frame-id="${renameId}"]`)
        el?.focus()
        el?.select()
        renameRequestStore.set(null)
    }, [renameId, visible])

    if (!visible) return null

    const close = () => {
        panelStore.set((p) => ({ ...p, open: false }))
        returnFocus.current?.focus?.()
        returnFocus.current = null
    }

    const onRowKey = (e: React.KeyboardEvent, i: number) => {
        if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return
        e.preventDefault()
        e.stopPropagation()
        reorderFrame(i, e.key === "ArrowUp" ? i - 1 : i + 1)
    }

    return (
        <section
            className={`ts-panel ${panel.collapsed ? "is-collapsed" : ""}`}
            role='dialog'
            aria-modal='false'
            aria-labelledby='ts-panel-title'
            onKeyDown={(e) => {
                if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) {
                    e.stopPropagation()
                    close()
                }
            }}
        >
            <header className='ts-panel-head'>
                <h2 id='ts-panel-title' ref={headingRef} tabIndex={-1}>
                    Frames <span className='ts-panel-count'>{frames.length}</span>
                </h2>
                <button
                    type='button'
                    className='ts-icon-btn'
                    aria-label={panel.collapsed ? "Expand frames panel" : "Collapse frames panel"}
                    aria-expanded={!panel.collapsed}
                    onClick={() => panelStore.set((p) => ({ ...p, collapsed: !p.collapsed }))}
                >
                    {panel.collapsed ? DownIcon : UpIcon}
                </button>
                <button type='button' className='ts-icon-btn' aria-label='Close frames panel' onClick={close}>
                    <Icon name='close' size={18} />
                </button>
            </header>

            {!panel.collapsed && (
                <>
                    {frames.length === 0 ? (
                        <p className='ts-panel-empty'>
                            No frames yet. Pick the <strong>Frame</strong> tool (<kbd>O</kbd>) and drag on the
                            board, or add one from what's on screen now.
                        </p>
                    ) : (
                        <ol className='ts-frame-list'>
                            {frames.map((f, i) => (
                                <li
                                    key={f.id}
                                    className={`ts-frame-row ${drag?.over === i && drag.from !== i ? "is-drop" : ""}`}
                                    onKeyDown={(e) => onRowKey(e, i)}
                                    onDragOver={(e) => {
                                        if (!drag) return
                                        e.preventDefault()
                                        if (drag.over !== i) setDrag({ ...drag, over: i })
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault()
                                        if (drag) reorderFrame(drag.from, i)
                                        setDrag(null)
                                    }}
                                >
                                    <span
                                        className='ts-row-num'
                                        draggable
                                        title='Drag to reorder (or Alt+↑ / Alt+↓)'
                                        onDragStart={(e) => {
                                            e.dataTransfer.effectAllowed = "move"
                                            e.dataTransfer.setData("text/plain", f.id)
                                            setDrag({ from: i, over: i })
                                        }}
                                        onDragEnd={() => setDrag(null)}
                                    >
                                        {i + 1}
                                    </span>
                                    <TitleField frame={f} index={i} />
                                    <div className='ts-row-actions'>
                                        <button
                                            type='button'
                                            className='ts-icon-btn'
                                            aria-label={`Go to ${f.title}`}
                                            title='Go to'
                                            onClick={() => goToFrame(f)}
                                        >
                                            {GoIcon}
                                        </button>
                                        <button
                                            type='button'
                                            className='ts-icon-btn'
                                            aria-label={`Move ${f.title} earlier`}
                                            title='Move earlier (Alt+↑)'
                                            disabled={i === 0}
                                            onClick={() => reorderFrame(i, i - 1)}
                                        >
                                            {UpIcon}
                                        </button>
                                        <button
                                            type='button'
                                            className='ts-icon-btn'
                                            aria-label={`Move ${f.title} later`}
                                            title='Move later (Alt+↓)'
                                            disabled={i === frames.length - 1}
                                            onClick={() => reorderFrame(i, i + 1)}
                                        >
                                            {DownIcon}
                                        </button>
                                        <button
                                            type='button'
                                            className='ts-icon-btn'
                                            aria-label={`Fit ${f.title} to the current view`}
                                            title='Fit to the current view'
                                            onClick={() => {
                                                const r = currentViewRect()
                                                if (r) setFrameRect(f.id, r)
                                            }}
                                        >
                                            {FitViewIcon}
                                        </button>
                                        <button
                                            type='button'
                                            className='ts-icon-btn ts-danger'
                                            aria-label={`Delete ${f.title}`}
                                            title='Delete (undo with ⌘Z / Ctrl+Z)'
                                            onClick={() => deleteFrame(f.id)}
                                        >
                                            <Icon name='trash' size={18} />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                    <footer className='ts-panel-foot'>
                        <button type='button' className='ts-btn' onClick={() => addFrameFromView()}>
                            + Add frame from current view
                        </button>
                        <button
                            type='button'
                            className='ts-btn ts-btn-primary'
                            onClick={startPresenting}
                            aria-keyshortcuts='Shift+P'
                        >
                            ▶ Present <kbd>Shift+P</kbd>
                        </button>
                    </footer>
                </>
            )}
        </section>
    )
}
