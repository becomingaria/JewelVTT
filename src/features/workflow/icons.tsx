import { IconFrame } from "../host/FeatureIcon"
import type { ReactElement } from "react"
import type { AlignOp } from "./align"

/* Workflow icons: original 24×24 line art on the shared IconFrame grid */

const ALIGN_ICONS: Record<AlignOp, ReactElement> = {
    left: (
        <IconFrame>
            <path d='M4 3v18' />
            <rect x='7' y='6' width='12' height='4' />
            <rect x='7' y='14' width='7' height='4' />
        </IconFrame>
    ),
    centre: (
        <IconFrame>
            <path d='M12 3v18' strokeDasharray='2 2' />
            <rect x='5' y='6' width='14' height='4' />
            <rect x='8' y='14' width='8' height='4' />
        </IconFrame>
    ),
    right: (
        <IconFrame>
            <path d='M20 3v18' />
            <rect x='5' y='6' width='12' height='4' />
            <rect x='10' y='14' width='7' height='4' />
        </IconFrame>
    ),
    top: (
        <IconFrame>
            <path d='M3 4h18' />
            <rect x='6' y='7' width='4' height='12' />
            <rect x='14' y='7' width='4' height='7' />
        </IconFrame>
    ),
    middle: (
        <IconFrame>
            <path d='M3 12h18' strokeDasharray='2 2' />
            <rect x='6' y='5' width='4' height='14' />
            <rect x='14' y='8' width='4' height='8' />
        </IconFrame>
    ),
    bottom: (
        <IconFrame>
            <path d='M3 20h18' />
            <rect x='6' y='5' width='4' height='12' />
            <rect x='14' y='10' width='4' height='7' />
        </IconFrame>
    ),
    "distribute-h": (
        <IconFrame>
            <path d='M3 4v16M21 4v16' />
            <rect x='6' y='8' width='3' height='8' />
            <rect x='10.5' y='8' width='3' height='8' />
            <rect x='15' y='8' width='3' height='8' />
        </IconFrame>
    ),
    "distribute-v": (
        <IconFrame>
            <path d='M4 3h16M4 21h16' />
            <rect x='8' y='6' width='8' height='3' />
            <rect x='8' y='10.5' width='8' height='3' />
            <rect x='8' y='15' width='8' height='3' />
        </IconFrame>
    ),
}

export const AlignIcon = ({ op }: { op: AlignOp }) => ALIGN_ICONS[op]

export const SnapIcon = () => (
    <IconFrame>
        <path d='M3 8h18M3 16h18M8 3v18M16 3v18' strokeOpacity='0.55' />
        <rect x='8' y='8' width='8' height='8' fill='currentColor' fillOpacity='0.25' />
    </IconFrame>
)

export const MoreIcon = () => (
    <IconFrame>
        <rect x='4' y='10.5' width='3' height='3' fill='currentColor' />
        <rect x='10.5' y='10.5' width='3' height='3' fill='currentColor' />
        <rect x='17' y='10.5' width='3' height='3' fill='currentColor' />
    </IconFrame>
)
