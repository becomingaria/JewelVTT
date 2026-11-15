import React, { useEffect, useRef, useState } from "react"
import type { Point } from "../../types/humbug.types"
import { snapForGrid } from "../../utils/humbug.utils"
import type { BoardOverlayProps } from "../types"
import { cellAt, cellKey } from "../grid"
import { isCellVisible } from "../fog-light/effective-fog"
import { fogShape } from "../fog-light/fog-store"
import { playSfx } from "../sound"
import { useStore } from "../store"
import { useNetRole } from "../view-state"
import { placingStore, requestAddToken } from "./client"

const SIZE = { width: 32, height: 32 }

/** Can the party see the spot a new token would stand on? */
function spotOk(topLeft: Point): boolean {
    return isCellVisible(cellKey(cellAt({ x: topLeft.x + 16, y: topLeft.y + 16 }, fogShape())))
}

/**
 * A player placing a character: a ghost of the token follows the pointer,
 * solid where the party can see and dashed (with a ✕) under the fog. Click
 * to place, Esc to stop. The GM's app checks the spot again.
 */
export const PlaceOverlay: React.FC<BoardOverlayProps> = ({ camera }) => {
    const placing = useStore(placingStore)
    const role = useNetRole()
    const wrapRef = useRef<HTMLDivElement>(null)
    const [at, setAt] = useState<Point | null>(null)
    const [note, setNote] = useState("")
    const active = role === "player" && !!placing

    useEffect(() => {
        if (!active) {
            setAt(null)
            setNote("")
            return
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return
            e.preventDefault()
            placingStore.set(null)
        }
        window.addEventListener("keydown", onKey, true)
        return () => window.removeEventListener("keydown", onKey, true)
    }, [active])

    if (!active || !placing) return null

    const toSpot = (e: React.PointerEvent): Point => {
        const r = wrapRef.current!.getBoundingClientRect()
        const p = camera.containerToWorld(e.clientX - r.left, e.clientY - r.top)
        return snapForGrid({ x: p.x - SIZE.width / 2, y: p.y - SIZE.height / 2 }, SIZE, camera.gridShape)
    }

    const ok = at ? spotOk(at) : false
    const tl = at ? camera.worldToScreen(at.x, at.y) : null
    const br = at ? camera.worldToScreen(at.x + SIZE.width, at.y + SIZE.height) : null

    return (
        <div
            ref={wrapRef}
            className='net-place'
            onPointerMove={(e) => setAt(toSpot(e))}
            onPointerLeave={() => setAt(null)}
            onPointerDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault()
                e.stopPropagation()
                const spot = toSpot(e)
                if (!spotOk(spot)) {
                    setNote("That spot is under the fog. Pick somewhere the party can see.")
                    playSfx("error")
                    return
                }
                requestAddToken(placing, spot)
                placingStore.set(null)
            }}
            onContextMenu={(e) => {
                e.preventDefault()
                placingStore.set(null)
            }}
        >
            {tl && br && (
                <div
                    className={`net-ghost ${ok ? "is-ok" : "is-blocked"}`}
                    style={{ left: tl.x, top: tl.y, width: br.x - tl.x, height: br.y - tl.y }}
                    aria-hidden='true'
                >
                    <img src={placing.image} alt='' />
                    {!ok && <span className='net-ghost-x'>✕</span>}
                </div>
            )}
            <div className='net-place-banner' role='status' aria-live='polite'>
                {note || `Click a spot you can see to place ${placing.name}. Esc or right-click cancels.`}
            </div>
        </div>
    )
}
