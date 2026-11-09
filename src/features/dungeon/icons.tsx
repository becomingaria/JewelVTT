import { IconFrame } from "../host/FeatureIcon"

/* Dock and menu icons for the dungeon feature (24×24, currentColor) */

/** Two rooms joined by a corridor */
export const roomsIcon = (
    <IconFrame>
        <rect x='3' y='3.5' width='8' height='7' />
        <rect x='13' y='13' width='8' height='7.5' />
        <path d='M11 7h5.5v6' />
    </IconFrame>
)

/** A flight of stairs (stamp palette) */
export const stampsIcon = (
    <IconFrame>
        <path d='M3.5 20.5h4.5v-4.5h4.5v-4.5h4.5v-4.5h3.5' />
        <path d='M3.5 20.5v-6' />
        <circle cx='7' cy='6' r='2.5' />
    </IconFrame>
)

/** A die over a little map (generator) */
export const generatorIcon = (
    <IconFrame>
        <rect x='3.5' y='3.5' width='12' height='12' rx='2' />
        <circle cx='7' cy='7' r='0.9' fill='currentColor' />
        <circle cx='12' cy='12' r='0.9' fill='currentColor' />
        <circle cx='9.5' cy='9.5' r='0.9' fill='currentColor' />
        <path d='M18.5 9v11.5H7v-2' />
    </IconFrame>
)

export const doorIcon = (
    <IconFrame>
        <path d='M6 21V4.5h12V21' />
        <path d='M3.5 21h17' />
        <circle cx='14.5' cy='13' r='1' fill='currentColor' />
    </IconFrame>
)

export const doorOpenIcon = (
    <IconFrame>
        <path d='M6 21V4.5h12V21' />
        <path d='M6 4.5 12 7v15.5L6 21' />
        <path d='M3.5 21h17' />
    </IconFrame>
)

export const barIcon = (
    <IconFrame>
        <path d='M6 21V4.5h12V21' />
        <path d='M3.5 12h17' strokeWidth='3' />
    </IconFrame>
)

export const gateIcon = (
    <IconFrame>
        <path d='M4 4h16M6 4v15M10 4v15M14 4v15M18 4v15M4 9h16M4 14h16' />
    </IconFrame>
)

export const trapIcon = (
    <IconFrame>
        <rect x='4' y='4' width='16' height='16' />
        <path d='m7 17 2.5-6 2.5 6 2.5-6 2.5 6' />
    </IconFrame>
)
