import React, { useEffect, useId, useRef, useState } from "react"
import { useStore } from "../store"
import { panelLayout, panelOpen, type PanelId } from "./state"

/*
 * A docked, non-modal panel. Opens next to the dock (tray) or on the right
 * edge (tables, log), collapses to its title bar, and can be dragged by the
 * title bar; double-click the title bar to dock it back. Position and
 * open/collapsed state are remembered per viewer.
 *
 * Focus moves in when the user opens it and goes back on close. Esc closes.
 */

interface DockPanelProps {
    id: PanelId
    title: string
    icon: React.ReactNode
    children: React.ReactNode
    /** Extra controls in the title bar, before collapse/close */
    headerExtra?: React.ReactNode
}

const FOCUSABLE = 'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])'

export const DockPanel: React.FC<DockPanelProps> = (props) => {
    const open = useStore(panelOpen[props.id])
    // Focus moves in only when the user opens it, not on page load
    const wantFocus = useRef(false)
    useEffect(
        () =>
            panelOpen[props.id].subscribe(() => {
                if (panelOpen[props.id].get()) wantFocus.current = true
            }),
        [props.id]
    )
    return open ? <PanelShell {...props} wantFocus={wantFocus} /> : null
}

const PIXEL_X = Array.from({ length: 5 }, (_, i) => `M${3 + i * 2} ${3 + i * 2}h2v2h-2zM${11 - i * 2} ${3 + i * 2}h2v2h-2z`).join("")

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const PanelShell: React.FC<DockPanelProps & { wantFocus: React.RefObject<boolean> }> = ({
    id,
    title,
    icon,
    children,
    headerExtra,
    wantFocus,
}) => {
    const layout = useStore(panelLayout[id])
    const ref = useRef<HTMLElement>(null)
    const titleId = useId()
    const bodyId = useId()
    const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
    const drag = useRef<{ dx: number; dy: number; pointer: number } | null>(null)

    useEffect(() => {
        const el = ref.current
        const previous = document.activeElement as HTMLElement | null
        if (wantFocus.current && el) {
            wantFocus.current = false
            const body = el.querySelector(".jv-dpanel-body:not([hidden])")
            const target =
                el.querySelector<HTMLElement>("[data-autofocus]") ??
                body?.querySelector<HTMLElement>(FOCUSABLE) ??
                el.querySelector<HTMLElement>(FOCUSABLE)
            target?.focus()
        }
        return () => {
            const now = document.activeElement
            const lost = !now || now === document.body || (el?.contains(now) ?? false)
            if (lost && previous?.isConnected && previous !== document.body) previous.focus()
        }
    }, [wantFocus])

    const close = () => panelOpen[id].set(false)
    const setCollapsed = (collapsed: boolean) => panelLayout[id].set((l) => ({ ...l, collapsed }))

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
            e.preventDefault()
            e.stopPropagation()
            close()
        }
    }

    const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
        if (e.button !== 0 || (e.target as HTMLElement).closest("button, input, select, textarea")) return
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return
        drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, pointer: e.pointerId }
        e.currentTarget.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: React.PointerEvent) => {
        const d = drag.current
        if (!d || d.pointer !== e.pointerId) return
        setDragPos({
            x: clamp(e.clientX - d.dx, 0, window.innerWidth - 80),
            y: clamp(e.clientY - d.dy, 0, window.innerHeight - 40),
        })
    }
    const onPointerUp = (e: React.PointerEvent) => {
        const d = drag.current
        if (!d || d.pointer !== e.pointerId) return
        drag.current = null
        if (dragPos) panelLayout[id].set((l) => ({ ...l, pos: dragPos }))
        setDragPos(null)
    }

    const pos = dragPos ?? layout.pos
    const style: React.CSSProperties | undefined = pos
        ? {
              left: clamp(pos.x, 0, window.innerWidth - 80),
              top: clamp(pos.y, 0, window.innerHeight - 40),
              right: "auto",
              bottom: "auto",
          }
        : undefined

    return (
        <section
            ref={ref}
            className={`jv-dpanel jv-dpanel--${id} ${pos ? "jv-dpanel--moved" : ""}`}
            style={style}
            role='dialog'
            aria-labelledby={titleId}
            onKeyDown={onKeyDown}
        >
            <div className='jv-dpanel-inner'>
                <header
                    className='jv-dpanel-head'
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onDoubleClick={(e) => {
                        if ((e.target as HTMLElement).closest("button")) return
                        panelLayout[id].set((l) => ({ ...l, pos: null }))
                    }}
                    title='Drag to move. Double-click to dock it back.'
                >
                    <span className='jv-dpanel-icon' aria-hidden='true'>
                        {icon}
                    </span>
                    <h2 id={titleId} className='jv-dpanel-title'>
                        {title}
                    </h2>
                    {headerExtra}
                    <button
                        type='button'
                        className='jv-btn jv-btn--icon'
                        aria-expanded={!layout.collapsed}
                        aria-controls={bodyId}
                        aria-label={layout.collapsed ? `Expand ${title}` : `Collapse ${title}`}
                        title={layout.collapsed ? "Expand" : "Collapse"}
                        onClick={() => setCollapsed(!layout.collapsed)}
                    >
                        <svg width='16' height='16' viewBox='0 0 16 16' aria-hidden='true' shapeRendering='crispEdges'>
                            {layout.collapsed ? (
                                <path d='M3 6h10v2H11v2H9v2H7v-2H5V8H3z' fill='currentColor' />
                            ) : (
                                <path d='M3 10h10V8h-2V6H9V4H7v2H5v2H3z' fill='currentColor' />
                            )}
                        </svg>
                    </button>
                    <button
                        type='button'
                        className='jv-btn jv-btn--icon'
                        aria-label={`Close ${title}`}
                        title='Close (Esc)'
                        onClick={close}
                    >
                        <svg width='16' height='16' viewBox='0 0 16 16' aria-hidden='true' shapeRendering='crispEdges'>
                            <path d={PIXEL_X} fill='currentColor' />
                        </svg>
                    </button>
                </header>
                <div className='jv-dpanel-body' id={bodyId} hidden={layout.collapsed}>
                    {children}
                </div>
            </div>
        </section>
    )
}
