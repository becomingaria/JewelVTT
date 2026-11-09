import { IconFrame } from "../host/FeatureIcon"

/* Original 24×24 icons for the measure feature (currentColor, 1.8 stroke) */

/** A surveyor's rod laid diagonally, with tick marks */
export const RulerIcon = (
    <IconFrame>
        <path d='M3 16.5 16.5 3 21 7.5 7.5 21Z' />
        <path d='M7 12.5l2 2M10 9.5l1.5 1.5M13 6.5l2 2M8.5 11l1 1M11.5 8l1 1' />
    </IconFrame>
)

/** A cone template with hatch lines */
export const TemplateIcon = (
    <IconFrame>
        <path d='M3 12 20 4v16Z' />
        <path d='M10 9.5 13 16.5M14 7.5 17 18' strokeWidth='1.2' />
        <rect x='2' y='11' width='2' height='2' fill='currentColor' stroke='none' />
    </IconFrame>
)

export const ConeIcon = (
    <IconFrame>
        <path d='M4 12 20 5v14Z' />
    </IconFrame>
)

export const LineIcon = (
    <IconFrame>
        <path d='M3 9.5h18v5H3Z' />
        <path d='M3 12h18' strokeDasharray='2 2' strokeWidth='1.2' />
    </IconFrame>
)

export const BurstIcon = (
    <IconFrame>
        <circle cx='12' cy='12' r='8' />
        <path d='M12 7v10M7 12h10' strokeWidth='1.2' />
    </IconFrame>
)

export const SquareIcon = (
    <IconFrame>
        <rect x='4' y='4' width='16' height='16' />
        <path d='M4 12h16M12 4v16' strokeWidth='1.2' />
    </IconFrame>
)

/** Nested squares: token footprint */
export const SizeIcon = (
    <IconFrame>
        <rect x='3' y='3' width='18' height='18' />
        <rect x='8' y='8' width='8' height='8' />
    </IconFrame>
)

/** Same, ticked: the token's current size */
export const SizeCheckedIcon = (
    <IconFrame>
        <rect x='3' y='3' width='18' height='18' />
        <path d='M7.5 12.5l3 3 6-7' strokeWidth='2.4' />
    </IconFrame>
)

/** A boot print: movement rate */
export const SpeedIcon = (
    <IconFrame>
        <path d='M8 3h5v9l6 3v4H8Z' />
        <path d='M8 15h11' />
        <path d='M3 7h3M2 11h4' strokeWidth='1.4' />
    </IconFrame>
)

export const RotateLeftIcon = (
    <IconFrame>
        <path d='M5 9a8 8 0 1 1 1 8' />
        <path d='M4 4v5h5' />
    </IconFrame>
)

export const RotateRightIcon = (
    <IconFrame>
        <path d='M19 9a8 8 0 1 0-1 8' />
        <path d='M20 4v5h-5' />
    </IconFrame>
)
