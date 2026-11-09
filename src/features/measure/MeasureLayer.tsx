import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import type { Humbug } from "../../types/humbug.types"
import { humbugFootprint } from "../../utils/humbug.utils"
import { useBoardSlice } from "../../utils/board-store"
import { cameraStore, useHumbugs } from "../board-bridge"
import { useStore } from "../store"
import { activeToolStore } from "../view-state"
import { setTokenSpeed } from "./actions"
import { tokenName } from "./describe"
import {
    announce,
    announceStore,
    measureStore,
    RULER_TOOL,
    sanitizeTemplates,
    selectedTemplateStore,
    speedPopoverStore,
    TEMPLATE_TOOL,
    templatesStore,
    tokenSpeed,
} from "./state"
import "./measure.css"

/** Mounted once at the app root */
export const MeasureLayer: React.FC = () => {
    const templates = useStore(templatesStore)
    useBoardSlice("measure:templates", templates, (value) => {
        templatesStore.set(sanitizeTemplates(value))
        selectedTemplateStore.set(null)
    })

    // The ruler is transient and selection belongs to the template tool
    useEffect(
        () =>
            activeToolStore.subscribe(() => {
                const tool = activeToolStore.get()
                if (tool !== RULER_TOOL) measureStore.set(null)
                if (tool !== TEMPLATE_TOOL) selectedTemplateStore.set(null)
            }),
        []
    )

    const said = useStore(announceStore)
    return (
        <>
            <div className='measure-sr-only' role='status' aria-live='polite' aria-atomic='true'>
                {said.text}
                {said.n % 2 ? " " : ""}
            </div>
            <SpeedPopover />
        </>
    )
}

// ------------------------------------------------------ movement popover
const PRESETS = [30, 60, 90, 120, 150]

const SpeedPopover: React.FC = () => {
    const open = useStore(speedPopoverStore)
    const humbugs = useHumbugs()
    const token = open ? humbugs.find((h) => h.id === open.tokenId) : undefined
    if (!token) return null
    return <SpeedForm key={token.id} token={token} />
}

function anchorFor(h: Humbug): { left: number; top: number } {
    const cam = cameraStore.get()
    const el = cam?.container
    if (!cam || !el) return { left: 120, top: 120 }
    const r = el.getBoundingClientRect()
    const f = humbugFootprint(h)
    const s = cam.worldToScreen(h.position.x + f.width, h.position.y)
    return { left: r.left + s.x + 12, top: r.top + s.y }
}

const SpeedForm: React.FC<{ token: Humbug }> = ({ token }) => {
    const [value, setValue] = useState(String(tokenSpeed(token.ext)))
    const [pos] = useState(() => anchorFor(token))
    const box = useRef<HTMLFormElement>(null)
    const input = useRef<HTMLInputElement>(null)
    const titleId = useId()
    const hintId = useId()
    const [place, setPlace] = useState(pos)

    // Keep the popover on screen
    useLayoutEffect(() => {
        const el = box.current
        if (!el) return
        const r = el.getBoundingClientRect()
        setPlace({
            left: Math.max(8, Math.min(pos.left, window.innerWidth - r.width - 8)),
            top: Math.max(8, Math.min(pos.top, window.innerHeight - r.height - 8)),
        })
    }, [pos])

    // Focus in, and give it back on close
    useEffect(() => {
        const back = document.activeElement as HTMLElement | null
        input.current?.focus()
        input.current?.select()
        // A press anywhere else closes it, like a menu
        const onDown = (e: MouseEvent) => {
            if (box.current && !box.current.contains(e.target as Node)) speedPopoverStore.set(null)
        }
        window.addEventListener("mousedown", onDown, true)
        return () => {
            window.removeEventListener("mousedown", onDown, true)
            if (back?.isConnected) back.focus()
        }
    }, [])

    const close = () => speedPopoverStore.set(null)
    const n = Number(value)
    const valid = Number.isFinite(n) && n > 0 && n <= 9999

    return (
        <form
            ref={box}
            className='measure-speed'
            role='dialog'
            noValidate
            aria-labelledby={titleId}
            aria-describedby={hintId}
            style={{ left: place.left, top: place.top }}
            onKeyDown={(e) => {
                if (e.key === "Escape") {
                    e.preventDefault()
                    e.stopPropagation()
                    close()
                }
            }}
            onSubmit={(e) => {
                e.preventDefault()
                if (!valid) return
                setTokenSpeed(token, n)
                announce(`${tokenName(token)} moves ${n} ft.`)
                close()
            }}
        >
            <div className='measure-speed-title' id={titleId}>
                Movement rate
            </div>
            <p className='measure-speed-hint' id={hintId}>
                {tokenName(token)}: feet per turn. The ruler shows how much of it a move uses.
            </p>
            <label className='measure-speed-field'>
                <span>Feet</span>
                <input
                    ref={input}
                    type='number'
                    inputMode='numeric'
                    min={1}
                    max={9999}
                    step={5}
                    value={value}
                    aria-invalid={!valid}
                    onChange={(e) => setValue(e.target.value)}
                />
            </label>
            <div className='measure-speed-presets' role='group' aria-label='Common rates'>
                {PRESETS.map((p) => (
                    <button key={p} type='button' aria-pressed={n === p} onClick={() => setValue(String(p))}>
                        {p}
                    </button>
                ))}
            </div>
            <div className='measure-speed-actions'>
                <button type='button' onClick={close}>
                    Cancel
                </button>
                <button type='submit' className='is-primary' disabled={!valid}>
                    Save
                </button>
            </div>
        </form>
    )
}
