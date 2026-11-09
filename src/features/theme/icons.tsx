import { IconFrame } from "../host/FeatureIcon"

/* Theme feature icons: 24×24, currentColor, drawn on the shared frame. */

/** Rolling waves */
export const WaterIcon = (
    <IconFrame>
        <path d='M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0' />
        <path d='M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0' />
        <path d='M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0' />
    </IconFrame>
)

/** A lava blob with a rising bubble */
export const LavaIcon = (
    <IconFrame>
        <path d='M3 20h18' />
        <path d='M5 20c0-4 3-5 4-8 1 2 3 3 3 5 1-3 3-4 3-7 2 3 4 6 4 10' />
        <circle cx='12' cy='5' r='1.5' />
    </IconFrame>
)

/** Four-point sparkle */
export const MagicIcon = (
    <IconFrame>
        <path d='M12 3v6M12 15v6M3 12h6M15 12h6' />
        <path d='M12 9l1 3-1 3-1-3z' />
        <path d='M18.5 4.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L16.5 6.5l1.5-.5z' />
    </IconFrame>
)

/** A flask with bubbles */
export const AcidIcon = (
    <IconFrame>
        <path d='M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3' />
        <path d='M7.5 15h9' />
        <circle cx='11' cy='18' r='0.8' />
        <circle cx='14' cy='17' r='0.8' />
    </IconFrame>
)

/** Still water: a flat line, crossed */
export const StillIcon = (
    <IconFrame>
        <path d='M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0' />
        <path d='M4 4l16 16' />
    </IconFrame>
)
