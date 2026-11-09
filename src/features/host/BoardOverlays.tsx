import React from "react"
import { FEATURES } from "../registry"
import type { BoardCamera } from "../board-bridge"
import type { Humbug } from "../../types/humbug.types"

const OVERLAYS = FEATURES.filter((f) => f.BoardOverlay).sort(
    (a, b) => (a.overlayZ ?? 0) - (b.overlayZ ?? 0)
)

/*
 * Each overlay gets its own positioned slot above humbugs (0), connectors
 * (1) and scribbles (2). Slots share z-index 3 and are in overlayZ order,
 * so a feature's own z-index can't lift it over another feature's overlay.
 */
const SLOT: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 3,
    pointerEvents: "none",
}

/** Every feature's BoardOverlay, stacked by overlayZ, inside the board */
export const BoardOverlays: React.FC<{ camera: BoardCamera }> = ({ camera }) => (
    <>
        {OVERLAYS.map((f) => {
            const Overlay = f.BoardOverlay!
            return (
                <div key={f.id} className={`board-overlay-slot slot-${f.id}`} style={SLOT}>
                    <Overlay camera={camera} />
                </div>
            )
        })}
    </>
)

const UNDERLAYS = FEATURES.filter((f) => f.BoardUnderlay).sort(
    (a, b) => (a.underlayZ ?? 0) - (b.underlayZ ?? 0)
)

/** Every feature's BoardUnderlay (below the humbugs), stacked by underlayZ */
export const BoardUnderlays: React.FC<{ camera: BoardCamera }> = ({ camera }) => (
    <>
        {UNDERLAYS.map((f) => {
            const Underlay = f.BoardUnderlay!
            return <Underlay key={f.id} camera={camera} />
        })}
    </>
)

const BADGES = FEATURES.filter((f) => f.HumbugBadge)

/** Every feature's HumbugBadge for one humbug (HP bars, conditions, ...) */
export const HumbugBadges: React.FC<{ humbug: Humbug; scale: number }> = ({ humbug, scale }) =>
    BADGES.length ? (
        <div className='humbug-badges'>
            {BADGES.map((f) => {
                const Badge = f.HumbugBadge!
                return <Badge key={f.id} humbug={humbug} scale={scale} />
            })}
        </div>
    ) : null
