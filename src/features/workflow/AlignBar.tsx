import React, { useEffect, useRef } from "react"
import { Icon } from "../../components/Icon"
import { humbugFootprint } from "../../utils/humbug.utils"
import { useCamera, useHumbugs, useSelection } from "../board-bridge"
import { FeatureIcon } from "../host/FeatureIcon"
import type { AlignOp } from "./align"
import { runAlign, snapSelectionToGrid } from "./actions"
import { AlignIcon, SnapIcon } from "./icons"
import { alignBarOpenStore } from "./state"

/*
 * Floating align bar (#23), opened with Shift+A when 2+ objects are
 * selected. Sits just above the selection. Each button is one undo step.
 * Closes on Esc, on its × button, or when the selection changes.
 */

const GROUPS: { op: AlignOp; label: string }[][] = [
    [
        { op: "left", label: "Align left edges" },
        { op: "centre", label: "Align centres (horizontally)" },
        { op: "right", label: "Align right edges" },
    ],
    [
        { op: "top", label: "Align top edges" },
        { op: "middle", label: "Align middles (vertically)" },
        { op: "bottom", label: "Align bottom edges" },
    ],
    [
        { op: "distribute-h", label: "Distribute horizontally (equal gaps)" },
        { op: "distribute-v", label: "Distribute vertically (equal gaps)" },
    ],
]

const BAR_HALF_WIDTH = 230

export const AlignBar: React.FC = () => {
    const camera = useCamera()
    const humbugs = useHumbugs()
    const selection = useSelection()
    const barRef = useRef<HTMLDivElement>(null)
    const returnFocus = useRef<HTMLElement | null>(null)
    const openedWith = useRef<string | null>(null)

    const close = () => {
        const bar = barRef.current
        const hadFocus = !!bar && bar.contains(document.activeElement)
        alignBarOpenStore.set(false)
        if (hadFocus && returnFocus.current?.isConnected) returnFocus.current.focus()
    }
    const closeRef = useRef(close)
    useEffect(() => {
        closeRef.current = close
    })

    // Move focus in on open (the user asked for the bar with a key)
    useEffect(() => {
        returnFocus.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
        barRef.current?.querySelector<HTMLElement>("button")?.focus()
    }, [])

    // Close when the selection changes (moving objects doesn't change it)
    const selKey = [...selection].sort().join(",")
    useEffect(() => {
        if (openedWith.current === null) openedWith.current = selKey
        else if (selKey !== openedWith.current) closeRef.current()
        if (selection.length < 2) closeRef.current()
    }, [selKey, selection.length])

    // Place the bar centred above the selection (below it near the top edge)
    const style: React.CSSProperties = { left: "50%", top: 80, transform: "translateX(-50%)" }
    const el = camera?.container
    const sel = humbugs.filter((h) => selection.includes(h.id))
    if (camera && el && sel.length) {
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
        for (const h of sel) {
            const f = humbugFootprint(h)
            for (const [wx, wy] of [
                [h.position.x, h.position.y],
                [h.position.x + f.width, h.position.y],
                [h.position.x, h.position.y + f.height],
                [h.position.x + f.width, h.position.y + f.height],
            ]) {
                const p = camera.worldToScreen(wx, wy)
                x1 = Math.min(x1, p.x)
                y1 = Math.min(y1, p.y)
                x2 = Math.max(x2, p.x)
                y2 = Math.max(y2, p.y)
            }
        }
        const r = el.getBoundingClientRect()
        const vw = window.innerWidth
        const cx = r.left + (x1 + x2) / 2
        const above = r.top + y1 - 60
        style.left = Math.min(Math.max(cx, Math.min(BAR_HALF_WIDTH, vw / 2)), vw - Math.min(BAR_HALF_WIDTH, vw / 2))
        style.top = above > 64 ? above : Math.min(r.top + y2 + 16, window.innerHeight - 60)
    }

    const onKeyDown = (e: React.KeyboardEvent) => {
        const buttons = [...(barRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const go = (n: number) => buttons[(n + buttons.length) % buttons.length]?.focus()
        switch (e.key) {
            case "Escape":
                close()
                break
            case "ArrowRight":
            case "ArrowDown":
                go(i + 1)
                break
            case "ArrowLeft":
            case "ArrowUp":
                go(i - 1)
                break
            case "Home":
                go(0)
                break
            case "End":
                go(buttons.length - 1)
                break
            default:
                return
        }
        // Keep arrows/Esc from nudging or deselecting on the board
        e.preventDefault()
        e.stopPropagation()
    }

    return (
        <div
            ref={barRef}
            className='wf-window wf-align'
            role='toolbar'
            aria-label={`Align ${sel.length} selected objects`}
            style={style}
            onKeyDown={onKeyDown}
        >
            {GROUPS.map((group, gi) => (
                <React.Fragment key={gi}>
                    {gi > 0 && <span className='wf-align-sep' aria-hidden='true' />}
                    {group.map((b) => (
                        <button
                            key={b.op}
                            type='button'
                            className='wf-btn'
                            aria-label={b.label}
                            title={b.label}
                            onClick={() => runAlign(b.op)}
                        >
                            <FeatureIcon icon={<AlignIcon op={b.op} />} size={22} />
                        </button>
                    ))}
                </React.Fragment>
            ))}
            <span className='wf-align-sep' aria-hidden='true' />
            <button
                type='button'
                className='wf-btn'
                aria-label='Snap all to grid'
                title='Snap all to grid'
                onClick={snapSelectionToGrid}
            >
                <FeatureIcon icon={<SnapIcon />} size={22} />
            </button>
            <button
                type='button'
                className='wf-btn'
                aria-label='Close align bar'
                title='Close (Esc)'
                onClick={close}
            >
                <Icon name='close' size={18} />
            </button>
        </div>
    )
}
