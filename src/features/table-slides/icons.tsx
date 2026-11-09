import { IconFrame } from "../host/FeatureIcon"

/* Original 24×24 icons for Table Mode, frames, presenting and shapes */

/** A screen on a stand with two heads watching it */
export const TableModeIcon = (
    <IconFrame>
        <rect x='3' y='3' width='18' height='12' rx='1' />
        <path d='M12 15v3M8 21h8' />
        <circle cx='8.5' cy='9' r='1.6' />
        <circle cx='15.5' cy='9' r='1.6' />
    </IconFrame>
)

/** Dashed frame with a title tab */
export const FrameIcon = (
    <IconFrame>
        <path d='M4 6h6v-2h-6z' />
        <path d='M4 6v2M4 11v2M4 16v3h3M10 19h4M17 19h3v-3M20 13v-2M20 8V6h-3M14 6h-2' />
    </IconFrame>
)

/** A frame with a play triangle */
export const PresentIcon = (
    <IconFrame>
        <rect x='3' y='4' width='18' height='14' rx='1' />
        <path d='M10 8.5v5l4.5-2.5z' />
        <path d='M8 21h8' />
    </IconFrame>
)

/** A diamond above a box joined by an arrow */
export const ShapesIcon = (
    <IconFrame>
        <path d='M12 2.5l4 3.5-4 3.5-4-3.5z' />
        <path d='M12 9.5v4' />
        <path d='M10.5 12l1.5 1.5 1.5-1.5' />
        <rect x='6' y='15' width='12' height='6' rx='2' />
    </IconFrame>
)

/** Small up/down chevrons for reordering */
export const UpIcon = (
    <IconFrame>
        <path d='M6 15l6-6 6 6' />
    </IconFrame>
)
export const DownIcon = (
    <IconFrame>
        <path d='M6 9l6 6 6-6' />
    </IconFrame>
)

/** Crosshair: go to / fit to view */
export const GoIcon = (
    <IconFrame>
        <path d='M5 12h11M12 7l5 5-5 5' />
    </IconFrame>
)
export const FitViewIcon = (
    <IconFrame>
        <path d='M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' />
        <rect x='9' y='9' width='6' height='6' />
    </IconFrame>
)
