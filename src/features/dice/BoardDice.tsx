import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useStore } from "../store"
import { prefsStore, useReducedMotion } from "../prefs"
import { GRID_SIZE } from "../board-bridge"
import type { BoardOverlayProps } from "../types"
import { PixelDie } from "./PixelDie"
import { RollFlag } from "./RollResult"
import { BOARD_DICE_LIFETIME, MAX_SPRITES, boardDiceStore, type BoardDiceGroup } from "./state"

/*
 * Dice rolled onto the board: pixel sprites that tumble in, settle on their
 * faces and fade after a few seconds. Anchored to a world point, laid out in
 * screen space so they stay readable at any zoom. Draw only.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Small deterministic PRNG so a group's layout is stable across renders */
function seeded(seed: string) {
    let h = 2166136261
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
    return () => {
        h = Math.imul(h ^ (h >>> 15), 2246822507)
        h = Math.imul(h ^ (h >>> 13), 3266489909)
        h ^= h >>> 16
        return (h >>> 0) / 4294967296
    }
}

interface Spot {
    x: number
    y: number
    fromX: number
    fromY: number
    spin: number
    delay: number
}

function layout(group: BoardDiceGroup): { spots: Spot[]; rows: number } {
    const n = Math.min(group.dice.length, MAX_SPRITES)
    const cols = n <= 4 ? n : Math.ceil(Math.sqrt(n * 1.6))
    const rows = Math.ceil(n / cols)
    const rnd = seeded(group.id)
    const throwAngle = rnd() * Math.PI * 2
    const spots = Array.from({ length: n }, (_, i) => {
        const r = Math.floor(i / cols)
        const inRow = r === rows - 1 ? n - r * cols : cols
        const c = i % cols
        const dist = 2.4 + rnd() * 1.2
        return {
            x: (c - (inRow - 1) / 2) * 1.25 + (rnd() - 0.5) * 0.3,
            y: (r - (rows - 1) / 2) * 1.25 + (rnd() - 0.5) * 0.3,
            fromX: Math.cos(throwAngle) * dist,
            fromY: Math.sin(throwAngle) * dist,
            spin: (rnd() < 0.5 ? -1 : 1) * (360 + Math.round(rnd() * 360)),
            delay: Math.round(rnd() * 120),
        }
    })
    return { spots, rows }
}

const DieSprite: React.FC<{ sides: number; value: number; dropped?: boolean; size: number; reduced: boolean }> = ({
    sides,
    value,
    dropped,
    size,
    reduced,
}) => {
    const [face, setFace] = useState(() => (reduced ? value : 1 + Math.floor(Math.random() * sides)))
    useEffect(() => {
        if (reduced) {
            setFace(value)
            return
        }
        // A few face changes while it tumbles (slow enough to never flash)
        const tick = setInterval(() => setFace(1 + Math.floor(Math.random() * sides)), 150)
        const settle = setTimeout(() => {
            clearInterval(tick)
            setFace(value)
        }, 620)
        return () => {
            clearInterval(tick)
            clearTimeout(settle)
        }
    }, [reduced, sides, value])
    return <PixelDie sides={sides} value={face} size={size} dropped={dropped && face === value} />
}

const DiceGroup: React.FC<{ group: BoardDiceGroup; camera: BoardOverlayProps["camera"]; size: number; reduced: boolean }> = ({
    group,
    camera,
    size,
    reduced,
}) => {
    const { spots, rows } = useMemo(() => layout(group), [group])
    const bannerRef = useRef<HTMLDivElement>(null)
    const [banner, setBanner] = useState({ w: 160, h: 28 })
    useLayoutEffect(() => {
        const el = bannerRef.current
        if (el && (el.offsetWidth !== banner.w || el.offsetHeight !== banner.h)) {
            setBanner({ w: el.offsetWidth, h: el.offsetHeight })
        }
    }, [banner.w, banner.h])
    const base = camera.worldToScreen(group.origin.x, group.origin.y)
    // Side by side with other rolls on the same spot: centre, right, left, further right...
    const side = [0, 1, -1, 2, -2][group.slot % 5]
    const rec = group.record
    const hidden = group.dice.length - spots.length
    const d20 = group.dice.filter((d) => d.sides === 20 && !d.dropped)
    const step = size
    const bannerOffset = ((rows - 1) / 2) * 1.25 * step + step * 0.7

    // Keep the whole group (dice and banner) inside the visible board,
    // clear of the tool dock, even if the board is panned while it shows
    const half = size / 2
    const xs = spots.map((sp) => sp.x * step)
    const ys = spots.map((sp) => sp.y * step)
    const ext = {
        left: Math.min(Math.min(...xs) - half, -banner.w / 2),
        right: Math.max(Math.max(...xs) + half, banner.w / 2),
        top: Math.min(...ys) - half,
        bottom: bannerOffset + banner.h,
    }
    const el = camera.container
    const pad = 12
    const fit = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : clamp(v, lo, hi))
    const anchor = el
        ? {
              x: fit(
                  base.x + side * 5.6 * size,
                  pad + 72 * prefsStore.get().uiScale - ext.left,
                  el.clientWidth - pad - ext.right
              ),
              y: fit(base.y, pad - ext.top, el.clientHeight - pad - ext.bottom),
          }
        : { x: base.x + side * 5.6 * size, y: base.y }
    const bannerTop = anchor.y + bannerOffset
    return (
        <div
            className={`jv-board-group ${reduced ? "" : "jv-board-group--fade"}`}
            style={{ "--jv-fade-delay": `${BOARD_DICE_LIFETIME - 800}ms` } as React.CSSProperties}
        >
            {spots.map((s, i) => {
                const d = group.dice[i]
                return (
                    <div
                        key={i}
                        className={`jv-board-die ${reduced ? "" : "jv-board-die--tumble"} ${
                            d20.length === 1 && d === d20[0] && (rec.crit || rec.fumble) ? "jv-board-die--flag" : ""
                        }`}
                        style={
                            {
                                left: anchor.x + s.x * step - size / 2,
                                top: anchor.y + s.y * step - size / 2,
                                width: size,
                                height: size,
                                "--jv-from-x": `${s.fromX * step}px`,
                                "--jv-from-y": `${s.fromY * step}px`,
                                "--jv-spin": `${s.spin}deg`,
                                animationDelay: `${s.delay}ms`,
                            } as React.CSSProperties
                        }
                    >
                        <DieSprite sides={d.sides} value={d.value} dropped={d.dropped} size={size} reduced={reduced} />
                    </div>
                )
            })}
            <div ref={bannerRef} className='jv-board-banner' style={{ left: anchor.x, top: bannerTop }}>
                {rec.table ? (
                    <>
                        <strong>{rec.table.name}:</strong> {rec.table.text}
                    </>
                ) : (
                    <>
                        {rec.label ? `${rec.label}: ` : ""}
                        <strong className='jv-board-total'>{rec.total}</strong>
                        {hidden > 0 ? ` (+${hidden} dice)` : ""}
                        <RollFlag rec={rec} />
                    </>
                )}
            </div>
        </div>
    )
}

export const BoardDiceOverlay: React.FC<BoardOverlayProps> = ({ camera }) => {
    const groups = useStore(boardDiceStore)
    const reduced = useReducedMotion()
    if (!groups.length) return null
    const size = Math.round(clamp(GRID_SIZE * camera.scale, 30, 84))
    return (
        <div className='jv-board-dice' aria-hidden='true'>
            {groups.map((g) => (
                <DiceGroup key={g.id} group={g} camera={camera} size={size} reduced={reduced} />
            ))}
        </div>
    )
}
