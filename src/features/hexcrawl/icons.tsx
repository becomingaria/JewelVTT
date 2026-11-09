import { IconFrame } from "../host/FeatureIcon"

/* Dock icons for the hex crawl tools: 24×24, currentColor strokes */

const HEX = "M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"

export const TerrainIcon = (
    <IconFrame>
        <path d={HEX} />
        <path d='M6.8 15.5l3.4-5 2 2.6 1.6-2 3.4 4.4z' />
    </IconFrame>
)

export const FeatureIcon = (
    <IconFrame>
        <path d={HEX} />
        <path d='M10 17V7.5l5.5 2.2L10 12' />
    </IconFrame>
)

export const TravelIcon = (
    <IconFrame>
        <path d='M4 20c3.5-.5 4.5-5 8-6s5-6 8-8' strokeDasharray='2.2 2.8' />
        <path d='M15.5 5.5H20V10' />
        <circle cx='4.5' cy='19.5' r='1.5' />
    </IconFrame>
)

export const GeneratorIcon = (
    <IconFrame>
        <path d={HEX} />
        <path d='M12 7.5v3M12 13.5v3M7.5 12h3M13.5 12h3' />
        <path d='M17.5 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z' />
    </IconFrame>
)
