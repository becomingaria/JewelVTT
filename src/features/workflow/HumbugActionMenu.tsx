import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { HumbugContextMenu } from "../../components/HumbugContextMenu"
import type { IconName } from "../../components/Icon"
import type { Humbug, Point } from "../../types/humbug.types"
import { FeatureIcon } from "../host/FeatureIcon"
import { useReducedMotion } from "../prefs"
import { FEATURES } from "../registry"
import { PLAYER_ALLOWED, netRoleStore } from "../view-state"
import { humbugName } from "./actions"
import { MoreIcon } from "./icons"
import { useWorkflowPrefs } from "./state"

/*
 * Right-click menu on a humbug (#27). HumbugManager renders this in place
 * of HumbugContextMenu. Per viewer it is either a pixel-styled radial ring
 * around the pointer (default) or the classic list; the ring's "More…"
 * opens the list for anything that didn't fit.
 */

interface MenuProps {
    position: Point
    humbug: Humbug | null
    onClose: () => void
    onAction: (action: string, humbugId: string) => void
    inParty?: boolean
}

export const HumbugActionMenu: React.FC<MenuProps> = (props) => {
    const { menuStyle } = useWorkflowPrefs()
    const [asList, setAsList] = useState(false)
    if (!props.humbug) return null
    if (menuStyle === "list" || asList)
        return <HumbugContextMenu {...props} isOpen autoFocus={asList} />
    return <RadialMenu {...props} humbug={props.humbug} onMore={() => setAsList(true)} />
}

interface RingItem {
    id: string
    label: string
    icon: IconName | React.ReactElement
    danger?: boolean
    run: () => void
}

/** Buttons that fit around the ring; the rest go behind "More…" */
const RING_MAX = 8

const RadialMenu: React.FC<MenuProps & { humbug: Humbug; onMore: () => void }> = ({
    position,
    humbug,
    onClose,
    onAction,
    onMore,
}) => {
    const still = useReducedMotion()
    const rootRef = useRef<HTMLDivElement>(null)
    const [focused, setFocused] = useState(0)

    const act = (action: string) => () => {
        onAction(action, humbug.id)
        onClose()
    }
    // A connected player only gets light and vision on their own tokens
    const player = netRoleStore.get() === "player"
    const core: RingItem[] = player ? [] : [
        { id: "edit", label: "Edit", icon: "edit", run: act("edit") },
        humbug.locked
            ? { id: "unlock", label: "Unlock", icon: "unlock", run: act("unlock") }
            : { id: "lock", label: "Lock", icon: "lock", run: act("lock") },
        { id: "front", label: "Bring to front", icon: "to-front", run: act("bringToFront") },
        { id: "back", label: "Send to back", icon: "to-back", run: act("sendToBack") },
    ]
    const extra: RingItem[] = FEATURES.flatMap((f) => f.humbugMenu ?? [])
        .filter((m) => (!m.when || m.when(humbug)) && (!player || PLAYER_ALLOWED.menu(m.id)))
        .map((m) => ({
            id: m.id,
            label: m.label,
            icon: m.icon,
            run: () => {
                m.run(humbug)
                onClose()
            },
        }))
    const del: RingItem = { id: "delete", label: "Delete", icon: "trash", danger: true, run: act("delete") }
    // Delete always stays on the ring, last; the rest fill in order
    const tail = player ? [] : [del]
    const room = RING_MAX - tail.length
    const rest = [...core, ...extra]
    const items: RingItem[] =
        rest.length <= room
            ? [...rest, ...tail]
            : [
                  ...rest.slice(0, room - 1),
                  { id: "more", label: "More…", icon: <MoreIcon />, run: onMore },
                  ...tail,
              ]

    const radius = items.length <= 6 ? 74 : 86

    // Keep the whole ring inside the board, then focus the first item
    useLayoutEffect(() => {
        const root = rootRef.current
        const parent = root?.offsetParent as HTMLElement | null
        if (!root || !parent) return
        const pad = radius + 32
        const clamp = (v: number, max: number) => Math.min(Math.max(v, pad), Math.max(pad, max - pad))
        root.style.left = `${clamp(position.x, parent.clientWidth)}px`
        root.style.top = `${clamp(position.y, parent.clientHeight)}px`
    }, [position.x, position.y, radius])

    useEffect(() => {
        const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
        rootRef.current?.querySelector<HTMLElement>("button")?.focus()
        const root = rootRef.current
        return () => {
            const a = document.activeElement
            if (before?.isConnected && (!a || a === document.body || root?.contains(a))) before.focus()
        }
    }, [])

    const onKeyDown = (e: React.KeyboardEvent) => {
        const buttons = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>(".wf-radial-item") ?? [])]
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const go = (n: number) => buttons[(n + buttons.length) % buttons.length]?.focus()
        switch (e.key) {
            case "ArrowRight":
            case "ArrowDown":
                go(i + 1)
                break
            case "ArrowLeft":
            case "ArrowUp":
                go(i - 1)
                break
            case "Tab":
                go(e.shiftKey ? i - 1 : i + 1)
                break
            case "Home":
                go(0)
                break
            case "End":
                go(buttons.length - 1)
                break
            case "Escape":
                onClose()
                break
            default:
                return
        }
        e.preventDefault()
        e.stopPropagation()
    }

    const name = humbugName(humbug)
    const hub = items[focused]?.label ?? ""

    return (
        <>
            <div
                className='wf-radial-backdrop'
                onMouseDown={onClose}
                onContextMenu={(e) => {
                    e.preventDefault()
                    onClose()
                }}
            />
            <div
                ref={rootRef}
                className={`wf-radial ${still ? "wf-radial--still" : ""}`}
                style={
                    { left: position.x, top: position.y, "--wf-r": `${radius}px` } as React.CSSProperties
                }
                role='menu'
                aria-label={name ? `Actions for ${name}` : "Object actions"}
                onKeyDown={onKeyDown}
                onContextMenu={(e) => e.preventDefault()}
            >
                <div className='wf-radial-ring' aria-hidden='true' />
                <div className='wf-radial-hub' aria-hidden='true'>
                    {hub}
                </div>
                {items.map((it, i) => {
                    const a = -Math.PI / 2 + (i / items.length) * Math.PI * 2
                    return (
                        <button
                            key={it.id}
                            type='button'
                            role='menuitem'
                            className={`wf-radial-item ${it.danger ? "wf-danger" : ""}`}
                            aria-label={it.label}
                            title={it.label}
                            style={
                                {
                                    "--dx": `${Math.round(Math.cos(a) * radius)}px`,
                                    "--dy": `${Math.round(Math.sin(a) * radius)}px`,
                                    "--i": i,
                                } as React.CSSProperties
                            }
                            onFocus={() => setFocused(i)}
                            onMouseEnter={() => setFocused(i)}
                            onClick={it.run}
                        >
                            <FeatureIcon icon={it.icon} size={24} />
                        </button>
                    )
                })}
            </div>
        </>
    )
}
