import React from "react"
import { IconFrame } from "../host/FeatureIcon"
import { useStore } from "../store"
import { darknessStore } from "./light-store"

/* Original pixel-style icons on the 24×24 grid (currentColor, 1.8 stroke). */

const Px: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 2 }) => (
    <rect x={x} y={y} width={s} height={s} fill='currentColor' stroke='none' />
)

/** Blocky cloud with a dithered trail */
export const FogIcon: React.FC = () => (
    <IconFrame>
        <path d='M4 15h16v-3h-2v-2h-3V7H10v2H8v3H6v1H4z' />
        <Px x={5} y={18} />
        <Px x={9} y={18} />
        <Px x={13} y={18} />
        <Px x={17} y={18} />
        <Px x={7} y={20.5} />
        <Px x={15} y={20.5} />
    </IconFrame>
)

const Sun = () => (
    <>
        <rect x='8' y='8' width='8' height='8' />
        <path d='M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2' />
    </>
)

const Moon = () => <path d='M15 3H10v2H8v2H6v10h2v2h2v2h5v-2h-3v-2h-2V7h2V5h3z' />

/** Sun setting on the horizon */
const HalfSun = () => (
    <>
        <path d='M3 17h18' />
        <path d='M7 17v-2h1v-2h2v-1h4v1h2v2h1v2' />
        <path d='M12 4v4M5 8l2 2M19 8l-2 2' />
        <Px x={6} y={20} />
        <Px x={11} y={20} />
        <Px x={16} y={20} />
    </>
)

/** Live: shows the current scene light (sun, half, moon) */
export const DarknessIcon: React.FC = () => {
    const d = useStore(darknessStore)
    return <IconFrame>{d === "daylight" ? <Sun /> : d === "dim" ? <HalfSun /> : <Moon />}</IconFrame>
}

export const FlameIcon: React.FC = () => (
    <IconFrame>
        <path d='M12 3l3 5 2 3v5l-2 3H9l-2-3v-4l2-2 1 2z' />
        <path d='M12 13l1.5 2.5V17h-3v-1.5z' />
    </IconFrame>
)

export const LanternIcon: React.FC = () => (
    <IconFrame>
        <path d='M9 6V4h6v2M7 6h10v2H7zM8 8h8v10H8zM7 18h10v2H7z' />
        <Px x={11} y={11} s={2} />
        <Px x={11} y={13} s={2} />
    </IconFrame>
)

export const CandleIcon: React.FC = () => (
    <IconFrame>
        <path d='M9 11h6v10H9zM12 3l1.5 3v2h-3V6z' />
        <path d='M7 21h10' />
    </IconFrame>
)

export const SparkleIcon: React.FC = () => (
    <IconFrame>
        <path d='M12 3v4M12 17v4M3 12h4M17 12h4' />
        <rect x='10' y='10' width='4' height='4' />
        <Px x={17} y={5} />
        <Px x={5} y={17} />
    </IconFrame>
)

export const NoLightIcon: React.FC = () => (
    <IconFrame>
        <path d='M12 3l3 5 2 3v5l-2 3H9l-2-3v-4l2-2 1 2z' />
        <path d='M4 4l16 16' />
    </IconFrame>
)

export const EyeIcon: React.FC<{ open: boolean }> = ({ open }) => (
    <IconFrame>
        <path d='M2 12l3-4h4l3-2 3 2h4l3 4-3 4h-4l-3 2-3-2H5z' />
        {open ? <rect x='10' y='10' width='4' height='4' /> : <path d='M4 4l16 16' />}
    </IconFrame>
)
