import React from "react"
import { FEATURES } from "../registry"
import type { BoardCamera } from "../board-bridge"
import type { Humbug } from "../../types/humbug.types"

const OVERLAYS = FEATURES.filter((f) => f.BoardOverlay).sort(
    (a, b) => (a.overlayZ ?? 0) - (b.overlayZ ?? 0)
)

/** Every feature's BoardOverlay, stacked by overlayZ, inside the board */
export const BoardOverlays: React.FC<{ camera: BoardCamera }> = ({ camera }) => (
    <>
        {OVERLAYS.map((f) => {
            const Overlay = f.BoardOverlay!
            return <Overlay key={f.id} camera={camera} />
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
